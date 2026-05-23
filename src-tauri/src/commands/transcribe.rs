use base64::{engine::general_purpose::STANDARD, Engine as _};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, State};
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "settings.json";
const API_KEY_KEY: &str = "openrouter_api_key";
// 18MB no MP3 → ~24MB em base64 (overhead ~33%), dentro do limite do gateway
const CHUNK_SIZE_LIMIT: u64 = 18 * 1024 * 1024;
const TRANSCRIBE_MAX_ATTEMPTS: u32 = 3;

// Cria um Command sem janela de console no Windows.
// Sem esse flag, cada ffmpeg invocado a partir de um app GUI abre um CMD visível —
// fechá-lo manualmente envia SIGTERM e mata o processo no meio do trabalho.
pub(crate) fn silent_command<S: AsRef<std::ffi::OsStr>>(program: S) -> std::process::Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let mut cmd = std::process::Command::new(program);
        cmd.creation_flags(CREATE_NO_WINDOW);
        cmd
    }
    #[cfg(not(windows))]
    {
        std::process::Command::new(program)
    }
}

fn session_id() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

// Estado da última transcrição que falhou — habilita o botão "Tentar novamente".
// Os chunks (.mp3) e o cache de texto por chunk (.txt) ficam em %TEMP%
// até clear_resume_state() ou conclusão bem-sucedida.
pub struct TranscribeState(pub Mutex<Option<ResumeInfo>>);

impl Default for TranscribeState {
    fn default() -> Self {
        TranscribeState(Mutex::new(None))
    }
}

#[derive(Clone)]
pub struct ResumeInfo {
    pub session_id: u128,
    pub model: String,
    pub total_chunks: u32,
}

// Erros classificados: Transient retenta com backoff; Permanent falha imediato.
enum TranscribeError {
    Transient(String),
    Permanent(String),
}

// Localiza o executável do ffmpeg: PATH primeiro, depois localizações conhecidas
pub(crate) fn find_ffmpeg() -> Result<String, String> {
    if silent_command("ffmpeg")
        .arg("-version")
        .output()
        .is_ok()
    {
        return Ok("ffmpeg".to_string());
    }

    let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();

    let candidates = [
        format!("{}\\meetily\\ffmpeg.exe", local_app_data),
        format!("{}\\CapCut\\Apps\\ffmpeg.exe", local_app_data),
    ];

    for candidate in &candidates {
        if std::path::Path::new(candidate).exists() {
            return Ok(candidate.clone());
        }
    }

    // Busca dentro de CapCut\Apps\* (versão no caminho)
    let capcut_apps = format!("{}\\CapCut\\Apps", local_app_data);
    if let Ok(entries) = std::fs::read_dir(&capcut_apps) {
        for entry in entries.flatten() {
            let candidate = entry.path().join("ffmpeg.exe");
            if candidate.exists() {
                return Ok(candidate.to_string_lossy().to_string());
            }
        }
    }

    Err("ffmpeg não encontrado. Instale o ffmpeg e adicione ao PATH".to_string())
}

// Passo 1: MP4 → MP3 (mono, 16kHz, 64kbps)
fn extract_to_mp3(ffmpeg: &str, input_path: &str, output_path: &Path) -> Result<(), String> {
    let result = silent_command(ffmpeg)
        .args([
            "-i", input_path,
            "-vn",
            "-ar", "16000",
            "-ac", "1",
            "-b:a", "64k",
            output_path.to_str().unwrap(),
            "-y",
        ])
        .output()
        .map_err(|e| format!("Erro ao executar ffmpeg: {}", e))?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        return Err(format!("Erro no ffmpeg (extração): {}", stderr));
    }
    Ok(())
}

// Passo 2 (quando necessário): dividir MP3 em chunks de 20 minutos com re-encode
// (re-encode garante headers limpos em cada chunk)
fn split_into_chunks(ffmpeg: &str, mp3_path: &Path, id: u128) -> Result<Vec<PathBuf>, String> {
    let temp_dir = std::env::temp_dir();
    let pattern = temp_dir.join(format!("minuta_{}_chunk_%03d.mp3", id));

    let result = silent_command(ffmpeg)
        .args([
            "-i", mp3_path.to_str().unwrap(),
            "-f", "segment",
            "-segment_time", "1200",
            "-c:a", "libmp3lame",
            "-b:a", "64k",
            pattern.to_str().unwrap(),
            "-y",
        ])
        .output()
        .map_err(|e| format!("Erro no ffmpeg (split): {}", e))?;

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        return Err(format!("Erro no ffmpeg (split): {}", stderr));
    }

    let chunks = locate_chunks(id);
    if chunks.is_empty() {
        return Err("ffmpeg não gerou chunks de áudio".to_string());
    }

    Ok(chunks)
}

// Tenta uma única chamada à API. Classifica erro como Transient (retry vale)
// ou Permanent (falha definitiva — auth, modelo inválido, etc).
async fn transcribe_file_once(
    path: &Path,
    model: &str,
    key: &str,
) -> Result<String, TranscribeError> {
    let bytes = std::fs::read(path)
        .map_err(|e| TranscribeError::Permanent(format!("Erro ao ler chunk: {}", e)))?;
    let b64 = STANDARD.encode(&bytes);

    let body = serde_json::json!({
        "model": model,
        "input_audio": {
            "data": b64,
            "format": "mp3"
        },
        "language": "pt"
    });

    let client = reqwest::Client::new();
    let response = match client
        .post("https://openrouter.ai/api/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r,
        // Falhas de rede (timeout, DNS, conexão) — sempre transientes
        Err(e) => return Err(TranscribeError::Transient(format!("Erro de rede: {}", e))),
    };

    let status = response.status();
    if !status.is_success() {
        let err_body = response.text().await.unwrap_or_default();
        let msg = format!("Erro ao transcrever: {} — {}", status, err_body);
        // 429 (rate limit) e 5xx → transientes; 4xx (exceto 429) → permanentes
        if status.as_u16() == 429 || status.is_server_error() {
            return Err(TranscribeError::Transient(msg));
        }
        return Err(TranscribeError::Permanent(msg));
    }

    #[derive(serde::Deserialize)]
    struct TranscribeResponse {
        text: String,
    }

    let result: TranscribeResponse = response
        .json()
        .await
        .map_err(|e| TranscribeError::Transient(format!("Erro ao processar resposta: {}", e)))?;

    Ok(result.text)
}

// Envelope com retry exponencial em cima de transcribe_file_once.
// Backoff: 1s, 2s, 4s — só retenta em erros classificados como transient.
async fn transcribe_with_retry(path: &Path, model: &str, key: &str) -> Result<String, String> {
    let mut last_msg = String::from("Falha desconhecida na transcrição");
    for attempt in 1..=TRANSCRIBE_MAX_ATTEMPTS {
        match transcribe_file_once(path, model, key).await {
            Ok(text) => return Ok(text),
            Err(TranscribeError::Permanent(msg)) => return Err(msg),
            Err(TranscribeError::Transient(msg)) => {
                last_msg = msg;
                if attempt < TRANSCRIBE_MAX_ATTEMPTS {
                    let delay = std::time::Duration::from_secs(1u64 << (attempt - 1));
                    tokio::time::sleep(delay).await;
                }
            }
        }
    }
    Err(format!(
        "Falhou após {} tentativas. Último erro: {}",
        TRANSCRIBE_MAX_ATTEMPTS, last_msg
    ))
}

fn chunk_text_cache(id: u128, idx: u32) -> PathBuf {
    std::env::temp_dir().join(format!("minuta_{}_chunk_{:03}.txt", id, idx))
}

// Lista chunks .mp3 numerados que ainda estão em disco para essa sessão.
fn locate_chunks(id: u128) -> Vec<PathBuf> {
    let temp_dir = std::env::temp_dir();
    let mut chunks = Vec::new();
    let mut i = 0u32;
    loop {
        let chunk = temp_dir.join(format!("minuta_{}_chunk_{:03}.mp3", id, i));
        if chunk.exists() {
            chunks.push(chunk);
            i += 1;
        } else {
            break;
        }
    }
    chunks
}

// Transcreve uma lista de chunks com cache em .txt por chunk.
// Se um chunk já tem .txt em disco, pula direto (resume gratuito).
// Em caso de falha, retorna o erro do chunk que falhou.
async fn transcribe_chunks(
    chunks: &[PathBuf],
    id: u128,
    model: &str,
    key: &str,
) -> Result<Vec<String>, String> {
    let mut texts: Vec<String> = Vec::with_capacity(chunks.len());
    for (i, chunk_path) in chunks.iter().enumerate() {
        let cache = chunk_text_cache(id, i as u32);
        if let Ok(text) = std::fs::read_to_string(&cache) {
            texts.push(text);
            continue;
        }
        match transcribe_with_retry(chunk_path, model, key).await {
            Ok(text) => {
                let _ = std::fs::write(&cache, &text);
                texts.push(text);
            }
            Err(e) => return Err(e),
        }
    }
    Ok(texts)
}

// Apaga todos os arquivos temporários de uma sessão (mp3 principal + chunks + caches .txt)
fn cleanup_session(id: u128) {
    let temp_dir = std::env::temp_dir();
    let _ = std::fs::remove_file(temp_dir.join(format!("minuta_{}.mp3", id)));
    let mut i = 0u32;
    loop {
        let mp3 = temp_dir.join(format!("minuta_{}_chunk_{:03}.mp3", id, i));
        let txt = temp_dir.join(format!("minuta_{}_chunk_{:03}.txt", id, i));
        let had_any = mp3.exists() || txt.exists();
        if !had_any {
            break;
        }
        let _ = std::fs::remove_file(&mp3);
        let _ = std::fs::remove_file(&txt);
        i += 1;
    }
}

fn get_api_key(app: &AppHandle) -> Result<String, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store
        .get(API_KEY_KEY)
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .ok_or_else(|| "Configure sua chave OpenRouter antes de transcrever".to_string())
}

#[tauri::command]
pub async fn transcribe_audio(
    file_path: String,
    model: String,
    app: AppHandle,
    state: State<'_, TranscribeState>,
) -> Result<String, String> {
    let key = get_api_key(&app)?;

    let src = Path::new(&file_path);
    if std::fs::metadata(src).map(|m| m.len()).unwrap_or(0) > 500 * 1024 * 1024 {
        return Err("Arquivo muito grande. O limite é 500MB".to_string());
    }

    let ffmpeg = find_ffmpeg()?;
    let id = session_id();
    let mp3_path = std::env::temp_dir().join(format!("minuta_{}.mp3", id));

    // Passo 1: extrair áudio
    if let Err(e) = extract_to_mp3(&ffmpeg, &file_path, &mp3_path) {
        cleanup_session(id);
        return Err(e);
    }

    let mp3_size = std::fs::metadata(&mp3_path).map(|m| m.len()).unwrap_or(0);

    // Passo 2: decidir se divide ou envia direto
    let chunks: Vec<PathBuf> = if mp3_size <= CHUNK_SIZE_LIMIT {
        vec![mp3_path.clone()]
    } else {
        match split_into_chunks(&ffmpeg, &mp3_path, id) {
            Ok(c) => c,
            Err(e) => {
                cleanup_session(id);
                return Err(e);
            }
        }
    };

    let total_chunks = chunks.len() as u32;

    // Passo 3: transcrever (com retry por chunk + cache .txt)
    match transcribe_chunks(&chunks, id, &model, &key).await {
        Ok(texts) => {
            cleanup_session(id);
            if let Ok(mut g) = state.0.lock() {
                *g = None;
            }
            Ok(texts.join("\n\n"))
        }
        Err(msg) => {
            // NÃO limpar — chunks e caches .txt ficam em disco para resume.
            if let Ok(mut g) = state.0.lock() {
                *g = Some(ResumeInfo {
                    session_id: id,
                    model: model.clone(),
                    total_chunks,
                });
            }
            Err(msg)
        }
    }
}

#[tauri::command]
pub async fn resume_last_transcription(
    app: AppHandle,
    state: State<'_, TranscribeState>,
) -> Result<String, String> {
    let info = {
        let guard = state.0.lock().map_err(|e| e.to_string())?;
        guard
            .clone()
            .ok_or_else(|| "Nenhuma transcrição para retomar".to_string())?
    };

    let key = get_api_key(&app)?;

    // Reconstrói a lista de chunks. Se o split chegou a rodar, os _chunk_NNN.mp3
    // existem. Se não, o "chunk único" é o minuta_{id}.mp3 do passo de extração.
    let mut chunks = locate_chunks(info.session_id);
    if chunks.is_empty() {
        let single = std::env::temp_dir().join(format!("minuta_{}.mp3", info.session_id));
        if single.exists() {
            chunks.push(single);
        }
    }

    // Sanity check: chunks ausentes só podem ser pulados se há .txt no cache.
    for i in 0..info.total_chunks {
        let has_mp3 = chunks.get(i as usize).map(|p| p.exists()).unwrap_or(false);
        let has_cache = chunk_text_cache(info.session_id, i).exists();
        if !has_mp3 && !has_cache {
            return Err(format!(
                "Chunk {} desapareceu de %TEMP%. Faça upload do arquivo novamente.",
                i
            ));
        }
    }

    match transcribe_chunks(&chunks, info.session_id, &info.model, &key).await {
        Ok(texts) => {
            cleanup_session(info.session_id);
            if let Ok(mut g) = state.0.lock() {
                *g = None;
            }
            Ok(texts.join("\n\n"))
        }
        Err(msg) => Err(msg),
    }
}

#[tauri::command]
pub fn clear_resume_state(state: State<'_, TranscribeState>) -> Result<(), String> {
    let info = {
        let mut guard = state.0.lock().map_err(|e| e.to_string())?;
        guard.take()
    };
    if let Some(info) = info {
        cleanup_session(info.session_id);
    }
    Ok(())
}

#[tauri::command]
pub fn has_resume_state(state: State<'_, TranscribeState>) -> Result<bool, String> {
    let guard = state.0.lock().map_err(|e| e.to_string())?;
    Ok(guard.is_some())
}

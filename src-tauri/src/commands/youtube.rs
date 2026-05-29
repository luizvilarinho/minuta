use tauri::{AppHandle, Manager};

use super::transcribe::{silent_command, transcribe_path};

// Valida que a URL é um link do YouTube reconhecível e contém um ID de vídeo plausível.
// O ID em si não é usado — a URL bruta é repassada ao yt-dlp; isto só rejeita lixo
// antes de invocar o processo externo.
fn validate_youtube_url(url: &str) -> Result<(), String> {
    let url = url.trim();

    if let Some(rest) = url
        .strip_prefix("https://youtu.be/")
        .or_else(|| url.strip_prefix("http://youtu.be/"))
    {
        let id = rest
            .split('?')
            .next()
            .unwrap_or("")
            .split('/')
            .next()
            .unwrap_or("");
        return validate_video_id(id);
    }

    if let Some(idx) = url.find("/shorts/") {
        let rest = &url[idx + "/shorts/".len()..];
        let id = rest
            .split('?')
            .next()
            .unwrap_or("")
            .split('/')
            .next()
            .unwrap_or("");
        return validate_video_id(id);
    }

    if url.contains("youtube.com") {
        if let Some(v_pos) = url.find("v=") {
            let rest = &url[v_pos + 2..];
            let id = rest
                .split('&')
                .next()
                .unwrap_or("")
                .split('#')
                .next()
                .unwrap_or("");
            return validate_video_id(id);
        }
    }

    Err("URL inválida. Cole um link do YouTube válido.".to_string())
}

fn validate_video_id(id: &str) -> Result<(), String> {
    if id.len() != 11
        || !id
            .chars()
            .all(|c| c.is_alphanumeric() || c == '_' || c == '-')
    {
        return Err("URL inválida. Cole um link do YouTube válido.".to_string());
    }
    Ok(())
}

// Resolve o caminho do binário yt-dlp empacotado como sidecar.
// O Tauri empacota o executável com o target triple no nome, dentro de resource_dir.
// Em dev, o resource_dir aponta para a raiz do crate, então também tentamos a pasta `binaries`.
fn resolve_yt_dlp(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    // O app é Windows-only por enquanto: o sidecar empacotado é o .exe com o triple MSVC.
    #[cfg(windows)]
    let triple_name = "yt-dlp-x86_64-pc-windows-msvc.exe";
    #[cfg(not(windows))]
    compile_error!(
        "resolve_yt_dlp só suporta Windows hoje; defina o triple correto antes de portar."
    );

    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;

    let candidates = [
        resource_dir.join(triple_name),
        resource_dir.join("binaries").join(triple_name),
        resource_dir.join("binaries").join("yt-dlp.exe"),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return Ok(candidate.clone());
        }
    }

    // Fallback para desenvolvimento: src-tauri/binaries relativo ao CARGO_MANIFEST_DIR.
    let dev_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join(triple_name);
    if dev_path.exists() {
        return Ok(dev_path);
    }

    Err("Binário yt-dlp não encontrado.".to_string())
}

// Garante a remoção do arquivo de áudio temporário mesmo em caso de erro/early-return.
struct TempAudio {
    path: std::path::PathBuf,
}

impl Drop for TempAudio {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

#[tauri::command]
pub async fn fetch_youtube_transcript(
    app: AppHandle,
    url: String,
    model: String,
) -> Result<String, String> {
    validate_youtube_url(&url)?;

    if model.trim().is_empty() {
        return Err("Selecione um modelo de transcrição".to_string());
    }

    let yt_dlp = resolve_yt_dlp(&app)?;

    let id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let base = std::env::temp_dir().join(format!("minuta_yt_{}", id));
    let output_template = format!("{}.%(ext)s", base.to_string_lossy());

    let yt_dlp_str = yt_dlp.to_string_lossy().to_string();
    let url_clone = url.clone();
    let output_template_clone = output_template.clone();

    // Clientes android e mweb contornam o requisito de PO Token do YouTube.
    // Baixa o melhor áudio disponível sem conversão (sem ffmpeg).
    // m4a e webm/opus são aceitos diretamente pelo Whisper via OpenRouter.
    let download = tokio::task::spawn_blocking(move || {
        silent_command(&yt_dlp_str)
            .args([
                "--format",
                "bestaudio*",
                "--no-playlist",
                "--extractor-args",
                "youtube:player_client=android,mweb",
                "-o",
                &output_template_clone,
                &url_clone,
            ])
            .output()
            .map_err(|e| format!("Erro ao executar yt-dlp: {}", e))
    })
    .await
    .map_err(|e| format!("Falha na tarefa de download: {}", e))??;

    if !download.status.success() {
        let stderr = String::from_utf8_lossy(&download.stderr);
        return Err(format!(
            "Erro ao baixar o áudio do YouTube: {}",
            stderr.trim()
        ));
    }

    // A extensão do arquivo varia conforme o stream disponível (m4a, webm, etc.).
    let audio_path = ["m4a", "webm", "opus", "ogg", "mp4"]
        .iter()
        .map(|ext| base.with_extension(ext))
        .find(|p| p.exists())
        .ok_or_else(|| "yt-dlp não gerou o arquivo de áudio esperado.".to_string())?;

    let _guard = TempAudio {
        path: audio_path.clone(),
    };

    transcribe_path(&app, &audio_path.to_string_lossy(), &model).await
}

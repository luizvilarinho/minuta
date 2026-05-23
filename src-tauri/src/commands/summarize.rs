use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "settings.json";
const API_KEY_KEY: &str = "openrouter_api_key";

#[tauri::command]
pub async fn generate_summary(
    transcription: String,
    model: String,
    system_prompt: String,
    app: AppHandle,
) -> Result<String, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let key = store
        .get(API_KEY_KEY)
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .ok_or_else(|| "Chave OpenRouter não configurada".to_string())?;

    let body = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": transcription }
        ]
    });

    let client = reqwest::Client::new();
    let response = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Erro ao gerar resumo: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Erro ao gerar resumo: {} — {}", status, body));
    }

    #[derive(serde::Deserialize)]
    struct Message {
        content: String,
    }
    #[derive(serde::Deserialize)]
    struct Choice {
        message: Message,
    }
    #[derive(serde::Deserialize)]
    struct ChatResponse {
        choices: Vec<Choice>,
    }

    let result: ChatResponse = response
        .json()
        .await
        .map_err(|e| format!("Erro ao processar resposta: {}", e))?;

    let content = result
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content)
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| "O modelo não retornou conteúdo. Tente novamente ou escolha outro modelo".to_string())?;

    Ok(content)
}

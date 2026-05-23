use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "settings.json";
const API_KEY_KEY: &str = "openrouter_api_key";

#[derive(Serialize, Deserialize, Clone)]
pub struct ModelArchitecture {
    pub modality: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct OpenRouterModel {
    pub id: String,
    pub name: String,
    pub architecture: Option<ModelArchitecture>,
}

async fn fetch_models_from_url(url: &str, key: &str) -> Result<Vec<OpenRouterModel>, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(url)
        .header("Authorization", format!("Bearer {}", key))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Erro na API: {}", response.status()));
    }

    let raw: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let data = raw["data"]
        .as_array()
        .or_else(|| raw.as_array())
        .ok_or_else(|| "Resposta inesperada da API".to_string())?;

    let models = data
        .iter()
        .filter_map(|item| {
            let id = item["id"].as_str()?.to_string();
            let name = item["name"].as_str().unwrap_or(&id).to_string();
            let modality = item["architecture"]["modality"]
                .as_str()
                .map(|s| s.to_string());
            Some(OpenRouterModel {
                id,
                name,
                architecture: Some(ModelArchitecture { modality }),
            })
        })
        .collect();

    Ok(models)
}

fn get_api_key_from_store(app: &AppHandle) -> Result<String, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store
        .get(API_KEY_KEY)
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .ok_or_else(|| "Chave OpenRouter não configurada".to_string())
}

// Retorna modelos de texto (usados no dropdown de resumo)
#[tauri::command]
pub async fn fetch_models(app: AppHandle) -> Result<Vec<OpenRouterModel>, String> {
    let key = get_api_key_from_store(&app)?;
    fetch_models_from_url("https://openrouter.ai/api/v1/models?output_modalities=text", &key).await
}

// Retorna apenas modelos de transcrição de áudio
#[tauri::command]
pub async fn fetch_transcription_models(app: AppHandle) -> Result<Vec<OpenRouterModel>, String> {
    let key = get_api_key_from_store(&app)?;
    fetch_models_from_url(
        "https://openrouter.ai/api/v1/models?input_modalities=video&output_modalities=transcription",
        &key,
    )
    .await
}

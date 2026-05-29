use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "settings.json";
const API_KEY_KEY: &str = "openrouter_api_key";

#[tauri::command]
pub async fn save_api_key(key: String, app: AppHandle) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(API_KEY_KEY, serde_json::Value::String(key));
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_api_key(app: AppHandle) -> Result<Option<String>, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let key = store
        .get(API_KEY_KEY)
        .and_then(|v| v.as_str().map(|s| s.to_string()));
    Ok(key)
}

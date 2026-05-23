use chrono::Local;

#[tauri::command]
pub async fn save_meeting(
    base_path: String,
    transcription: String,
    summary: String,
) -> Result<String, String> {
    let folder_name = Local::now().format("%d-%m-%Y_%H-%M-%S").to_string();
    let output_path = std::path::Path::new(&base_path).join(&folder_name);

    std::fs::create_dir_all(&output_path).map_err(|e| {
        if e.kind() == std::io::ErrorKind::PermissionDenied {
            "Sem permissão para salvar nesta pasta. Escolha outro local".to_string()
        } else {
            format!("Erro ao salvar: {}", e)
        }
    })?;

    let transcricao_content = format!("# Transcrição\n\n{}", transcription);
    let resumo_content = format!("# Resumo da Reunião\n\n{}", summary);

    std::fs::write(output_path.join("transcricao.md"), transcricao_content)
        .map_err(|e| format!("Erro ao salvar: {}", e))?;

    std::fs::write(output_path.join("resumo.md"), resumo_content)
        .map_err(|e| format!("Erro ao salvar: {}", e))?;

    Ok(output_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

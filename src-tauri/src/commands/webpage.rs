#[tauri::command]
pub async fn fetch_webpage_text(url: String) -> Result<String, String> {
    let url = url.trim().to_string();

    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("URL inválida. A URL deve começar com http:// ou https://".to_string());
    }

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Erro ao criar cliente HTTP: {}", e))?;

    let response = client
        .get(&url)
        .header(reqwest::header::USER_AGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .send()
        .await
        .map_err(|e| format!("Erro ao acessar a URL: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "HTTP {}: a URL retornou um status de erro",
            response.status()
        ));
    }

    let html = response
        .text()
        .await
        .map_err(|e| format!("Erro ao ler o conteúdo da página: {}", e))?;

    let text = tokio::task::spawn_blocking(move || {
        let mut readability = dom_smoothie::Readability::new(html, Some(&url), None)
            .map_err(|e| format!("Erro ao processar o HTML: {}", e))?;
        let article = readability
            .parse()
            .map_err(|e| format!("Erro ao extrair conteúdo da página: {}", e))?;
        Ok::<String, String>(article.text_content.to_string())
    })
    .await
    .map_err(|e| format!("Falha na extração de texto: {}", e))??;

    Ok(text)
}

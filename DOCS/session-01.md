# Minuta — Sessão 01: Setup do Projeto + Tela de Settings

> Leia o `minuta-context.md` antes de começar. Não implemente nada além do descrito nesta sessão.

---

## Objetivo desta sessão

Criar o projeto do zero com Tauri 2.0 e entregar a tela de Settings funcional com a chave do OpenRouter sendo salva e recuperada corretamente.

---

## Entregável

Ao final desta sessão deve ser possível:
- Rodar o app com `cargo tauri dev`
- Ver a tela principal (placeholder) e abrir o painel de Settings
- Digitar uma chave do OpenRouter, salvar, fechar e reabrir o app — a chave deve persistir
- Ver feedback visual de sucesso ao salvar a chave

---

## Passo a passo

### 1. Inicializar o projeto

```bash
npm create tauri-app@latest minuta -- --template react-ts
cd minuta
npm install
```

Instalar dependências adicionais:
```bash
npm install tailwindcss @tailwindcss/vite
cargo add tauri-plugin-store
```

Configurar Tailwind CSS para Tauri (seguir documentação oficial do Tauri 2.0 com Vite).

---

### 2. Configurar `tauri.conf.json`

Permissões necessárias nesta sessão:
- `store:allow-get`
- `store:allow-set`
- `store:allow-save`

Identificador do app: `com.minuta.app`
Título da janela: `Minuta`
Tamanho inicial: `1000 x 700`
Redimensionável: `true`
Tamanho mínimo: `800 x 600`

---

### 3. Backend Rust — `settings.rs`

Criar os seguintes Tauri commands:

```rust
// Salva a chave da API no store
#[tauri::command]
async fn save_api_key(key: String, app: AppHandle) -> Result<(), String>

// Recupera a chave da API do store
#[tauri::command]
async fn get_api_key(app: AppHandle) -> Result<Option<String>, String>
```

- Usar `tauri-plugin-store` com arquivo de store chamado `settings.json`
- A chave é salva sob o nome `openrouter_api_key`
- Nunca retornar a chave completa para o frontend em texto plano na exibição — apenas confirmar se existe ou não. A chave é recuperada pelo backend quando precisar fazer chamadas de API.

> **Exceção controlada:** o command `get_api_key` pode retornar a chave para o frontend apenas para preencher o campo de input no Settings (para o usuário poder editá-la). Mascarar na exibição com input type="password".

---

### 4. Frontend — componente `Settings.tsx`

Painel lateral ou modal que contém:

- Campo `input type="password"` para a chave OpenRouter
- Botão **Salvar**
- Feedback: `"Chave salva com sucesso"` em verde, ou mensagem de erro em vermelho
- Ao abrir o Settings, carregar a chave existente (se houver) para preencher o campo

O painel de Settings é acessado por um **ícone de engrenagem** fixo no canto superior direito da janela.

---

### 5. Frontend — `App.tsx`

Estrutura base do app com:
- Header com título `Minuta` e ícone de Settings
- Área central com placeholder: `"Carregue um arquivo MP4 ou uma transcrição para começar"`
- Tema escuro aplicado via Tailwind (fundo `#0f0f0f` ou similar, texto claro)

---

### 6. Registrar commands no `main.rs`

```rust
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            save_api_key,
            get_api_key,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## O que NÃO fazer nesta sessão

- Não implementar upload de arquivos
- Não implementar chamadas ao OpenRouter
- Não implementar dropdowns de modelos
- Não implementar transcrição ou resumo
- Não implementar lógica de salvar arquivos

---

## Checklist de conclusão

- [ ] `cargo tauri dev` roda sem erros
- [ ] App abre com tema escuro
- [ ] Ícone de Settings visível e clicável
- [ ] Campo de chave com máscara (type="password")
- [ ] Salvar chave persiste entre sessões (fechar e reabrir o app)
- [ ] Feedback visual ao salvar

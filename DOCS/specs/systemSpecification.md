# Minuta — Contexto Geral do Projeto

> Este arquivo deve ser passado para todos os agentes junto com a spec da sessão correspondente.

---

## O que é o Minuta

App desktop Windows para transcrição e resumo de reuniões. O usuário carrega um arquivo MP4 (ou uma transcrição existente em TXT/MD), escolhe os modelos via OpenRouter, gera a transcrição e o resumo estruturado, e salva tudo em pasta local.

---

## Stack

- **Desktop:** Tauri 2.0
- **Frontend:** React + TypeScript + Vite
- **Backend:** Rust (Tauri commands)
- **Estilo:** Tailwind CSS
- **Armazenamento:** `tauri-plugin-store` para chave da API
- **HTTP frontend:** `fetch` nativo
- **HTTP backend:** `reqwest` (Rust) — todas as chamadas com a chave da API passam pelo backend Rust, nunca pelo frontend

---

## Estrutura de pastas

```
minuta/
├── src/
│   ├── components/
│   │   ├── Settings.tsx
│   │   ├── FileUpload.tsx
│   │   ├── ModelSelector.tsx
│   │   ├── TranscriptionView.tsx
│   │   ├── SummaryView.tsx
│   │   └── SaveButton.tsx
│   ├── hooks/
│   │   └── useOpenRouter.ts
│   ├── App.tsx
│   └── main.tsx
├── src-tauri/
│   ├── src/
│   │   ├── main.rs
│   │   ├── commands/
│   │   │   ├── transcribe.rs
│   │   │   ├── summarize.rs
│   │   │   ├── save_files.rs
│   │   │   └── settings.rs
│   │   └── audio.rs
│   └── tauri.conf.json
├── package.json
└── README.md
```

---

## Fluxo completo do app

```
[Settings] — chave OpenRouter salva uma vez

[Tela principal]
  ├── Upload MP4 → transcrição via OpenRouter → texto editável
  └── Upload TXT/MD → carrega texto diretamente

[Resumo]
  ├── Escolhe modelo de resumo
  ├── System prompt default (expansível)
  ├── Campo prompt adicional + toggle (somar / substituir)
  └── Gera resumo → texto editável

[Salvar]
  └── Pasta base escolhida pelo usuário
       └── Subpasta YYYY-MM-DD_HH-MM/
            ├── transcricao.md
            └── resumo.md
```

---

## Regras que todos os agentes devem seguir

1. **Não modificar o que já está funcionando** — cada sessão adiciona funcionalidade, nunca quebra a anterior
2. **Chave da API nunca passa pelo frontend** — toda chamada autenticada ao OpenRouter é feita via Tauri command no backend Rust
3. **Idioma de transcrição fixo:** `pt` (PT-BR) — sem opção de configurar
4. **Sem persistência de prompt adicional** — o campo de prompt customizado reseta ao fechar o app
5. **Sem histórico de reuniões** — o app não guarda registro de sessões anteriores
6. **Tema escuro** como padrão visual
7. **Fontes monoespaçadas** nas áreas de transcrição e resumo
8. Sempre exibir **estado de loading** durante chamadas de API com mensagem descritiva
9. Sempre exibir **mensagem de erro clara** quando a API retornar falha

---

## API OpenRouter — referência

### Listar modelos
```
GET https://openrouter.ai/api/v1/models
Headers:
  Authorization: Bearer {chave}
```

### Transcrição
```
POST https://openrouter.ai/api/v1/audio/transcriptions
Headers:
  Authorization: Bearer {chave}
  Content-Type: multipart/form-data
Body:
  file: <arquivo de áudio>
  model: <modelo escolhido>
  language: pt
```

### Resumo
```
POST https://openrouter.ai/api/v1/chat/completions
Headers:
  Authorization: Bearer {chave}
  Content-Type: application/json
Body:
  model: <modelo escolhido>
  messages:
    - role: system
      content: <system prompt resolvido>
    - role: user
      content: <transcrição>
```

---

## Fora do escopo do MVP

- Histórico de reuniões
- Sincronização com serviços externos (Notion, Drive etc.)
- Múltiplos idiomas
- Templates de prompt salvos
- Suporte a macOS ou Linux

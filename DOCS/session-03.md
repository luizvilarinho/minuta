# Minuta — Sessão 03: Upload de Arquivo + Transcrição

> Leia o `minuta-context.md` antes de começar. As sessões 01 e 02 devem estar concluídas e funcionando. Não modifique nada do que já foi implementado.

---

## Objetivo desta sessão

Implementar os dois pontos de entrada do app: upload de MP4 (com transcrição via OpenRouter) e upload de TXT/MD (carregamento direto). O resultado deve aparecer em área de texto editável.

---

## Entregável

Ao final desta sessão deve ser possível:
- Arrastar ou selecionar um arquivo MP4 e transcrever usando o modelo escolhido no dropdown
- Arrastar ou selecionar um arquivo TXT ou MD e ver o conteúdo carregado na área de texto
- Editar o texto da transcrição antes de prosseguir
- Ver estados de loading e erro durante a transcrição

---

## Passo a passo

### 1. Verificar suporte a MP4 direto no OpenRouter

Antes de implementar extração de áudio, **testar** se a API de transcrição do OpenRouter aceita MP4 diretamente:

```
POST https://openrouter.ai/api/v1/audio/transcriptions
Body (multipart/form-data):
  file: arquivo.mp4
  model: <modelo de transcrição disponível>
  language: pt
```

**Se aceitar MP4 direto:** enviar o arquivo sem extração. Implementação mais simples.

**Se não aceitar MP4 direto:** extrair o áudio usando `ffmpeg`. Ver seção de fallback abaixo.

---

### 2. Backend Rust — `commands/transcribe.rs`

```rust
#[tauri::command]
async fn transcribe_audio(
    file_path: String,
    model: String,
    app: AppHandle,
) -> Result<String, String>
```

Fluxo:
1. Recuperar chave do OpenRouter do store
2. Ler o arquivo do caminho recebido
3. Enviar para `POST https://openrouter.ai/api/v1/audio/transcriptions` como `multipart/form-data`
   - `file`: bytes do arquivo
   - `model`: modelo recebido
   - `language`: `"pt"` (fixo)
4. Retornar o texto transcrito

Resposta esperada da API:
```json
{ "text": "transcrição aqui..." }
```

---

### 3. Fallback — extração de áudio com ffmpeg (se necessário)

Se o OpenRouter não aceitar MP4 direto, implementar em `audio.rs`:

```rust
pub fn extract_audio_from_mp4(input_path: &str) -> Result<PathBuf, String>
```

- Usar chamada ao binário `ffmpeg` via `std::process::Command`
- Converter para `.mp3` (128kbps)
- Salvar em diretório temporário do sistema (`std::env::temp_dir()`)
- Retornar o caminho do arquivo gerado
- O arquivo temporário deve ser deletado após o envio

Para desenvolvimento, o `ffmpeg` pode estar no PATH. Para distribuição, avaliar empacotamento — deixar como TODO comentado no código.

---

### 4. Componente `FileUpload.tsx`

Área de drag-and-drop com:
- Texto: `"Arraste um arquivo MP4 ou transcrição (TXT, MD)"`
- Ícone de upload
- Ao clicar: abre diálogo de seleção de arquivo via Tauri dialog (`open()`)
- Filtros do diálogo:
  - `{ name: "Vídeo", extensions: ["mp4"] }`
  - `{ name: "Transcrição", extensions: ["txt", "md"] }`

Comportamento por tipo de arquivo:
- **MP4:** chama command `transcribe_audio` com o caminho do arquivo e modelo selecionado
- **TXT/MD:** lê o conteúdo do arquivo via Tauri `readTextFile` e carrega direto na área de texto

Instalar plugin necessário:
```bash
cargo add tauri-plugin-dialog
cargo add tauri-plugin-fs
```

Adicionar ao `tauri.conf.json`:
```json
"permissions": [
  "dialog:allow-open",
  "fs:allow-read-file",
  "fs:scope-app-data"
]
```

---

### 5. Componente `TranscriptionView.tsx`

Props:
```typescript
interface TranscriptionViewProps {
  text: string
  onChange: (text: string) => void
  isLoading: boolean
}
```

- `textarea` de altura generosa (mínimo 300px), rolável
- Fonte monoespaçada (ex: `font-mono`)
- Placeholder: `"A transcrição aparecerá aqui..."`
- Editável pelo usuário
- Durante loading: textarea desabilitada + spinner + mensagem `"Transcrevendo... isso pode levar alguns instantes"`
- Contador de caracteres no rodapé da área (ex: `"4.231 caracteres"`)

---

### 6. Atualizar `App.tsx`

Estado adicionado:
```typescript
const [transcription, setTranscription] = useState<string>("")
const [isTranscribing, setIsTranscribing] = useState<boolean>(false)
const [transcriptionError, setTranscriptionError] = useState<string | null>(null)
```

Fluxo:
1. Usuário faz upload → `isTranscribing = true`
2. Command retorna → `transcription = resultado`, `isTranscribing = false`
3. Em caso de erro → `transcriptionError = mensagem`, `isTranscribing = false`

Exibir `TranscriptionView` logo abaixo do `FileUpload`.

---

### 7. Registrar novos commands no `main.rs`

Adicionar ao `invoke_handler`:
- `transcribe_audio`

Adicionar plugins ao builder:
- `tauri_plugin_dialog`
- `tauri_plugin_fs`

---

## Tratamento de erros

| Situação | Mensagem exibida |
|----------|-----------------|
| Chave não configurada | "Configure sua chave OpenRouter antes de transcrever" |
| Modelo não selecionado | "Selecione um modelo de transcrição" |
| Arquivo muito grande (>500MB) | "Arquivo muito grande. O limite é 500MB" |
| Erro na API (4xx/5xx) | "Erro ao transcrever: " + mensagem da API |
| ffmpeg não encontrado | "ffmpeg não encontrado. Instale o ffmpeg e adicione ao PATH" |
| Timeout | "A transcrição demorou demais. Tente novamente" |

---

## O que NÃO fazer nesta sessão

- Não implementar a geração de resumo
- Não implementar o system prompt ou campo de prompt adicional
- Não implementar o botão de salvar

---

## Checklist de conclusão

- [ ] Upload de MP4 funciona e retorna transcrição em PT-BR
- [ ] Upload de TXT/MD carrega o conteúdo na área de texto
- [ ] Área de texto é editável após carregamento
- [ ] Loading visível durante a transcrição
- [ ] Erros exibidos com mensagem clara
- [ ] Contador de caracteres funcionando
- [ ] Sem erros de console

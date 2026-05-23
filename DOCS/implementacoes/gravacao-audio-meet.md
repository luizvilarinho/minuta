# Gravação de Áudio de Reuniões (Google Meet / qualquer plataforma)

## Objetivo

Permitir que o usuário grave o áudio de uma reunião diretamente pelo Minuta, sem precisar exportar um MP4 manualmente. O resultado é um arquivo MP3 que entra no pipeline de transcrição já existente, sem nenhuma alteração nele.

---

## Abordagem: WASAPI Loopback + Microfone misturados

### Por que essa abordagem

- Funciona em qualquer Windows 10/11 sem instalar software adicional
- Não depende de "Stereo Mix" (desativado por padrão na maioria dos sistemas)
- Captura **todos os participantes**: voz dos remotos via loopback + voz local via microfone
- O MP3 gerado é idêntico ao que o usuário faria upload manualmente — zero mudança no pipeline existente

---

## Como funciona

```
[Reunião no browser]
        │
        ├── WASAPI Loopback ──┐
        │   (voz dos outros)  │
        │                     ├─► Mix em tempo real ──► WAV temp ──► ffmpeg ──► MP3
        └── WASAPI Mic Input ─┘
            (voz do usuário)
```

1. Dois streams WASAPI abertos simultaneamente: loopback (output device) e microfone (input device)
2. Os buffers chegam em callbacks separados; são misturados (somados com clamp) e escritos num arquivo WAV temporário
3. Ao parar, o WAV é convertido para MP3 via o ffmpeg já existente no projeto (`find_ffmpeg()` em `transcribe.rs`)
4. O MP3 é carregado no estado do app como se tivesse sido feito upload pelo usuário

---

## Crates necessários

```toml
# src-tauri/Cargo.toml
wasapi = "0.15"   # bindings WASAPI com suporte explícito a loopback
hound = "3.5"     # escrita de arquivo WAV
```

---

## Estrutura de arquivos novos

```
src-tauri/src/
└── commands/
    └── record.rs     ← novo: start_recording / stop_recording
```

`lib.rs` (ou `main.rs`) precisa registrar os dois novos commands no `invoke_handler`.

---

## Contrato dos Tauri Commands

### `start_recording() -> Result<(), String>`

- Valida que não há gravação em curso
- Descobre o output device padrão e o input device padrão via WASAPI
- Abre stream loopback no output device (flag `AUDCLNT_STREAMFLAGS_LOOPBACK`)
- Abre stream normal no input device
- Cria arquivo WAV temporário em `%TEMP%\minuta_recording.wav`
- Lança thread de captura; guarda handle em estado global (`Mutex<Option<RecordingHandle>>`)

### `stop_recording() -> Result<String, String>`

- Sinaliza a thread de captura para parar (via `AtomicBool` ou channel)
- Aguarda a thread encerrar e fechar o WAV
- Chama `find_ffmpeg()` e converte WAV → MP3:
  ```
  ffmpeg -i %TEMP%\minuta_recording.wav -codec:a libmp3lame -q:a 4 -ar 16000 -ac 1 %TEMP%\minuta_recording.mp3
  ```
- Apaga o WAV temporário
- Retorna o caminho do MP3

---

## Estado global no backend Rust

```rust
struct RecordingHandle {
    stop_flag: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
    wav_path: PathBuf,
}

// registrado via manage() no builder do Tauri
struct RecordingState(Mutex<Option<RecordingHandle>>);
```

---

## Mixing dos dois streams

O ponto técnico mais sensível é que loopback e microfone podem ter sample rates diferentes (48 kHz vs 44.1 kHz). Duas opções:

**Opção A — Delegar ao ffmpeg (recomendada para simplicidade):**
Gravar os dois streams em arquivos WAV separados (`minuta_loopback.wav` e `minuta_mic.wav`) e na etapa de conversão usar o ffmpeg para misturar e reamostrar:
```
ffmpeg -i minuta_loopback.wav -i minuta_mic.wav \
  -filter_complex "[0:a][1:a]amix=inputs=2:duration=longest" \
  -codec:a libmp3lame -q:a 4 -ar 16000 -ac 1 \
  minuta_recording.mp3
```

**Opção B — Mixing manual em Rust:**
Forçar ambos os streams para um sample rate comum (ex: 16 kHz, mono) via WASAPI `IAudioClient::Initialize` com formato explícito, e misturar os buffers diretamente antes de escrever no WAV. Mais complexo, sem dependência de ffmpeg para o merge.

**Recomendação:** Opção A para a primeira implementação.

---

## Alterações no frontend

### Novos estados em `App.tsx`

```typescript
const [isRecording, setIsRecording] = useState(false);
const [recordingSeconds, setRecordingSeconds] = useState(0);
```

### Botão de gravação

```tsx
<button onClick={isRecording ? handleStopRecording : handleStartRecording}>
  {isRecording ? `Parar (${formatDuration(recordingSeconds)})` : 'Gravar Reunião'}
</button>
```

### Handlers

```typescript
async function handleStartRecording() {
  await invoke('start_recording');
  setIsRecording(true);
  // inicia contador de segundos com setInterval
}

async function handleStopRecording() {
  const mp3Path: string = await invoke('stop_recording');
  setIsRecording(false);
  // carrega mp3Path no estado de arquivo, igual ao FileUpload faria
  setSelectedFile({ path: mp3Path, name: 'gravacao.mp3' });
}
```

---

## Fluxo completo após implementação

```
[Clica "Gravar Reunião"]
  → start_recording: abre WASAPI loopback + mic

[Conduz a reunião normalmente no browser]

[Clica "Parar"]
  → stop_recording: fecha streams, WAV×2 → MP3 via ffmpeg
  → MP3 carregado automaticamente no app

[Fluxo normal já existente]
  → Escolhe modelo de transcrição → Transcreve → Resume → Salva
```

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Device padrão muda durante a gravação | Abrir os devices no início e manter fixos até `stop_recording` |
| App fechado durante gravação | Cleanup no `on_window_event(CloseRequested)` chamando stop e apagando temps |
| WAV muito grande (reunião longa) | MP3 final com `-q:a 4 -ar 16000 -ac 1` fica ~60 MB/hora; pipeline de chunks já lida com isso |
| Usuário sem microfone conectado | `stop_recording` funciona mesmo com só o loopback; gravar aviso no log |

---

## O que NÃO muda

- `transcribe.rs` — inalterado
- `summarize.rs` — inalterado
- `save_files.rs` — inalterado
- `settings.rs` — inalterado
- Componentes `TranscriptionView`, `SummaryView`, `SaveButton` — inalterados
- Formato de API para OpenRouter — inalterado

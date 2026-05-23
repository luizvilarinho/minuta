# Minuta — Sessão 05: Salvar Resultado em Pasta Local

> Leia o `minuta-context.md` antes de começar. As sessões 01, 02, 03 e 04 devem estar concluídas e funcionando. Não modifique nada do que já foi implementado.

---

## Objetivo desta sessão

Implementar o botão de salvar: o usuário escolhe uma pasta base, o app cria uma subpasta com data e hora, e salva `transcricao.md` e `resumo.md` dentro dela.

---

## Entregável

Ao final desta sessão o app está completo e funcional:
- Botão "Salvar" disponível após gerar o resumo
- Diálogo de seleção de pasta base
- Criação automática de subpasta `YYYY-MM-DD_HH-MM`
- Dois arquivos salvos: `transcricao.md` e `resumo.md`
- Confirmação com o caminho completo onde foi salvo
- App totalmente funcional de ponta a ponta

---

## Passo a passo

### 1. Backend Rust — `commands/save_files.rs`

```rust
#[tauri::command]
async fn save_meeting(
    base_path: String,
    transcription: String,
    summary: String,
) -> Result<String, String>
```

Fluxo:
1. Gerar nome da subpasta com data e hora atual: `YYYY-MM-DD_HH-MM`
   - Usar crate `chrono` para formatar a data: `chrono::Local::now().format("%Y-%m-%d_%H-%M")`
2. Criar o caminho completo: `{base_path}/{YYYY-MM-DD_HH-MM}/`
3. Criar a pasta com `std::fs::create_dir_all`
4. Salvar `transcricao.md` com o conteúdo da transcrição
5. Salvar `resumo.md` com o conteúdo do resumo
6. Retornar o caminho completo da pasta criada (para exibir na confirmação)

Adicionar ao `Cargo.toml`:
```toml
chrono = { version = "0.4", features = ["local-offset"] }
```

---

### 2. Frontend — seleção de pasta

Usar o diálogo do Tauri para seleção de pasta (já instalado na sessão 03):

```typescript
import { open } from "@tauri-apps/plugin-dialog"

const selectFolder = async (): Promise<string | null> => {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Escolha onde salvar a reunião",
  })
  return selected as string | null
}
```

Permissão necessária no `tauri.conf.json` (verificar se já existe, adicionar se não):
```json
"dialog:allow-open"
```

Permissão de escrita no sistema de arquivos:
```json
"fs:allow-write-file",
"fs:allow-create-dir",
"fs:scope-home-recursive"
```

---

### 3. Componente `SaveButton.tsx`

Props:
```typescript
interface SaveButtonProps {
  transcription: string
  summary: string
  disabled: boolean
}
```

Comportamento:
1. Usuário clica em **"Salvar Reunião"**
2. Abre diálogo de seleção de pasta
3. Se o usuário cancelar: não faz nada
4. Se confirmar: chama command `save_meeting`
5. Exibe estado de loading: `"Salvando..."`
6. Sucesso: exibe mensagem com o caminho completo
7. Erro: exibe mensagem de erro

**O botão fica desabilitado se:**
- Não houver transcrição
- Não houver resumo

---

### 4. Mensagem de confirmação

Após salvar com sucesso, exibir um banner ou toast na interface:

```
✓ Reunião salva em: C:\Users\Luiz\Documentos\Reunioes\2025-06-10_14-30
```

Com botão `"Abrir pasta"` que abre o Explorer no caminho salvo:

```rust
#[tauri::command]
async fn open_folder(path: String) -> Result<(), String> {
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

---

### 5. Conteúdo dos arquivos salvos

**`transcricao.md`:**
```markdown
# Transcrição

{conteúdo da área de transcrição}
```

**`resumo.md`:**
```markdown
# Resumo da Reunião

{conteúdo da área de resumo}
```

---

### 6. Atualizar `App.tsx`

Estado adicionado:
```typescript
const [saveStatus, setSaveStatus] = useState<{
  status: "idle" | "saving" | "success" | "error"
  path?: string
  error?: string
}>({ status: "idle" })
```

O `SaveButton` aparece na interface quando `summary.trim().length > 0`.

---

### 7. Registrar novos commands no `main.rs`

Adicionar ao `invoke_handler`:
- `save_meeting`
- `open_folder`

---

## Tratamento de erros

| Situação | Mensagem exibida |
|----------|-----------------|
| Usuário cancelou o diálogo | Silencioso, não faz nada |
| Pasta sem permissão de escrita | "Sem permissão para salvar nesta pasta. Escolha outro local" |
| Disco cheio | "Não foi possível salvar. Verifique o espaço em disco" |
| Erro genérico | "Erro ao salvar: " + mensagem do sistema |

---

## Revisão final do app completo

Após esta sessão, verificar o fluxo completo de ponta a ponta:

1. Abrir o app
2. Configurar chave OpenRouter em Settings
3. Selecionar modelo de transcrição e modelo de resumo
4. Fazer upload de um MP4
5. Aguardar transcrição
6. Editar transcrição se necessário
7. Gerar resumo (com ou sem prompt adicional)
8. Editar resumo se necessário
9. Salvar → escolher pasta → confirmar arquivos criados

---

## O que NÃO fazer nesta sessão

- Não adicionar histórico de reuniões
- Não adicionar sincronização com serviços externos
- Não modificar a lógica de transcrição ou resumo

---

## Checklist de conclusão

- [ ] Botão "Salvar Reunião" aparece após gerar resumo
- [ ] Diálogo de seleção de pasta funciona
- [ ] Subpasta `YYYY-MM-DD_HH-MM` criada corretamente
- [ ] `transcricao.md` salvo com conteúdo correto
- [ ] `resumo.md` salvo com conteúdo correto
- [ ] Mensagem de confirmação com caminho completo
- [ ] Botão "Abrir pasta" abre o Explorer no local correto
- [ ] Erros tratados com mensagem clara
- [ ] Fluxo completo de ponta a ponta funciona sem erros
- [ ] Sem erros de console

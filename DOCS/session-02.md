# Minuta — Sessão 02: Carregamento de Modelos + Dropdowns

> Leia o `minuta-context.md` antes de começar. A sessão 01 deve estar concluída e funcionando. Não modifique nada do que já foi implementado.

---

## Objetivo desta sessão

Carregar a lista de modelos disponíveis no OpenRouter e exibir dois dropdowns na interface: um para o modelo de transcrição e outro para o modelo de resumo.

---

## Entregável

Ao final desta sessão deve ser possível:
- Ver dois dropdowns na tela principal
- Os dropdowns carregam os modelos via API do OpenRouter assim que o app abre (se a chave estiver salva)
- O dropdown de transcrição exibe apenas modelos de áudio
- O dropdown de resumo exibe apenas modelos de texto
- Cada dropdown lembra o último modelo selecionado durante a sessão

---

## Passo a passo

### 1. Backend Rust — `commands/models.rs`

Criar command para buscar modelos:

```rust
#[tauri::command]
async fn fetch_models(app: AppHandle) -> Result<Vec<OpenRouterModel>, String>
```

- Recupera a chave salva internamente via `tauri-plugin-store`
- Faz `GET https://openrouter.ai/api/v1/models` com a chave no header
- Retorna a lista deserializada

Struct de retorno:
```rust
#[derive(Serialize, Deserialize)]
struct OpenRouterModel {
    id: String,
    name: String,
    description: Option<String>,
    context_length: Option<u32>,
    architecture: Option<ModelArchitecture>,
}

#[derive(Serialize, Deserialize)]
struct ModelArchitecture {
    modality: Option<String>, // ex: "text->text", "audio->text"
    // outros campos podem ser ignorados
}
```

---

### 2. Filtragem de modelos

A filtragem é feita no **frontend** após receber a lista completa:

**Modelos de transcrição:**
- `architecture.modality` contém `"audio"` — ex: `"audio->text"`

**Modelos de resumo:**
- `architecture.modality` é `"text->text"` ou `"text+image->text"`
- Excluir modelos com `"audio"` na modality

---

### 3. Hook `useOpenRouter.ts`

Criar hook que encapsula:

```typescript
const { 
  transcriptionModels,  // OpenRouterModel[]
  summaryModels,        // OpenRouterModel[]
  isLoading,            // boolean
  error,                // string | null
  reload,               // () => void
} = useOpenRouter()
```

- Chama `fetch_models` via `invoke` ao montar
- Aplica os filtros de modality
- Expõe estados de loading e erro

---

### 4. Componente `ModelSelector.tsx`

Props:
```typescript
interface ModelSelectorProps {
  label: string           // "Modelo de transcrição" | "Modelo de resumo"
  models: OpenRouterModel[]
  selected: string | null
  onChange: (modelId: string) => void
  isLoading: boolean
  disabled?: boolean
}
```

- Dropdown estilizado com Tailwind, tema escuro
- Estado de loading: exibe `"Carregando modelos..."` desabilitado
- Estado de erro: exibe mensagem com botão de retry
- Exibir no dropdown: nome do modelo + id em texto menor/secundário
- Ordenar lista alfabeticamente por nome

---

### 5. Atualizar `App.tsx`

Adicionar abaixo do placeholder da sessão 01:

```
[Modelo de transcrição  ▼]      [Modelo de resumo  ▼]
```

Os dois dropdowns ficam visíveis na tela principal desde o início.

Guardar os modelos selecionados em estado local do `App.tsx`:
```typescript
const [selectedTranscriptionModel, setSelectedTranscriptionModel] = useState<string | null>(null)
const [selectedSummaryModel, setSelectedSummaryModel] = useState<string | null>(null)
```

---

### 6. Registrar novo command no `main.rs`

Adicionar `fetch_models` ao `invoke_handler`.

---

## Comportamento quando a chave não está salva

- Dropdowns exibem mensagem: `"Configure sua chave OpenRouter nas configurações"`
- Ícone de Settings fica destacado visualmente (ex: borda colorida ou ponto de atenção)

---

## O que NÃO fazer nesta sessão

- Não implementar upload de arquivos
- Não implementar chamadas de transcrição ou resumo
- Não implementar lógica de salvar arquivos
- Não persistir o modelo selecionado entre sessões (apenas durante a sessão atual)

---

## Checklist de conclusão

- [ ] Command `fetch_models` funcionando no backend
- [ ] Hook `useOpenRouter` retorna listas filtradas corretamente
- [ ] Dropdown de transcrição exibe apenas modelos de áudio
- [ ] Dropdown de resumo exibe apenas modelos de texto
- [ ] Estados de loading e erro tratados visualmente
- [ ] Seleção de modelo mantida durante a sessão
- [ ] Sem erros de console

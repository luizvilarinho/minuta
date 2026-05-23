# Minuta — Sessão 04: Geração de Resumo + System Prompt

> Leia o `minuta-context.md` antes de começar. As sessões 01, 02 e 03 devem estar concluídas e funcionando. Não modifique nada do que já foi implementado.

---

## Objetivo desta sessão

Implementar a etapa de geração de resumo: chamada ao modelo de texto via OpenRouter, system prompt default estruturado, campo de prompt adicional com toggle soma/substitui.

---

## Entregável

Ao final desta sessão deve ser possível:
- Clicar em "Gerar Resumo" após ter uma transcrição na área de texto
- Ver o resumo estruturado gerado pelo modelo escolhido
- Expandir/colapsar o system prompt default
- Adicionar um prompt customizado e escolher se soma ou substitui o default
- Editar o resumo gerado antes de salvar

---

## System prompt default

```
Você é um assistente especializado em reuniões de projeto.
Analise a transcrição abaixo e gere um resumo estruturado em português brasileiro com exatamente as seguintes seções:

## Resumo Geral
Visão geral do que foi discutido na reunião.

## Decisões Tomadas
Liste as decisões concretas que foram tomadas durante a reunião.

## Próximos Passos / Action Items
Liste as tarefas definidas. Quando um responsável for mencionado, inclua o nome entre parênteses.

## Participantes Mencionados
Liste os nomes de pessoas mencionadas durante a reunião.

## Pontos em Aberto / Dúvidas
Liste questões que ficaram sem resolução ou que precisam de acompanhamento.
```

---

## Passo a passo

### 1. Backend Rust — `commands/summarize.rs`

```rust
#[tauri::command]
async fn generate_summary(
    transcription: String,
    model: String,
    system_prompt: String,
    app: AppHandle,
) -> Result<String, String>
```

Fluxo:
1. Recuperar chave do OpenRouter do store
2. Fazer `POST https://openrouter.ai/api/v1/chat/completions`:
```json
{
  "model": "<model>",
  "messages": [
    { "role": "system", "content": "<system_prompt>" },
    { "role": "user", "content": "<transcription>" }
  ]
}
```
3. Retornar `choices[0].message.content`

---

### 2. Lógica de resolução do system prompt

Esta lógica fica no **frontend** (`App.tsx` ou hook dedicado):

```typescript
function resolveSystemPrompt(
  defaultPrompt: string,
  additionalPrompt: string,
  mode: "sum" | "replace"
): string {
  if (!additionalPrompt.trim()) return defaultPrompt
  if (mode === "replace") return additionalPrompt
  return `${defaultPrompt}\n\n${additionalPrompt}`
}
```

O `system_prompt` resolvido é o que vai para o command Rust — o backend não conhece essa lógica.

---

### 3. Componente `SummaryView.tsx`

#### Seção de configuração do resumo:

**System prompt default (colapsável):**
- Título clicável: `"System prompt padrão ▼"` / `"System prompt padrão ▲"`
- Quando expandido: exibe o prompt em `<pre>` estilizado (somente leitura, fonte mono, fundo levemente diferente)

**Prompt adicional:**
- Label: `"Prompt adicional (opcional)"`
- `textarea` de altura menor (~100px)
- Placeholder: `"Ex: Foque especialmente nos riscos técnicos mencionados"`
- Vazio por padrão, não persiste entre sessões

**Toggle soma/substitui:**
```
○ Somar ao padrão    ● Substituir padrão
```
- Default: `Somar ao padrão`
- Tipo: radio buttons estilizados

**Botão "Gerar Resumo":**
- Desabilitado se não houver transcrição
- Desabilitado se nenhum modelo de resumo estiver selecionado
- Durante loading: `"Gerando resumo..."` + spinner

#### Área do resumo gerado:
- `textarea` de altura generosa (mínimo 300px), rolável
- Fonte monoespaçada
- Placeholder: `"O resumo aparecerá aqui..."`
- Editável pelo usuário após geração
- Contador de caracteres no rodapé

---

### 4. Atualizar `App.tsx`

Estado adicionado:
```typescript
const [summary, setSummary] = useState<string>("")
const [isSummarizing, setIsSummarizing] = useState<boolean>(false)
const [summaryError, setSummaryError] = useState<string | null>(null)
const [additionalPrompt, setAdditionalPrompt] = useState<string>("")
const [promptMode, setPromptMode] = useState<"sum" | "replace">("sum")
```

A seção de resumo só aparece na interface quando há texto na área de transcrição (`transcription.trim().length > 0`).

---

### 5. Registrar novo command no `main.rs`

Adicionar `generate_summary` ao `invoke_handler`.

---

## Tratamento de erros

| Situação | Mensagem exibida |
|----------|-----------------|
| Sem transcrição | Botão desabilitado |
| Modelo não selecionado | Botão desabilitado + tooltip "Selecione um modelo de resumo" |
| Erro na API (4xx/5xx) | "Erro ao gerar resumo: " + mensagem da API |
| Resposta vazia | "O modelo não retornou conteúdo. Tente novamente ou escolha outro modelo" |
| Timeout | "O resumo demorou demais. Tente novamente" |

---

## O que NÃO fazer nesta sessão

- Não implementar o botão de salvar
- Não modificar a lógica de transcrição
- Não persistir o prompt adicional

---

## Checklist de conclusão

- [ ] Botão "Gerar Resumo" funciona e retorna texto estruturado
- [ ] System prompt default exibido e colapsável
- [ ] Campo de prompt adicional funcional
- [ ] Toggle soma/substitui funciona corretamente nos dois modos
- [ ] Área de resumo editável após geração
- [ ] Seção de resumo aparece apenas quando há transcrição
- [ ] Estados de loading e erro tratados visualmente
- [ ] Sem erros de console

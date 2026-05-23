import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";

const DEFAULT_SYSTEM_PROMPT = `Você é um assistente especializado em reuniões de projeto.
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
Liste questões que ficaram sem resolução ou que precisam de acompanhamento.`;

interface SummaryViewProps {
  transcription: string;
  selectedSummaryModel: string | null;
  summary: string;
  onSummaryChange: (text: string) => void;
}

export function SummaryView({
  transcription,
  selectedSummaryModel,
  summary,
  onSummaryChange,
}: SummaryViewProps) {
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [additionalPrompt, setAdditionalPrompt] = useState("");
  const [promptMode, setPromptMode] = useState<"sum" | "replace">("sum");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveSystemPrompt = () => {
    if (!additionalPrompt.trim()) return DEFAULT_SYSTEM_PROMPT;
    if (promptMode === "replace") return additionalPrompt;
    return `${DEFAULT_SYSTEM_PROMPT}\n\n${additionalPrompt}`;
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await invoke<string>("generate_summary", {
        transcription,
        model: selectedSummaryModel,
        systemPrompt: resolveSystemPrompt(),
      });
      onSummaryChange(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const canGenerate = transcription.trim().length > 0 && !!selectedSummaryModel && !isLoading;

  return (
    <div className="w-full max-w-2xl flex flex-col gap-4">
      {/* System prompt colapsável */}
      <div className="border border-[#333] rounded">
        <button
          onClick={() => setIsPromptExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <span>System prompt padrão</span>
          <span>{isPromptExpanded ? "▲" : "▼"}</span>
        </button>
        {isPromptExpanded && (
          <pre className="px-3 py-2 text-xs font-mono text-gray-400 bg-[#111] rounded-b overflow-x-auto whitespace-pre-wrap border-t border-[#333]">
            {DEFAULT_SYSTEM_PROMPT}
          </pre>
        )}
      </div>

      {/* Prompt adicional */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400">Prompt adicional (opcional)</label>
        <textarea
          value={additionalPrompt}
          onChange={(e) => setAdditionalPrompt(e.target.value)}
          placeholder="Ex: Foque especialmente nos riscos técnicos mencionados"
          className="w-full h-[100px] bg-[#1a1a1a] border border-[#333] text-white rounded px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Toggle soma/substitui */}
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="radio"
            name="promptMode"
            value="sum"
            checked={promptMode === "sum"}
            onChange={() => setPromptMode("sum")}
            className="accent-blue-500"
          />
          Somar ao padrão
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input
            type="radio"
            name="promptMode"
            value="replace"
            checked={promptMode === "replace"}
            onChange={() => setPromptMode("replace")}
            className="accent-blue-500"
          />
          Substituir padrão
        </label>
      </div>

      {/* Botão gerar */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        title={!selectedSummaryModel ? "Selecione um modelo de resumo" : undefined}
        className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        {isLoading && (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {isLoading ? "Gerando resumo..." : "Gerar Resumo"}
      </button>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {/* Área do resumo */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400">Resumo</label>
        <textarea
          value={summary}
          onChange={(e) => onSummaryChange(e.target.value)}
          placeholder="O resumo aparecerá aqui..."
          className="w-full min-h-[300px] bg-[#1a1a1a] border border-[#333] text-white rounded px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:border-blue-500"
        />
        <span className="text-xs text-gray-600 text-right">
          {summary.length.toLocaleString("pt-BR")} caracteres
        </span>
      </div>
    </div>
  );
}

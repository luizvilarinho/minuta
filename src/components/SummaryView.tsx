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
    <div className="w-full flex flex-col gap-5">

      {/* System prompt colapsável */}
      <div className="border border-[#2d2650] rounded-lg overflow-hidden">
        <button
          onClick={() => setIsPromptExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-gray-200 hover:bg-[#1d1833] transition-colors"
        >
          <span className="font-medium">System prompt padrão</span>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform ${isPromptExpanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {isPromptExpanded && (
          <pre className="px-4 py-3 text-xs font-mono text-gray-400 bg-[#100c24] overflow-x-auto whitespace-pre-wrap border-t border-[#2d2650] leading-relaxed">
            {DEFAULT_SYSTEM_PROMPT}
          </pre>
        )}
      </div>

      {/* Prompt adicional */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Prompt adicional <span className="normal-case font-normal text-gray-500">(opcional)</span></label>
        <textarea
          value={additionalPrompt}
          onChange={(e) => setAdditionalPrompt(e.target.value)}
          placeholder="Ex: Foque especialmente nos riscos técnicos mencionados"
          className="w-full h-[96px] bg-[#18142b] border border-[#2d2650] text-white rounded-lg px-4 py-3 text-sm font-mono leading-relaxed resize-none focus:outline-none focus:border-violet-500 transition-colors"
        />
      </div>

      {/* Toggle soma/substitui */}
      <div className="flex gap-5">
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
          <input
            type="radio"
            name="promptMode"
            value="sum"
            checked={promptMode === "sum"}
            onChange={() => setPromptMode("sum")}
            className="accent-violet-500"
          />
          Somar ao padrão
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
          <input
            type="radio"
            name="promptMode"
            value="replace"
            checked={promptMode === "replace"}
            onChange={() => setPromptMode("replace")}
            className="accent-violet-500"
          />
          Substituir padrão
        </label>
      </div>

      {/* Botão gerar */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        title={!selectedSummaryModel ? "Selecione um modelo de resumo" : undefined}
        className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        {isLoading && (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {isLoading ? "Gerando resumo…" : "Gerar Resumo"}
      </button>

      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Área do resumo */}
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Resumo</label>
        <textarea
          value={summary}
          onChange={(e) => onSummaryChange(e.target.value)}
          placeholder="O resumo aparecerá aqui…"
          className="w-full min-h-[320px] bg-[#18142b] border border-[#2d2650] text-white rounded-lg px-4 py-3 text-sm font-mono leading-relaxed resize-y focus:outline-none focus:border-violet-500 transition-colors"
        />
        <span className="text-xs text-gray-500 text-right">
          {summary.length.toLocaleString("pt-BR")} caracteres
        </span>
      </div>
    </div>
  );
}

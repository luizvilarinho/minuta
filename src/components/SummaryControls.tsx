import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";

interface SavedPrompt {
  id: string;
  name: string;
  text: string;
}

const DEFAULT_SYSTEM_PROMPT = `You are a professional content summarizer.
Analyze the text below and generate a structured summary with exactly the following sections:

## Summary
A concise overview of the main topics covered.

## Key Points
The most important points, findings, or ideas presented in the text.

## Action Items / Next Steps
List any tasks, decisions, or follow-up actions mentioned. Include the responsible person in parentheses when mentioned.

## People Mentioned
List the names of people mentioned in the text.

## Open Questions
List any unresolved issues, pending decisions, or points that require follow-up.`;

interface SummaryControlsProps {
  transcription: string;
  selectedSummaryModel: string | null;
  isLoading: boolean;
  onLoadingChange: (v: boolean) => void;
  onSummaryChange: (text: string) => void;
}

export function SummaryControls({
  transcription,
  selectedSummaryModel,
  isLoading,
  onLoadingChange,
  onSummaryChange,
}: SummaryControlsProps) {
  const [isPromptSettingsExpanded, setIsPromptSettingsExpanded] = useState(false);
  const [isPromptExpanded, setIsPromptExpanded] = useState(false);
  const [isAdditionalExpanded, setIsAdditionalExpanded] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadedPromptId, setLoadedPromptId] = useState<string | null>(null);
  const [additionalPrompt, setAdditionalPrompt] = useState(() => localStorage.getItem("volp_additional_prompt") ?? "");
  const [promptMode, setPromptMode] = useState<"sum" | "replace">(() => {
    const stored = localStorage.getItem("volp_prompt_mode");
    return stored === "replace" ? "replace" : "sum";
  });
  const [error, setError] = useState<string | null>(null);

  const loadSavedPrompts = (): SavedPrompt[] => {
    try {
      return JSON.parse(localStorage.getItem("volp_saved_prompts") ?? "[]");
    } catch {
      return [];
    }
  };
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>(loadSavedPrompts);
  const [isSavedPromptsExpanded, setIsSavedPromptsExpanded] = useState(false);
  const [isSaveFormOpen, setIsSaveFormOpen] = useState(false);
  const [saveFormName, setSaveFormName] = useState("");

  const persistSavedPrompts = (prompts: SavedPrompt[]) => {
    localStorage.setItem("volp_saved_prompts", JSON.stringify(prompts));
    setSavedPrompts(prompts);
  };

  const handleSavePrompt = () => {
    const name = saveFormName.trim();
    const text = additionalPrompt.trim();
    if (!name || !text) return;
    const newPrompt: SavedPrompt = { id: crypto.randomUUID(), name, text };
    persistSavedPrompts([...savedPrompts, newPrompt]);
    setLoadedPromptId(newPrompt.id);
    setSaveFormName("");
    setIsSaveFormOpen(false);
  };

  const handleOverwritePrompt = () => {
    if (!loadedPromptId || !additionalPrompt.trim()) return;
    const updated = savedPrompts.map((p) =>
      p.id === loadedPromptId ? { ...p, text: additionalPrompt.trim() } : p
    );
    persistSavedPrompts(updated);
  };

  const handleDeletePrompt = (id: string) => {
    persistSavedPrompts(savedPrompts.filter((p) => p.id !== id));
  };

  const handleLoadPrompt = (id: string, text: string) => {
    setAdditionalPrompt(text);
    setLoadedPromptId(id);
    localStorage.setItem("volp_additional_prompt", text);
    setIsSavedPromptsExpanded(false);
  };

  const resolveSystemPrompt = () => {
    if (!additionalPrompt.trim()) return DEFAULT_SYSTEM_PROMPT;
    if (promptMode === "replace") return additionalPrompt;
    return `${DEFAULT_SYSTEM_PROMPT}\n\n${additionalPrompt}`;
  };

  const handleGenerate = async () => {
    onLoadingChange(true);
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
      onLoadingChange(false);
    }
  };

  const canGenerate = transcription.trim().length > 0 && !!selectedSummaryModel && !isLoading;

  const loadedPromptName = savedPrompts.find((p) => p.id === loadedPromptId)?.name ?? "";

  const pencilIcon = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );

  // Toggle de modo (Add to default / Replace default) reutilizado inline e no modal
  const modeToggle = (
    <>
      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
        <input
          type="radio"
          name="promptMode"
          value="sum"
          checked={promptMode === "sum"}
          onChange={() => { setPromptMode("sum"); localStorage.setItem("volp_prompt_mode", "sum"); }}
          className="accent-violet-500"
        />
        Add to default
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
        <input
          type="radio"
          name="promptMode"
          value="replace"
          checked={promptMode === "replace"}
          onChange={() => { setPromptMode("replace"); localStorage.setItem("volp_prompt_mode", "replace"); }}
          className="accent-violet-500"
        />
        Replace default
      </label>
    </>
  );

  // Lógica de Save reutilizada (inline e no footer do modal)
  const saveSection = (
    <>
      {loadedPromptId ? (
        <div className="flex items-center gap-3">
          <button
            onClick={handleOverwritePrompt}
            disabled={!additionalPrompt.trim()}
            className="text-xs bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded px-3 py-1.5 transition-colors"
          >
            Overwrite '{loadedPromptName}'
          </button>
          <button
            onClick={() => { setLoadedPromptId(null); setSaveFormName(""); setIsSaveFormOpen(true); }}
            className="text-xs text-gray-500 hover:text-violet-400 transition-colors"
          >
            Save as new →
          </button>
        </div>
      ) : !isSaveFormOpen ? (
        <button
          onClick={() => { setSaveFormName(""); setIsSaveFormOpen(true); }}
          disabled={!additionalPrompt.trim()}
          className="text-xs text-gray-500 hover:text-violet-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Save current prompt to library"
        >
          + Save to library
        </button>
      ) : (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={saveFormName}
            onChange={(e) => setSaveFormName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSavePrompt(); if (e.key === "Escape") setIsSaveFormOpen(false); }}
            placeholder="Prompt name"
            autoFocus
            className="w-36 bg-[#18142b] border border-[#2d2650] text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-violet-500 transition-colors"
          />
          <button
            onClick={handleSavePrompt}
            disabled={!saveFormName.trim() || !additionalPrompt.trim()}
            className="text-xs bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded px-2 py-1 transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => setIsSaveFormOpen(false)}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-1"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="w-full flex flex-col gap-5">

      {/* 1. Prompt settings — wrapper colapsável */}
      <div className="border border-[#2d2650] rounded-lg overflow-hidden">
        <button
          onClick={() => setIsPromptSettingsExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-400 hover:text-gray-200 hover:bg-[#1d1833] transition-colors"
        >
          <span className="flex items-center gap-2">
            <span className="font-medium">Prompt settings</span>
            <span className="font-normal text-gray-500">(optional)</span>
            {additionalPrompt.trim() && (
              <span className="text-[10px] font-medium bg-violet-600/30 text-violet-400 rounded-full px-1.5 py-px">Active</span>
            )}
          </span>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform ${isPromptSettingsExpanded ? "rotate-180" : ""}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {isPromptSettingsExpanded && (
          <div className="border-t border-[#2d2650] flex flex-col">

            {/* Default system prompt */}
            <div className="border-b border-[#2d2650]">
              <button
                onClick={() => setIsPromptExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-[#1d1833] transition-colors"
              >
                <span className="font-medium">Default system prompt</span>
                <svg
                  width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
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

            {/* Additional prompt */}
            <div>
              <button
                onClick={() => setIsAdditionalExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-[#1d1833] transition-colors"
              >
                <span className="font-medium">Additional prompt</span>
                <svg
                  width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={`transition-transform ${isAdditionalExpanded ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isAdditionalExpanded && (
                <>
                  {/* a) Library colapsável */}
                  <div className="border-t border-[#2d2650]">
                    <button
                      onClick={() => setIsSavedPromptsExpanded((v) => !v)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-500 hover:text-gray-300 hover:bg-[#1d1833] transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        Library
                        {savedPrompts.length > 0 && (
                          <span className="bg-violet-600/30 text-violet-400 rounded-full px-1.5 py-px text-[10px] leading-none font-medium">
                            {savedPrompts.length}
                          </span>
                        )}
                      </span>
                      <svg
                        width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        className={`transition-transform ${isSavedPromptsExpanded ? "rotate-180" : ""}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {isSavedPromptsExpanded && (
                      <ul className="divide-y divide-[#2d2650] border-t border-[#2d2650]">
                        {savedPrompts.length === 0 && (
                          <p className="px-4 py-2.5 text-xs text-gray-500 italic">No saved prompts yet</p>
                        )}
                        {savedPrompts.map((p) => (
                          <li key={p.id} className="flex items-center justify-between px-4 py-2 hover:bg-[#1d1833] transition-colors">
                            <button
                              onClick={() => handleLoadPrompt(p.id, p.text)}
                              className="text-xs text-gray-300 hover:text-violet-400 text-left flex-1 truncate transition-colors"
                              title={p.text}
                            >
                              {p.name}
                            </button>
                            <button
                              onClick={() => handleDeletePrompt(p.id)}
                              className="ml-3 text-gray-600 hover:text-red-400 transition-colors text-xs leading-none"
                              title="Delete"
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* b) Seção Save */}
                  <div className="border-t border-[#2d2650] px-4 py-3">
                    {saveSection}
                  </div>

                  {/* c) Textarea + botão Edit */}
                  <div className="px-4 pt-3 pb-4 border-t border-[#2d2650] bg-[#100c24] flex flex-col gap-3">
                    <textarea
                      value={additionalPrompt}
                      onChange={(e) => { setAdditionalPrompt(e.target.value); localStorage.setItem("volp_additional_prompt", e.target.value); }}
                      placeholder="e.g. Focus especially on technical risks mentioned"
                      className="w-full h-[140px] bg-[#18142b] border border-[#2d2650] text-white rounded-lg px-3 py-2.5 text-sm font-mono leading-relaxed resize-none focus:outline-none focus:border-violet-500 transition-colors"
                    />
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="self-end text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
                    >
                      {pencilIcon}
                      Edit / View
                    </button>
                  </div>

                  {/* d) Toggle de modo */}
                  <div className="px-4 py-3 border-t border-[#2d2650] flex gap-5">
                    {modeToggle}
                  </div>
                </>
              )}
            </div>

          </div>
        )}
      </div>

      {/* 3. Botão gerar */}
      <button
        onClick={handleGenerate}
        disabled={!canGenerate}
        className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        {isLoading && (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {isLoading ? "Generating summary…" : "Generate Summary"}
      </button>

      {!canGenerate && !isLoading && (
        <p className="text-xs text-gray-600 text-center -mt-2">
          {!transcription.trim()
            ? "Transcribe or paste text first"
            : "Select a summary model above"}
        </p>
      )}

      {/* 4. Erro */}
      {error && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* 5. Modal de edição */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-[#18142b] border border-[#2d2650] rounded-xl w-full max-w-[900px] flex flex-col shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2d2650]">
              <span className="text-sm font-medium text-gray-200">Additional prompt</span>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-500 hover:text-gray-200 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-col gap-4 px-6 py-5">
              <textarea
                value={additionalPrompt}
                onChange={(e) => { setAdditionalPrompt(e.target.value); localStorage.setItem("volp_additional_prompt", e.target.value); }}
                placeholder="e.g. Focus especially on technical risks mentioned"
                className="w-full h-[520px] bg-[#100c24] border border-[#2d2650] text-white rounded-lg px-4 py-3 text-sm font-mono leading-relaxed resize-none focus:outline-none focus:border-violet-500 transition-colors"
              />
              <div className="flex gap-5">
                {modeToggle}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[#2d2650]">
              <div>
                {saveSection}
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-[#1d1833] hover:bg-[#2a2447] text-white rounded-lg text-sm font-medium border border-[#2d2650] transition-colors"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

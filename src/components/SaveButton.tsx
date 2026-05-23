import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";

interface SaveButtonProps {
  transcription: string;
  summary: string;
  disabled: boolean;
}

export function SaveButton({ transcription, summary, disabled }: SaveButtonProps) {
  const [status, setStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [savedPath, setSavedPath] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleSave = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Escolha onde salvar a reunião",
    });

    if (!selected) return;
    const basePath = typeof selected === "string" ? selected : (selected as { path: string }).path ?? selected;

    setStatus("saving");
    setError("");
    try {
      const path = await invoke<string>("save_meeting", {
        basePath,
        transcription,
        summary,
      });
      setSavedPath(path);
      setStatus("success");
    } catch (err) {
      setError(String(err));
      setStatus("error");
    }
  };

  const handleOpenFolder = async () => {
    try {
      await invoke("open_folder", { path: savedPath });
    } catch {
      // silencioso
    }
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <button
        onClick={handleSave}
        disabled={disabled || status === "saving"}
        className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        {status === "saving" ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
        )}
        {status === "saving" ? "Salvando…" : "Salvar Reunião"}
      </button>

      {status === "success" && (
        <div className="bg-[#18142b] border border-emerald-700/50 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400 shrink-0">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span className="text-emerald-400 text-sm truncate" title={savedPath}>
              {savedPath}
            </span>
          </div>
          <button
            onClick={handleOpenFolder}
            className="text-xs text-violet-400 hover:text-violet-300 underline whitespace-nowrap shrink-0 transition-colors"
          >
            Abrir pasta
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          {error}
        </div>
      )}
    </div>
  );
}

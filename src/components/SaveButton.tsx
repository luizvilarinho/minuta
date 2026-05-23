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
    <div className="w-full max-w-2xl flex flex-col gap-3">
      <button
        onClick={handleSave}
        disabled={disabled || status === "saving"}
        className="bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded px-4 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        {status === "saving" && (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        )}
        {status === "saving" ? "Salvando..." : "Salvar Reunião"}
      </button>

      {status === "success" && (
        <div className="bg-[#1a1a1a] border border-green-700 rounded px-4 py-3 flex items-center justify-between gap-4">
          <span className="text-green-400 text-sm">
            ✓ Reunião salva em: {savedPath}
          </span>
          <button
            onClick={handleOpenFolder}
            className="text-xs text-blue-400 hover:text-blue-300 underline whitespace-nowrap"
          >
            Abrir pasta
          </button>
        </div>
      )}

      {status === "error" && (
        <p className="text-red-400 text-sm">{error}</p>
      )}
    </div>
  );
}

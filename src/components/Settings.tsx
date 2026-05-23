import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Settings({ isOpen, onClose }: SettingsProps) {
  const [apiKey, setApiKey] = useState("");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      invoke<string | null>("get_api_key").then((key) => {
        if (key) setApiKey(key);
      });
    }
  }, [isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      await invoke("save_api_key", { key: apiKey });
      setFeedback({ type: "success", message: "Chave salva com sucesso" });
    } catch (err) {
      setFeedback({ type: "error", message: String(err) });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-white text-lg font-semibold">Configurações</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-gray-300 text-sm mb-2">
            Chave OpenRouter
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-or-..."
            className="w-full bg-[#0f0f0f] border border-[#444] text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded px-4 py-2 text-sm font-medium transition-colors"
        >
          {isSaving ? "Salvando..." : "Salvar"}
        </button>

        {feedback && (
          <p className={`mt-3 text-sm ${feedback.type === "success" ? "text-green-400" : "text-red-400"}`}>
            {feedback.message}
          </p>
        )}
      </div>
    </div>
  );
}

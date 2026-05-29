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
      invoke<string | null>("get_api_key").then((key) => { if (key) setApiKey(key); });
    }
  }, [isOpen]);

  const handleSave = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      await invoke("save_api_key", { key: apiKey });
      setFeedback({ type: "success", message: "Key saved successfully" });
    } catch (err) {
      setFeedback({ type: "error", message: String(err) });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#0e0a1a]/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-[#18142b] border border-[#2d2650] rounded-2xl p-8 w-full max-w-md shadow-2xl shadow-black/50">

        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <span className="text-violet-400">◈</span>
            <h2 className="text-white text-base font-semibold">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-[#2d2650] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-2 mb-6">
          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            OpenRouter API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-or-..."
            className="w-full bg-[#0e0a1a] border border-[#423b6e] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 transition-colors font-mono"
          />
          <p className="text-xs text-gray-500">Your key is saved locally and never sent to any server.</p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {isSaving && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {isSaving ? "Saving…" : "Save key"}
        </button>

        {feedback && (
          <div className={`mt-4 text-sm px-4 py-3 rounded-lg ${
            feedback.type === "success"
              ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
              : "text-red-400 bg-red-500/10 border border-red-500/20"
          }`}>
            {feedback.message}
          </div>
        )}
      </div>
    </div>
  );
}

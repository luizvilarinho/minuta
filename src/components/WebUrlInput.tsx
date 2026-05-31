import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface WebUrlInputProps {
  onTranscriptionStart: () => void;
  onTranscriptionDone: (text: string) => void;
  onTranscriptionError: (error: string) => void;
  isLoading: boolean;
}

export function WebUrlInput({
  onTranscriptionStart,
  onTranscriptionDone,
  onTranscriptionError,
  isLoading,
}: WebUrlInputProps) {
  const [url, setUrl] = useState("");

  const handleFetch = async () => {
    if (!url.trim() || isLoading) return;
    onTranscriptionStart();
    try {
      const text = await invoke<string>("fetch_webpage_text", { url });
      onTranscriptionDone(text);
    } catch (err) {
      onTranscriptionError(String(err));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleFetch();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Web page URL</label>
      <input
        type="url"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="https://..."
        disabled={isLoading}
        className={`w-full bg-[#100c24] border border-[#2d2650] text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-violet-500 transition-colors ${
          isLoading ? "opacity-50 cursor-not-allowed" : ""
        }`}
      />
      <button
        onClick={handleFetch}
        disabled={isLoading || !url.trim()}
        className={`w-full py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors flex items-center justify-center gap-2 ${
          isLoading || !url.trim() ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        {isLoading ? "Extracting text…" : "Extract text"}
      </button>
    </div>
  );
}

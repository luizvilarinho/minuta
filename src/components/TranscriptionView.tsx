interface TranscriptionViewProps {
  text: string;
  onChange: (text: string) => void;
  isLoading: boolean;
}

export function TranscriptionView({ text, onChange, isLoading }: TranscriptionViewProps) {
  return (
    <div className="w-full max-w-2xl flex flex-col gap-1">
      <label className="text-xs text-gray-400">Transcrição</label>
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 bg-[#1a1a1a]/80 flex flex-col items-center justify-center rounded gap-2 z-10">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-300">
              Transcrevendo... isso pode levar alguns instantes
            </span>
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          disabled={isLoading}
          placeholder="A transcrição aparecerá aqui..."
          className="w-full min-h-[300px] bg-[#1a1a1a] border border-[#333] text-white rounded px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:border-blue-500 disabled:opacity-50"
        />
      </div>
      <span className="text-xs text-gray-600 text-right">
        {text.length.toLocaleString("pt-BR")} caracteres
      </span>
    </div>
  );
}

interface TranscriptionViewProps {
  text: string;
  onChange: (text: string) => void;
  isLoading: boolean;
}

export function TranscriptionView({ text, onChange, isLoading }: TranscriptionViewProps) {
  return (
    <div className="w-full flex flex-col gap-2">
      <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Transcription</label>
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 bg-[#18142b]/90 flex flex-col items-center justify-center rounded-lg gap-3 z-10">
            <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-gray-300">
              Transcribing… this may take a moment
            </span>
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          disabled={isLoading}
          placeholder="The transcription will appear here…"
          className="w-full min-h-[400px] bg-[#18142b] border border-[#2d2650] text-white rounded-lg px-4 py-3 text-sm font-mono leading-relaxed resize-y focus:outline-none focus:border-violet-500 disabled:opacity-50 transition-colors"
        />
      </div>
      <span className="text-xs text-gray-500 text-right">
        {text.length.toLocaleString("en-US")} characters
      </span>
    </div>
  );
}

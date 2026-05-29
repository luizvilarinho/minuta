interface SummaryReadViewProps {
  summary: string;
  isLoading: boolean;
}

function renderMarkdown(text: string) {
  const blocks = text.split(/\n\n+/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    // Heading ##
    if (trimmed.startsWith("## ")) {
      return (
        <h2
          key={i}
          className="text-violet-300 text-sm font-semibold uppercase tracking-wider mb-2 mt-6 first:mt-0"
        >
          {trimmed.slice(3)}
        </h2>
      );
    }

    // Lista de itens
    const lines = trimmed.split("\n");
    const isListBlock = lines.some((l) => l.trimStart().startsWith("- ") || l.trimStart().startsWith("* "));
    if (isListBlock) {
      return (
        <ul key={i} className="list-disc list-inside text-gray-200 text-sm leading-7 space-y-1">
          {lines.map((l, j) => (
            <li key={j}>{l.trimStart().slice(2)}</li>
          ))}
        </ul>
      );
    }

    // Parágrafo
    return (
      <p key={i} className="text-gray-200 text-sm leading-7">
        {trimmed}
      </p>
    );
  });
}

export function SummaryReadView({ summary, isLoading }: SummaryReadViewProps) {
  const isEmpty = summary.trim().length === 0;

  // Estado: vazio + loading → spinner
  if (isEmpty && isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 min-h-[200px]">
        <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Generating summary…</span>
      </div>
    );
  }

  // Estado: vazio + não loading → placeholder
  if (isEmpty) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[200px]">
        <span className="text-sm text-gray-500">Click Generate Summary to see the summary here.</span>
      </div>
    );
  }

  // Estado: com conteúdo (loading ou não)
  return (
    <div className="relative flex-1">
      {isLoading && (
        <div className="absolute inset-0 bg-[#0e0a1a]/60 flex items-center justify-center rounded-lg z-10">
          <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <div className="flex flex-col">
        {renderMarkdown(summary)}
      </div>
    </div>
  );
}

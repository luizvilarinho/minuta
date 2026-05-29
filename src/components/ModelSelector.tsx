import { OpenRouterModel } from "../hooks/useOpenRouter";

interface ModelSelectorProps {
  label: string;
  models: OpenRouterModel[];
  selected: string | null;
  onChange: (modelId: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  noKeyMessage?: string;
}

export function ModelSelector({
  label,
  models,
  selected,
  onChange,
  isLoading,
  disabled,
  noKeyMessage,
}: ModelSelectorProps) {
  if (noKeyMessage) {
    return (
      <div className="flex flex-col gap-2">
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>
        <div className="bg-[#18142b] border border-yellow-500/30 rounded-lg px-4 py-2.5 text-xs text-yellow-400">
          {noKeyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>
      <select
        value={selected ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading || disabled}
        className="bg-[#18142b] border border-[#2d2650] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-violet-500 disabled:opacity-50 transition-colors"
      >
        {isLoading ? (
          <option value="">Loading models...</option>
        ) : (
          <>
            <option value="">Select a model...</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </>
        )}
      </select>
      {!isLoading && models.length === 0 && (
        <span className="text-xs text-gray-500">No models available</span>
      )}
    </div>
  );
}

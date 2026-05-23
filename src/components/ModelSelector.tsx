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
      <div className="flex flex-col gap-1">
        <label className="text-xs text-gray-400">{label}</label>
        <div className="bg-[#1a1a1a] border border-[#333] rounded px-3 py-2 text-xs text-yellow-400">
          {noKeyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-400">{label}</label>
      <select
        value={selected ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading || disabled}
        className="bg-[#1a1a1a] border border-[#333] text-white rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
      >
        {isLoading ? (
          <option value="">Carregando modelos...</option>
        ) : (
          <>
            <option value="">Selecione um modelo...</option>
            {models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </>
        )}
      </select>
      {!isLoading && models.length === 0 && (
        <span className="text-xs text-gray-500">Nenhum modelo disponível</span>
      )}
    </div>
  );
}

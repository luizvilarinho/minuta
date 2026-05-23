import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

export interface OpenRouterModel {
  id: string;
  name: string;
  architecture?: {
    modality?: string;
  };
}

export function useOpenRouter() {
  const [transcriptionModels, setTranscriptionModels] = useState<OpenRouterModel[]>([]);
  const [summaryModels, setSummaryModels] = useState<OpenRouterModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        invoke<OpenRouterModel[]>("fetch_transcription_models"),
        invoke<OpenRouterModel[]>("fetch_models"),
      ]);
      const [transcriptionResult, summaryResult] = results;
      if (transcriptionResult.status === "fulfilled") {
        transcriptionResult.value.sort((a, b) => a.name.localeCompare(b.name));
        setTranscriptionModels(transcriptionResult.value);
      }
      if (summaryResult.status === "fulfilled") {
        summaryResult.value.sort((a, b) => a.name.localeCompare(b.name));
        setSummaryModels(summaryResult.value);
      }
      const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      if (rejected) throw rejected.reason;
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { transcriptionModels, summaryModels, isLoading, error, reload: load };
}

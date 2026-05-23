import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Settings } from "./components/Settings";
import { ModelSelector } from "./components/ModelSelector";
import { FileUpload } from "./components/FileUpload";
import { TranscriptionView } from "./components/TranscriptionView";
import { SummaryView } from "./components/SummaryView";
import { SaveButton } from "./components/SaveButton";
import { useOpenRouter } from "./hooks/useOpenRouter";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedTranscriptionModel, setSelectedTranscriptionModel] = useState<string | null>(
    () => localStorage.getItem("minuta_transcription_model")
  );
  const [selectedSummaryModel, setSelectedSummaryModel] = useState<string | null>(
    () => localStorage.getItem("minuta_summary_model")
  );
  const [transcription, setTranscription] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [canResume, setCanResume] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const recordingIntervalRef = useRef<number | null>(null);
  const { transcriptionModels, summaryModels, isLoading, error, reload } = useOpenRouter();

  useEffect(() => {
    invoke<boolean>("has_resume_state")
      .then((flag) => setCanResume(flag))
      .catch(() => setCanResume(false));
  }, []);

  useEffect(() => {
    if (selectedTranscriptionModel) {
      localStorage.setItem("minuta_transcription_model", selectedTranscriptionModel);
    }
  }, [selectedTranscriptionModel]);

  useEffect(() => {
    if (selectedSummaryModel) {
      localStorage.setItem("minuta_summary_model", selectedSummaryModel);
    }
  }, [selectedSummaryModel]);

  async function handleStartRecording() {
    setTranscriptionError(null);
    try {
      await invoke("clear_resume_state");
      setCanResume(false);
      await invoke("start_recording");
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch (err) {
      setTranscriptionError(String(err));
    }
  }

  async function handleStopRecording() {
    if (recordingIntervalRef.current !== null) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    try {
      const mp3Path = await invoke<string>("stop_recording");
      if (!selectedTranscriptionModel) {
        setTranscriptionError("Selecione um modelo de transcrição");
        return;
      }
      setIsTranscribing(true);
      setTranscriptionError(null);
      try {
        const text = await invoke<string>("transcribe_audio", {
          filePath: mp3Path,
          model: selectedTranscriptionModel,
        });
        setTranscription(text);
        setIsTranscribing(false);
        setCanResume(false);
      } catch (err) {
        setTranscriptionError(String(err));
        setIsTranscribing(false);
        setCanResume(true);
      }
    } catch (err) {
      setTranscriptionError(String(err));
    }
  }

  async function handleResumeTranscription() {
    setIsTranscribing(true);
    setTranscriptionError(null);
    try {
      const text = await invoke<string>("resume_last_transcription");
      setTranscription(text);
      setIsTranscribing(false);
      setCanResume(false);
    } catch (err) {
      setTranscriptionError(String(err));
      setIsTranscribing(false);
      // canResume continua true — chunks ainda em disco, dá pra tentar de novo
    }
  }

  async function handleReset() {
    if (recordingIntervalRef.current !== null) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    setTranscription("");
    setSummary("");
    setTranscriptionError(null);
    try {
      await invoke("clear_resume_state");
    } catch {
      // não bloqueia o reset por causa disso
    }
    setCanResume(false);
  }

  const noKeyMessage = error?.includes("não configurada")
    ? "Configure sua chave OpenRouter nas configurações"
    : null;

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#222]">
        <h1 className="text-xl font-semibold tracking-tight">Minuta</h1>
        <button
          onClick={() => setSettingsOpen(true)}
          className={`transition-colors p-2 rounded hover:bg-[#222] ${noKeyMessage ? "text-yellow-400 ring-1 ring-yellow-400" : "text-gray-400 hover:text-white"}`}
          title="Configurações"
        >
          ⚙
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center py-8 gap-6 px-6 overflow-y-auto">
        <div className="w-full max-w-2xl flex flex-col gap-2">
          <div className="flex justify-end">
            <button
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              title="Nova reunião"
            >
              ↺ Nova reunião
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <ModelSelector
              label="Modelo de transcrição"
              models={transcriptionModels}
              selected={selectedTranscriptionModel}
              onChange={setSelectedTranscriptionModel}
              isLoading={isLoading}
              noKeyMessage={noKeyMessage ?? undefined}
            />
            <ModelSelector
              label="Modelo de resumo"
              models={summaryModels}
              selected={selectedSummaryModel}
              onChange={setSelectedSummaryModel}
              isLoading={isLoading}
              noKeyMessage={noKeyMessage ?? undefined}
            />
          </div>
        </div>

        {error && !noKeyMessage && (
          <div className="text-red-400 text-sm flex items-center gap-2">
            <span>{error}</span>
            <button onClick={reload} className="underline text-xs">Tentar novamente</button>
          </div>
        )}

        <FileUpload
          selectedTranscriptionModel={selectedTranscriptionModel}
          onTranscriptionStart={() => { setIsTranscribing(true); setTranscriptionError(null); }}
          onTranscriptionDone={(text) => { setTranscription(text); setIsTranscribing(false); setCanResume(false); }}
          onTranscriptionError={(err) => { setTranscriptionError(err); setIsTranscribing(false); setCanResume(true); }}
          onTextLoaded={(text) => { setTranscription(text); setCanResume(false); }}
          isLoading={isTranscribing}
        />

        <button
          onClick={isRecording ? handleStopRecording : handleStartRecording}
          disabled={isTranscribing}
          className={`px-4 py-2 rounded font-medium transition-colors ${
            isRecording
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "bg-[#1f1f1f] hover:bg-[#2a2a2a] text-white border border-[#333] disabled:opacity-50 disabled:cursor-not-allowed"
          }`}
        >
          {isRecording ? `Parar (${formatDuration(recordingSeconds)})` : "Gravar Reunião"}
        </button>

        {transcriptionError && (
          <div className="text-red-400 text-sm flex flex-col items-center gap-2 max-w-2xl">
            <p className="text-center">{transcriptionError}</p>
            {canResume && !isTranscribing && (
              <button
                onClick={handleResumeTranscription}
                className="px-3 py-1.5 rounded text-sm bg-[#1f1f1f] hover:bg-[#2a2a2a] text-white border border-[#333]"
              >
                ↻ Tentar novamente
              </button>
            )}
          </div>
        )}

        {(isTranscribing || transcription) && (
          <TranscriptionView
            text={transcription}
            onChange={setTranscription}
            isLoading={isTranscribing}
          />
        )}

        {transcription.trim().length > 0 && (
          <SummaryView
            transcription={transcription}
            selectedSummaryModel={selectedSummaryModel}
            summary={summary}
            onSummaryChange={setSummary}
          />
        )}

        {summary.trim().length > 0 && (
          <SaveButton
            transcription={transcription}
            summary={summary}
            disabled={false}
          />
        )}
      </main>

      <Settings isOpen={settingsOpen} onClose={() => { setSettingsOpen(false); reload(); }} />
    </div>
  );
}

export default App;

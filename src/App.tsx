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
    <div className="min-h-screen bg-[#0e0a1a] text-white flex flex-col font-sans">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between px-8 py-5 border-b border-[#1f1a36]">
        <div className="flex items-center gap-3">
          <span className="text-violet-400 text-lg">◈</span>
          <h1 className="text-base font-semibold tracking-wide text-white">Minuta</h1>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            noKeyMessage
              ? "text-yellow-400 border border-yellow-500/40 hover:bg-yellow-500/10"
              : "text-gray-400 hover:text-white hover:bg-[#211d3a]"
          }`}
          title="Configurações"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Configurações
        </button>
      </header>

      {/* ── Corpo: 2 colunas (empilha abaixo de lg) ─────────────── */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2">

        {/* Coluna Esquerda — Gravação & Transcrição */}
        <div className="flex flex-col border-b border-[#1f1a36] lg:border-b-0 lg:border-r">

          {/* Cabeçalho da coluna */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-[#1f1a36]">
            <div className="flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
                <line x1="8" y1="22" x2="16" y2="22"/>
              </svg>
              <span className="text-sm font-medium text-gray-200">Gravação &amp; Transcrição</span>
            </div>
            <button
              onClick={handleReset}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
              title="Nova reunião"
            >
              <span>↺</span> Nova reunião
            </button>
          </div>

          {/* Conteúdo da coluna esquerda */}
          <div className="flex flex-col gap-6 px-8 py-6">

            <ModelSelector
              label="Modelo de transcrição"
              models={transcriptionModels}
              selected={selectedTranscriptionModel}
              onChange={setSelectedTranscriptionModel}
              isLoading={isLoading}
              noKeyMessage={noKeyMessage ?? undefined}
            />

            {error && !noKeyMessage && (
              <div className="text-red-400 text-sm flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                <span>⚠</span>
                <span className="flex-1">{error}</span>
                <button onClick={reload} className="underline text-xs shrink-0">Tentar novamente</button>
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
              className={`w-full py-2.5 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
                isRecording
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-[#1d1833] hover:bg-[#2a2447] text-white border border-[#2d2650] disabled:opacity-50 disabled:cursor-not-allowed"
              }`}
            >
              {isRecording ? (
                <>
                  <span className="w-2 h-2 rounded-sm bg-white animate-pulse" />
                  Parar gravação ({formatDuration(recordingSeconds)})
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="12" r="8"/>
                  </svg>
                  Gravar Reunião
                </>
              )}
            </button>

            {transcriptionError && (
              <div className="text-red-400 text-sm flex flex-col items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-4">
                <p className="text-center">{transcriptionError}</p>
                {canResume && !isTranscribing && (
                  <button
                    onClick={handleResumeTranscription}
                    className="px-4 py-1.5 rounded-lg text-sm bg-[#1d1833] hover:bg-[#2a2447] text-white border border-[#2d2650] transition-colors"
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

          </div>
        </div>

        {/* Coluna Direita — Resumo & Documento */}
        <div className="flex flex-col">

          {/* Cabeçalho da coluna */}
          <div className="flex items-center px-8 py-5 border-b border-[#1f1a36]">
            <div className="flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
              <span className="text-sm font-medium text-gray-200">Resumo &amp; Documento</span>
            </div>
          </div>

          {/* Conteúdo da coluna direita */}
          <div className="flex flex-col gap-6 px-8 py-6">

            <ModelSelector
              label="Modelo de resumo"
              models={summaryModels}
              selected={selectedSummaryModel}
              onChange={setSelectedSummaryModel}
              isLoading={isLoading}
              noKeyMessage={noKeyMessage ?? undefined}
            />

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

          </div>
        </div>

      </main>

      <Settings isOpen={settingsOpen} onClose={() => { setSettingsOpen(false); reload(); }} />
    </div>
  );
}

export default App;

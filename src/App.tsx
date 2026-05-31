import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Settings } from "./components/Settings";
import { ModelSelector } from "./components/ModelSelector";
import { FileUpload } from "./components/FileUpload";
import { TranscriptionView } from "./components/TranscriptionView";
import { SummaryControls } from "./components/SummaryControls";
import { SummaryReadView } from "./components/SummaryReadView";
import { SaveButton } from "./components/SaveButton";
import { YoutubeUrlInput } from "./components/YoutubeUrlInput";
import { WebUrlInput } from "./components/WebUrlInput";
import { useOpenRouter } from "./hooks/useOpenRouter";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedTranscriptionModel, setSelectedTranscriptionModel] = useState<string | null>(
    () => localStorage.getItem("volp_transcription_model") ?? localStorage.getItem("minuta_transcription_model")
  );
  const [selectedSummaryModel, setSelectedSummaryModel] = useState<string | null>(
    () => localStorage.getItem("volp_summary_model") ?? localStorage.getItem("minuta_summary_model")
  );
  const [transcription, setTranscription] = useState<string>("");
  const [pastedText, setPastedText] = useState<string>("");
  const [inputMode, setInputMode] = useState<"upload" | "paste" | "record" | "youtube" | "webpage">("upload");
  const [contentTab, setContentTab] = useState<"transcription" | "summary">("transcription");
  const [summary, setSummary] = useState<string>("");
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
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
      localStorage.setItem("volp_transcription_model", selectedTranscriptionModel);
    }
  }, [selectedTranscriptionModel]);

  useEffect(() => {
    if (selectedSummaryModel) {
      localStorage.setItem("volp_summary_model", selectedSummaryModel);
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
        setTranscriptionError("Select a transcription model");
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
        setPastedText("");
        setIsTranscribing(false);
        setCanResume(false);
        setContentTab("summary");
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
      setContentTab("summary");
    } catch (err) {
      setTranscriptionError(String(err));
      setIsTranscribing(false);
      // canResume continua true — chunks ainda em disco, dá pra tentar de novo
    }
  }

  async function handleReset() {
    if ((transcription || summary) && !window.confirm("Start a new session? The current transcription and summary will be lost.")) return;
    if (recordingIntervalRef.current !== null) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    setTranscription("");
    setSummary("");
    setTranscriptionError(null);
    setPastedText("");
    try {
      await invoke("clear_resume_state");
    } catch {
      // não bloqueia o reset por causa disso
    }
    setCanResume(false);
  }

  const noKeyMessage = error?.includes("não configurada")
    ? "Configure your OpenRouter key in settings"
    : null;

  return (
    <div className="min-h-screen bg-[#0e0a1a] text-white flex flex-col font-sans">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between px-8 py-5 border-b border-[#1f1a36]">
        <div className="flex items-center gap-3">
          <span className="text-violet-400 text-lg">◈</span>
          <h1 className="text-base font-semibold tracking-wide text-white">Volp</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-[#211d3a]"
            title="New session"
          >
            <span>↺</span> New session
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              noKeyMessage
                ? "text-yellow-400 border border-yellow-500/40 hover:bg-yellow-500/10"
                : "text-gray-400 hover:text-white hover:bg-[#211d3a]"
            }`}
            title="Settings"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Settings
          </button>
        </div>
      </header>

      {/* ── Corpo: 2 colunas (empilha abaixo de xl) ─────────────── */}
      <main className="flex-1 grid grid-cols-1 xl:grid-cols-[380px_1fr]">

        {/* Col 1 — Input (sidebar) */}
        <div className="flex flex-col border-b border-[#1f1a36] xl:border-b-0 xl:border-r">

          {/* Cabeçalho da coluna */}
          <div className="flex items-center px-8 py-5 border-b border-[#1f1a36]">
            <div className="flex items-center gap-2 py-1.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="22"/>
                <line x1="8" y1="22" x2="16" y2="22"/>
              </svg>
              <span className="text-sm font-medium text-gray-200">Input</span>
            </div>
          </div>

          {/* Conteúdo da col 1 */}
          <div className="flex flex-col gap-6 px-8 py-6">

            {/* Erro genérico de API */}
            {error && !noKeyMessage && (
              <div className="text-red-400 text-sm flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                <span>⚠</span>
                <span className="flex-1">{error}</span>
                <button onClick={reload} className="underline text-xs shrink-0">Retry</button>
              </div>
            )}

            {/* Seletor de modo */}
            <div className="grid grid-cols-5 gap-1 p-1 rounded-lg bg-[#100c24] border border-[#2d2650]">
              {([
                { key: "upload", label: "Upload" },
                { key: "paste", label: "Paste" },
                { key: "record", label: "Record" },
                { key: "youtube", label: "YouTube" },
                { key: "webpage", label: "Web" },
              ] as const).map((m) => (
                <button
                  key={m.key}
                  onClick={() => setInputMode(m.key)}
                  className={`py-1.5 rounded-md text-xs font-medium transition-colors ${
                    inputMode === m.key
                      ? "bg-[#1d1833] text-white"
                      : "text-gray-400 hover:text-gray-200 hover:bg-[#211d3a]"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Modelo de transcrição — visível nos modos que geram transcrição via IA */}
            {(inputMode === "upload" || inputMode === "record" || inputMode === "youtube") && (
              <ModelSelector
                label="Transcription model"
                models={transcriptionModels}
                selected={selectedTranscriptionModel}
                onChange={setSelectedTranscriptionModel}
                isLoading={isLoading}
                noKeyMessage={noKeyMessage ?? undefined}
              />
            )}

            {/* Modo: Upload File */}
            {inputMode === "upload" && (
              <FileUpload
                selectedTranscriptionModel={selectedTranscriptionModel}
                onTranscriptionStart={() => { setIsTranscribing(true); setTranscriptionError(null); }}
                onTranscriptionDone={(text) => { setTranscription(text); setPastedText(""); setIsTranscribing(false); setCanResume(false); setContentTab("summary"); }}
                onTranscriptionError={(err) => { setTranscriptionError(err); setIsTranscribing(false); setCanResume(true); }}
                onTextLoaded={(text) => { setTranscription(text); setPastedText(""); setCanResume(false); setContentTab("summary"); }}
                isLoading={isTranscribing}
              />
            )}

            {/* Modo: Paste Text */}
            {inputMode === "paste" && (
              <div className="flex flex-col gap-3">
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Paste text</label>
                <textarea
                  value={pastedText}
                  onChange={(e) => { setPastedText(e.target.value); setTranscription(e.target.value); }}
                  placeholder="Paste or type any text to summarize…"
                  className="w-full h-[200px] bg-[#100c24] border border-[#2d2650] text-white rounded-lg px-4 py-3 text-sm font-mono leading-relaxed resize-none focus:outline-none focus:border-violet-500 transition-colors"
                />
                {pastedText.trim() && (
                  <button
                    onClick={() => setContentTab("summary")}
                    className="w-full py-2 rounded-lg text-sm font-medium bg-violet-600 hover:bg-violet-700 text-white transition-colors flex items-center justify-center gap-2"
                  >
                    Continue to Summary
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Modo: Record */}
            {inputMode === "record" && (
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
                    Stop recording ({formatDuration(recordingSeconds)})
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="12" r="8"/>
                    </svg>
                    Record
                  </>
                )}
              </button>
            )}

            {/* Modo: YouTube */}
            {inputMode === "youtube" && (
              <YoutubeUrlInput
                onTranscriptionStart={() => { setIsTranscribing(true); setTranscriptionError(null); }}
                onTranscriptionDone={(text) => { setTranscription(text); setPastedText(""); setIsTranscribing(false); setCanResume(false); setContentTab("summary"); }}
                onTranscriptionError={(err) => { setTranscriptionError(err); setIsTranscribing(false); }}
                isLoading={isTranscribing}
                transcriptionModel={selectedTranscriptionModel}
              />
            )}

            {/* Modo: Webpage */}
            {inputMode === "webpage" && (
              <WebUrlInput
                onTranscriptionStart={() => { setIsTranscribing(true); setTranscriptionError(null); }}
                onTranscriptionDone={(text) => { setTranscription(text); setPastedText(""); setIsTranscribing(false); setCanResume(false); setContentTab("transcription"); }}
                onTranscriptionError={(err) => { setTranscriptionError(err); setIsTranscribing(false); }}
                isLoading={isTranscribing}
              />
            )}

            {/* Erro de transcrição + Retry (qualquer modo) */}
            {transcriptionError && (
              <div className="text-red-400 text-sm flex flex-col items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-4">
                <p className="text-center">{transcriptionError}</p>
                {canResume && !isTranscribing && (
                  <button
                    onClick={handleResumeTranscription}
                    className="px-4 py-1.5 rounded-lg text-sm bg-[#1d1833] hover:bg-[#2a2447] text-white border border-[#2d2650] transition-colors"
                  >
                    ↻ Retry
                  </button>
                )}
              </div>
            )}

          </div>
        </div>

        {/* Col 2 — Conteúdo (abas) */}
        <div className="flex flex-col">

          {/* TabBar */}
          <div className="flex items-center gap-1 px-8 py-5 border-b border-[#1f1a36]">
            {([
              { key: "transcription", label: "Transcription" },
              { key: "summary", label: "Summary" },
            ] as const).map((t) => (
              <button
                key={t.key}
                onClick={() => setContentTab(t.key)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  contentTab === t.key
                    ? "bg-[#1d1833] text-white"
                    : "text-gray-400 hover:text-gray-200 hover:bg-[#211d3a]"
                }`}
              >
                {t.label}
                {t.key === "summary" && transcription.trim().length > 0 && contentTab !== "summary" && (
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                )}
              </button>
            ))}
          </div>

          {/* Aba: Transcription */}
          {contentTab === "transcription" && (
            <div className="flex flex-col gap-4 px-8 py-6">
              <TranscriptionView
                text={transcription}
                onChange={setTranscription}
                isLoading={isTranscribing}
              />
            </div>
          )}

          {/* Aba: Summary */}
          {contentTab === "summary" && !transcription.trim() && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 py-16 text-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <div>
                <p className="text-sm text-gray-400 font-medium">No transcription yet</p>
                <p className="text-xs text-gray-600 mt-1">Upload a file, paste text, or record a meeting on the left to get started.</p>
              </div>
              <button
                onClick={() => setContentTab("transcription")}
                className="text-xs text-violet-400 hover:text-violet-300 transition-colors underline"
              >
                Go to Transcription
              </button>
            </div>
          )}

          {contentTab === "summary" && transcription.trim() && (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr]">

              {/* Sub-coluna: controles */}
              <div className="flex flex-col gap-5 px-8 py-6 border-b border-[#1f1a36] lg:border-b-0 lg:border-r">
                <ModelSelector
                  label="Summary model"
                  models={summaryModels}
                  selected={selectedSummaryModel}
                  onChange={setSelectedSummaryModel}
                  isLoading={isLoading}
                  noKeyMessage={noKeyMessage ?? undefined}
                />

                <SummaryControls
                  transcription={transcription}
                  selectedSummaryModel={selectedSummaryModel}
                  isLoading={isSummaryLoading}
                  onLoadingChange={setIsSummaryLoading}
                  onSummaryChange={setSummary}
                />
              </div>

              {/* Sub-coluna: leitura */}
              <div className="flex flex-col gap-6 px-8 py-6 overflow-y-auto">
                <SummaryReadView
                  summary={summary}
                  isLoading={isSummaryLoading}
                />
                <SaveButton
                  transcription={transcription}
                  summary={summary}
                  disabled={summary.trim().length === 0}
                />
              </div>
            </div>
          )}

        </div>

      </main>

      <Settings isOpen={settingsOpen} onClose={() => { setSettingsOpen(false); reload(); }} />
    </div>
  );
}

export default App;

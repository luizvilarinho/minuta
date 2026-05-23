import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";

interface FileUploadProps {
  selectedTranscriptionModel: string | null;
  onTranscriptionStart: () => void;
  onTranscriptionDone: (text: string) => void;
  onTranscriptionError: (error: string) => void;
  onTextLoaded: (text: string) => void;
  isLoading: boolean;
}

export function FileUpload({
  selectedTranscriptionModel,
  onTranscriptionStart,
  onTranscriptionDone,
  onTranscriptionError,
  onTextLoaded,
  isLoading,
}: FileUploadProps) {
  const handleClick = async () => {
    const selected = await open({
      multiple: false,
      filters: [
        { name: "Vídeo", extensions: ["mp4"] },
        { name: "Transcrição", extensions: ["txt", "md"] },
      ],
    });

    if (!selected) return;
    const filePath = selected;
    const ext = filePath.split(".").pop()?.toLowerCase();

    if (ext === "mp4") {
      if (!selectedTranscriptionModel) {
        onTranscriptionError("Selecione um modelo de transcrição");
        return;
      }
      try {
        await invoke("clear_resume_state");
      } catch {
        // descartar sessão antiga não pode bloquear um novo upload
      }
      onTranscriptionStart();
      try {
        const text = await invoke<string>("transcribe_audio", {
          filePath,
          model: selectedTranscriptionModel,
        });
        onTranscriptionDone(text);
      } catch (err) {
        onTranscriptionError(String(err));
      }
    } else if (ext === "txt" || ext === "md") {
      try {
        await invoke("clear_resume_state");
      } catch {
        // idem
      }
      try {
        const text = await readTextFile(filePath);
        onTextLoaded(text);
      } catch (err) {
        onTranscriptionError(String(err));
      }
    }
  };

  return (
    <div
      onClick={isLoading ? undefined : handleClick}
      className={`w-full border-2 border-dashed rounded-xl py-10 px-6 flex flex-col items-center justify-center gap-4 transition-all ${
        isLoading
          ? "border-[#2d2650] cursor-not-allowed opacity-50"
          : "border-[#423b6e] hover:border-violet-500 hover:bg-violet-500/5 cursor-pointer"
      }`}
    >
      <div className="w-10 h-10 rounded-full bg-[#1d1833] border border-[#2d2650] flex items-center justify-center">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-400">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm text-gray-300 font-medium">Carregar arquivo</p>
        <p className="text-xs text-gray-500 mt-1">MP4, TXT ou MD — clique para selecionar</p>
      </div>
    </div>
  );
}

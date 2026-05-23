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
      className={`w-full max-w-2xl border-2 border-dashed rounded-lg p-10 flex flex-col items-center justify-center gap-3 transition-colors ${
        isLoading
          ? "border-[#333] cursor-not-allowed opacity-50"
          : "border-[#444] hover:border-blue-500 cursor-pointer"
      }`}
    >
      <span className="text-3xl text-gray-500">↑</span>
      <p className="text-gray-400 text-sm text-center">
        Arraste um arquivo MP4 ou transcrição (TXT, MD)
        <br />
        <span className="text-gray-600 text-xs">Clique para selecionar</span>
      </p>
    </div>
  );
}

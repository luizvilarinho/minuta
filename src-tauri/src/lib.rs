mod commands;

use std::sync::atomic::Ordering;
use tauri::Manager;

use commands::models::{fetch_models, fetch_transcription_models};
use commands::record::{start_recording, stop_recording, RecordingState};
use commands::save_files::{open_folder, save_meeting};
use commands::settings::{get_api_key, save_api_key};
use commands::summarize::generate_summary;
use commands::transcribe::{
    clear_resume_state, has_resume_state, resume_last_transcription, transcribe_audio,
    TranscribeState,
};
use commands::webpage::fetch_webpage_text;
use commands::youtube::fetch_youtube_transcript;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(RecordingState::default())
        .manage(TranscribeState::default())
        .invoke_handler(tauri::generate_handler![
            save_api_key,
            get_api_key,
            fetch_models,
            fetch_transcription_models,
            transcribe_audio,
            resume_last_transcription,
            clear_resume_state,
            has_resume_state,
            generate_summary,
            save_meeting,
            open_folder,
            start_recording,
            stop_recording,
            fetch_youtube_transcript,
            fetch_webpage_text,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let state = window.state::<RecordingState>();
                let taken = state.0.lock().ok().and_then(|mut g| g.take());
                if let Some(handle) = taken {
                    handle.stop_flag.store(true, Ordering::Relaxed);
                    if let Some(t) = handle.thread {
                        let _ = t.join();
                    }
                    let _ = std::fs::remove_file(&handle.loopback_path);
                    if let Some(p) = &handle.mic_path {
                        let _ = std::fs::remove_file(p);
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

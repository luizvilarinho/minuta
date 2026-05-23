use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use tauri::State;

use crate::commands::transcribe::{find_ffmpeg, silent_command};

const SAMPLE_RATE: usize = 48000;
const BITS_PER_SAMPLE: usize = 32;

pub struct RecordingHandle {
    pub(crate) stop_flag: Arc<AtomicBool>,
    pub(crate) thread: Option<JoinHandle<()>>,
    pub(crate) loopback_path: PathBuf,
    pub(crate) mic_path: Option<PathBuf>,
}

pub struct RecordingState(pub Mutex<Option<RecordingHandle>>);

impl Default for RecordingState {
    fn default() -> Self {
        RecordingState(Mutex::new(None))
    }
}

struct StreamConfig {
    direction: wasapi::Direction,
    channels: usize,
    path: PathBuf,
}

fn capture_stream(
    config: StreamConfig,
    stop_flag: Arc<AtomicBool>,
) -> Result<(), String> {
    wasapi::initialize_mta()
        .ok()
        .map_err(|e| format!("Falha ao inicializar COM: {:?}", e))?;

    let device = wasapi::get_default_device(&config.direction)
        .map_err(|e| format!("Dispositivo padrão indisponível: {}", e))?;

    let mut audio_client = device
        .get_iaudioclient()
        .map_err(|e| format!("Falha ao obter IAudioClient: {}", e))?;

    let desired_format = wasapi::WaveFormat::new(
        BITS_PER_SAMPLE,
        BITS_PER_SAMPLE,
        &wasapi::SampleType::Float,
        SAMPLE_RATE,
        config.channels,
        None,
    );

    let (_def_time, min_time) = audio_client
        .get_periods()
        .map_err(|e| format!("Falha ao obter períodos: {}", e))?;

    audio_client
        .initialize_client(
            &desired_format,
            min_time,
            &wasapi::Direction::Capture,
            &wasapi::ShareMode::Shared,
            true,
        )
        .map_err(|e| format!("Falha ao inicializar cliente: {}", e))?;

    let h_event = audio_client
        .set_get_eventhandle()
        .map_err(|e| format!("Falha ao criar event handle: {}", e))?;

    let capture_client = audio_client
        .get_audiocaptureclient()
        .map_err(|e| format!("Falha ao obter capture client: {}", e))?;

    let spec = hound::WavSpec {
        channels: config.channels as u16,
        sample_rate: SAMPLE_RATE as u32,
        bits_per_sample: BITS_PER_SAMPLE as u16,
        sample_format: hound::SampleFormat::Float,
    };

    let mut writer = hound::WavWriter::create(&config.path, spec)
        .map_err(|e| format!("Falha ao criar WAV: {}", e))?;

    let mut sample_queue: std::collections::VecDeque<u8> =
        std::collections::VecDeque::with_capacity(16384);

    audio_client
        .start_stream()
        .map_err(|e| format!("Falha ao iniciar stream: {}", e))?;

    while !stop_flag.load(Ordering::Relaxed) {
        capture_client
            .read_from_device_to_deque(&mut sample_queue)
            .map_err(|e| format!("Falha ao ler do dispositivo: {}", e))?;

        let frames = sample_queue.len() / 4;
        for _ in 0..frames {
            let mut buf = [0u8; 4];
            for b in buf.iter_mut() {
                *b = sample_queue.pop_front().unwrap();
            }
            let sample = f32::from_le_bytes(buf);
            writer
                .write_sample(sample)
                .map_err(|e| format!("Falha ao escrever sample: {}", e))?;
        }

        if h_event.wait_for_event(200).is_err() {
            continue;
        }
    }

    let _ = audio_client.stop_stream();
    writer
        .finalize()
        .map_err(|e| format!("Falha ao finalizar WAV: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn start_recording(state: State<'_, RecordingState>) -> Result<(), String> {
    let mut guard = state.0.lock().map_err(|e| e.to_string())?;
    if guard.is_some() {
        return Err("Já existe uma gravação em andamento".to_string());
    }

    let temp_dir = std::env::temp_dir();
    let loopback_path = temp_dir.join("minuta_loopback.wav");
    let mic_path = temp_dir.join("minuta_mic.wav");

    let _ = std::fs::remove_file(&loopback_path);
    let _ = std::fs::remove_file(&mic_path);

    let mic_available = {
        let _ = wasapi::initialize_mta().ok();
        wasapi::get_default_device(&wasapi::Direction::Capture).is_ok()
    };

    let stop_flag = Arc::new(AtomicBool::new(false));
    let stop_flag_thread = stop_flag.clone();
    let loopback_path_thread = loopback_path.clone();
    let mic_path_opt = if mic_available {
        Some(mic_path.clone())
    } else {
        None
    };
    let mic_path_thread = mic_path_opt.clone();

    let thread = std::thread::spawn(move || {
        let stop_loopback = stop_flag_thread.clone();
        let loopback_handle = std::thread::spawn(move || {
            if let Err(e) = capture_stream(
                StreamConfig {
                    direction: wasapi::Direction::Render,
                    channels: 2,
                    path: loopback_path_thread,
                },
                stop_loopback,
            ) {
                eprintln!("Erro no loopback: {}", e);
            }
        });

        let mic_handle = mic_path_thread.map(|path| {
            let stop_mic = stop_flag_thread.clone();
            std::thread::spawn(move || {
                if let Err(e) = capture_stream(
                    StreamConfig {
                        direction: wasapi::Direction::Capture,
                        channels: 1,
                        path,
                    },
                    stop_mic,
                ) {
                    eprintln!("Erro no microfone: {}", e);
                }
            })
        });

        let _ = loopback_handle.join();
        if let Some(h) = mic_handle {
            let _ = h.join();
        }
    });

    *guard = Some(RecordingHandle {
        stop_flag,
        thread: Some(thread),
        loopback_path,
        mic_path: mic_path_opt,
    });

    Ok(())
}

#[tauri::command]
pub fn stop_recording(state: State<'_, RecordingState>) -> Result<String, String> {
    let handle = {
        let mut guard = state.0.lock().map_err(|e| e.to_string())?;
        guard
            .take()
            .ok_or_else(|| "Nenhuma gravação em andamento".to_string())?
    };

    handle.stop_flag.store(true, Ordering::Relaxed);
    if let Some(t) = handle.thread {
        let _ = t.join();
    }

    let ffmpeg = find_ffmpeg()?;
    let output_path = std::env::temp_dir().join("minuta_recording.mp3");
    let _ = std::fs::remove_file(&output_path);

    let result = if let Some(mic_path) = &handle.mic_path {
        silent_command(&ffmpeg)
            .args([
                "-i",
                handle.loopback_path.to_str().unwrap(),
                "-i",
                mic_path.to_str().unwrap(),
                "-filter_complex",
                "[0:a][1:a]amix=inputs=2:duration=longest",
                "-codec:a",
                "libmp3lame",
                "-q:a",
                "4",
                "-ar",
                "16000",
                "-ac",
                "1",
                output_path.to_str().unwrap(),
                "-y",
            ])
            .output()
    } else {
        silent_command(&ffmpeg)
            .args([
                "-i",
                handle.loopback_path.to_str().unwrap(),
                "-codec:a",
                "libmp3lame",
                "-q:a",
                "4",
                "-ar",
                "16000",
                "-ac",
                "1",
                output_path.to_str().unwrap(),
                "-y",
            ])
            .output()
    };

    let output = result.map_err(|e| format!("Erro ao executar ffmpeg: {}", e))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Erro no ffmpeg: {}", stderr));
    }

    let _ = std::fs::remove_file(&handle.loopback_path);
    if let Some(p) = &handle.mic_path {
        let _ = std::fs::remove_file(p);
    }

    Ok(output_path.to_string_lossy().to_string())
}

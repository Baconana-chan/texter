use base64::Engine;
use sevenz_rust2::{Password, SevenZReader};
use std::io::Cursor;

#[tauri::command]
async fn extract_7z(data_b64: String) -> Result<Vec<ArchiveEntry>, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data_b64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    let result = tauri::async_runtime::spawn_blocking(move || {
        let len = bytes.len() as u64;
        let cursor = Cursor::new(bytes);

        let mut reader = SevenZReader::new(cursor, len, Password::empty())
            .map_err(|e| format!("Failed to open 7z: {}", e))?;

        let entry_names: Vec<String> = reader
            .archive()
            .files
            .iter()
            .map(|e| e.name.clone())
            .collect();

        let mut result = Vec::new();
        for name in entry_names {
            if !name.ends_with('/') {
                match reader.read_file(&name) {
                    Ok(data) => {
                        let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
                        result.push(ArchiveEntry {
                            name,
                            content: b64,
                            size: data.len() as u64,
                        });
                    }
                    Err(e) => {
                        log::warn!("Failed to read 7z entry '{}': {}", name, e);
                    }
                }
            }
        }

        Ok::<Vec<ArchiveEntry>, String>(result)
    })
    .await
    .map_err(|e| format!("Thread pool error: {}", e))??;

    Ok(result)
}

#[tauri::command]
async fn extract_rar(data_b64: String) -> Result<Vec<ArchiveEntry>, String> {
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data_b64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    let result = tauri::async_runtime::spawn_blocking(move || {
        let tmp_dir = std::env::temp_dir();
        let tmp_path = tmp_dir.join(format!("texter_rar_{}.tmp", std::process::id()));
        std::fs::write(&tmp_path, &bytes)
            .map_err(|e| format!("Failed to write temp file: {}", e))?;

        let result = (|| -> Result<Vec<ArchiveEntry>, String> {
            use unrar::Archive;

            let arch = Archive::new(tmp_path.to_str().unwrap());

            // First pass: list all entries
            let mut file_entries: Vec<(String, u64)> = Vec::new();
            for entry_result in arch
                .open_for_listing()
                .map_err(|e| format!("Failed to open RAR for listing: {}", e))?
            {
                let entry = entry_result.map_err(|e| format!("Failed to read RAR entry: {}", e))?;
                if entry.is_file() {
                    let name = entry.filename.to_string_lossy().replace('\\', "/");
                    let size = entry.unpacked_size;
                    file_entries.push((name, size));
                }
            }

            // Second pass: open for processing and read each file into memory
            let mut results: Vec<ArchiveEntry> = Vec::new();
            let arch2 = Archive::new(tmp_path.to_str().unwrap());
            let mut process = arch2
                .open_for_processing()
                .map_err(|e| format!("Failed to open RAR for processing: {}", e))?;

            for (target_name, _) in &file_entries {
                loop {
                    let header_opt = process
                        .read_header()
                        .map_err(|e| format!("Failed to read RAR header: {}", e))?;

                    match header_opt {
                        Some(header_archive) => {
                            let entry_name = header_archive
                                .entry()
                                .filename
                                .to_string_lossy()
                                .replace('\\', "/");
                            let is_file = header_archive.entry().is_file();

                            if is_file && entry_name == *target_name {
                                let (data, rest) = header_archive.read().map_err(|e| {
                                    format!("Failed to read RAR entry '{}': {}", target_name, e)
                                })?;
                                let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
                                results.push(ArchiveEntry {
                                    name: target_name.clone(),
                                    content: b64,
                                    size: data.len() as u64,
                                });
                                process = rest;
                                break;
                            } else {
                                process = header_archive
                                    .skip()
                                    .map_err(|e| format!("Failed to skip RAR entry: {}", e))?;
                            }
                        }
                        None => {
                            return Err(format!("RAR entry '{}' not found", target_name));
                        }
                    }
                }
            }

            Ok(results)
        })();

        let _ = std::fs::remove_file(&tmp_path);
        result
    })
    .await
    .map_err(|e| format!("Thread pool error: {}", e))??;

    Ok(result)
}

#[derive(serde::Serialize)]
struct ArchiveEntry {
    name: String,
    content: String, // base64-encoded
    size: u64,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![extract_7z, extract_rar])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

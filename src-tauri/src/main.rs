// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod core;
mod error;
mod state;

use core::hash::get_ritoshark_hash_dir;
use state::HashtableState;
use tauri::Manager;
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

fn main() {
    // Initialize tracing/logging
    // Set RUST_LOG environment variable to control log level (e.g., RUST_LOG=debug)
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));
    
    tracing_subscriber::registry()
        .with(fmt::layer())
        .with(filter)
        .init();

    tracing::info!("Starting LoL Modding Suite");

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(HashtableState::new())
        .setup(|app| {
            // Use RitoShark directory for hash files (shared with other RitoShark tools)
            let hash_dir = get_ritoshark_hash_dir().unwrap_or_else(|e| {
                tracing::warn!("Failed to get RitoShark hash directory: {}", e);
                // Fallback to Tauri app data directory if RitoShark path not available
                app.path().app_data_dir()
                    .unwrap_or_else(|_| std::path::PathBuf::from("./hashes"))
                    .join("hashes")
            });
            
            tracing::info!("Using hash directory: {}", hash_dir.display());
            
            let hashtable_state = app.state::<HashtableState>().inner().clone();
            let hash_dir_for_spawn = hash_dir.clone();
            
            // Spawn background task to download/load hashes
            tauri::async_runtime::spawn(async move {
                // Always try to download/update hashes at startup
                // The downloader will skip files that are less than 24 hours old
                tracing::info!("Checking for hash updates...");
                match core::hash::download_hashes(&hash_dir_for_spawn, false).await {
                    Ok(stats) => {
                        if stats.downloaded > 0 {
                            tracing::info!(
                                "Hash update: {} downloaded, {} up-to-date",
                                stats.downloaded, stats.skipped
                            );
                        } else {
                            tracing::info!("Hashes up-to-date ({} files)", stats.skipped);
                        }
                    }
                    Err(e) => {
                        tracing::warn!("Failed to update hashes (will use existing): {}", e);
                    }
                }
                
                // Now initialize/reload the hashtable
                if let Err(e) = hashtable_state.init(hash_dir_for_spawn.clone()) {
                    tracing::warn!("Failed to initialize hashtable: {}", e);
                } else {
                    let count = hashtable_state.len();
                    tracing::info!("Hashtable initialized with {} hashes", count);
                }
            });
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::hash::download_hashes,
            commands::hash::get_hash_status,
            commands::hash::reload_hashes,
            commands::wad::read_wad,
            commands::wad::get_wad_chunks,
            commands::wad::extract_wad,
            commands::bin::convert_bin_to_text,
            commands::bin::convert_bin_to_json,
            commands::bin::convert_text_to_bin,
            commands::bin::convert_json_to_bin,
            commands::bin::read_bin_info,
            commands::bin::parse_bin_file_to_text,
            commands::bin::read_or_convert_bin,
            commands::bin::save_ritobin_to_bin,
            // League detection commands

            commands::league::detect_league,
            commands::league::validate_league,
            // Project management commands
            commands::project::create_project,
            commands::project::open_project,
            commands::project::save_project,
            commands::project::list_project_files,
            commands::project::preconvert_project_bins,
            // Champion discovery commands
            commands::champion::discover_champions,
            commands::champion::get_champion_skins,
            commands::champion::search_champions,
            // Validation commands
            commands::validation::extract_asset_references,
            commands::validation::validate_assets,
            // File commands (preview system)
            commands::file::read_file_bytes,
            commands::file::read_file_info,
            commands::file::decode_dds_to_png,
            commands::file::read_text_file,
            // Export commands
            commands::export::repath_project_cmd,
            commands::export::export_fantome,
            commands::export::export_modpkg,
            commands::export::get_fantome_filename,
            commands::export::get_export_preview,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

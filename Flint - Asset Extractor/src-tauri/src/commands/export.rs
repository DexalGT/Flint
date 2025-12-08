//! Tauri commands for export operations
//!
//! These commands expose export and repathing functionality to the frontend.

use crate::core::export::fantome::{
    export_as_fantome as core_export_fantome, 
    generate_fantome_filename, 
    FantomeMetadata
};
use crate::core::repath::refather::{repath_project, RepathConfig};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use tauri::Emitter;

/// Metadata for export operations (received from frontend)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportMetadata {
    pub name: String,
    pub author: String,
    pub version: String,
    pub description: String,
}

/// Result of export operation (sent to frontend)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    pub success: bool,
    pub output_path: String,
    pub file_count: usize,
    pub total_size: u64,
    pub message: String,
}

/// Result of repath operation (sent to frontend)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepathResultDto {
    pub success: bool,
    pub bins_processed: usize,
    pub paths_modified: usize,
    pub files_relocated: usize,
    pub missing_paths: Vec<String>,
    pub message: String,
}

/// Repath a project's assets with a unique prefix
///
/// This modifies BIN file paths and relocates asset files to prevent conflicts.
///
/// # Arguments
/// * `project_path` - Path to the project directory
/// * `creator_name` - Creator name for prefix (e.g., "SirDexal")
/// * `project_name` - Project name for prefix (e.g., "MyMod")
#[tauri::command]
pub async fn repath_project_cmd(
    project_path: String,
    creator_name: Option<String>,
    project_name: Option<String>,
    app: tauri::AppHandle,
) -> Result<RepathResultDto, String> {
    tracing::info!("Frontend requested repathing for: {}", project_path);

    let path = PathBuf::from(&project_path);
    let content_base = path.join("content").join("base");
    
    let creator = creator_name.unwrap_or_else(|| "bum".to_string());
    let project = project_name.unwrap_or_else(|| "mod".to_string());

    // Emit start event
    let _ = app.emit("repath-progress", serde_json::json!({
        "status": "starting",
        "message": "Starting repathing..."
    }));

    let config = RepathConfig {
        creator_name: creator.clone(),
        project_name: project.clone(),
        champion: String::new(), // Champion not provided in direct repath call
        target_skin_id: 0,
        combine_linked_bins: true, // Enable linked BIN concatenation
        cleanup_unused: true,
    };

    let result = tokio::task::spawn_blocking(move || {
        // Empty mappings since this is a manual repath, not from extraction
        let path_mappings: HashMap<String, String> = HashMap::new();
        repath_project(&content_base, &config, &path_mappings)
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?;

    match result {
        Ok(result) => {
            let _ = app.emit("repath-progress", serde_json::json!({
                "status": "complete",
                "message": format!("Repathed {} paths in {} BIN files", result.paths_modified, result.bins_processed)
            }));

            Ok(RepathResultDto {
                success: true,
                bins_processed: result.bins_processed,
                paths_modified: result.paths_modified,
                files_relocated: result.files_relocated,
                missing_paths: result.missing_paths,
                message: format!(
                    "Successfully repathed {} paths in {} BIN files",
                    result.paths_modified, result.bins_processed
                ),
            })
        }
        Err(e) => {
            let _ = app.emit("repath-progress", serde_json::json!({
                "status": "error",
                "message": format!("Repathing failed: {}", e)
            }));

            Err(e.to_string())
        }
    }
}

/// Export a project as a .fantome mod package
///
/// # Arguments
/// * `project_path` - Path to the project directory
/// * `output_path` - Path where the .fantome file will be created
/// * `champion` - Champion name for WAD structure
/// * `metadata` - Mod metadata
/// * `auto_repath` - Whether to run repathing before export (default: true)
#[tauri::command]
pub async fn export_fantome(
    project_path: String,
    output_path: String,
    champion: String,
    metadata: ExportMetadata,
    auto_repath: Option<bool>,
    app: tauri::AppHandle,
) -> Result<ExportResult, String> {
    tracing::info!(
        "Frontend requested fantome export: {} -> {}",
        project_path,
        output_path
    );

    let path = PathBuf::from(&project_path);
    let output = PathBuf::from(&output_path);
    let do_repath = auto_repath.unwrap_or(true);

    // Step 1: Repath if requested
    if do_repath {
        let _ = app.emit("export-progress", serde_json::json!({
            "status": "repathing",
            "progress": 0.2,
            "message": "Repathing assets..."
        }));

        let config = RepathConfig {
            creator_name: metadata.author.clone(),
            project_name: slugify(&metadata.name),
            champion: champion.clone(),
            target_skin_id: 0,
            combine_linked_bins: true, // Enable linked BIN concatenation
            cleanup_unused: false, // Don't cleanup unused during export, let user decide
        };

        let repath_path = path.join("content").join("base");
        let repath_result = tokio::task::spawn_blocking(move || {
            // Empty mappings since this is an export repath, not from fresh extraction
            let path_mappings: HashMap<String, String> = HashMap::new();
            repath_project(&repath_path, &config, &path_mappings)
        })
        .await
        .map_err(|e| format!("Repath task failed: {}", e))?;

        if let Err(e) = repath_result {
            tracing::warn!("Repathing failed (continuing anyway): {}", e);
        }
    }


    // Step 2: Export to fantome
    let _ = app.emit("export-progress", serde_json::json!({
        "status": "exporting",
        "progress": 0.5,
        "message": "Creating fantome package..."
    }));

    let fantome_metadata = FantomeMetadata {
        name: metadata.name.clone(),
        author: metadata.author.clone(),
        version: metadata.version.clone(),
        description: metadata.description.clone(),
    };

    let export_path = path.clone();
    let export_output = output.clone();
    let export_champion = champion.clone();
    let export_meta = fantome_metadata.clone();

    let result = tokio::task::spawn_blocking(move || {
        core_export_fantome(&export_path, &export_output, &export_champion, &export_meta)
    })
    .await
    .map_err(|e| format!("Export task failed: {}", e))?;

    match result {
        Ok(result) => {
            let _ = app.emit("export-progress", serde_json::json!({
                "status": "complete",
                "progress": 1.0,
                "message": format!("Export complete: {}", result.output_path)
            }));

            Ok(ExportResult {
                success: true,
                output_path: result.output_path,
                file_count: result.file_count,
                total_size: result.total_size,
                message: format!(
                    "Successfully exported {} files ({} bytes)",
                    result.file_count, result.total_size
                ),
            })
        }
        Err(e) => {
            let _ = app.emit("export-progress", serde_json::json!({
                "status": "error",
                "progress": 0.0,
                "message": format!("Export failed: {}", e)
            }));

            Err(e.to_string())
        }
    }
}

/// Generate a suggested filename for the fantome export
#[tauri::command]
pub fn get_fantome_filename(name: String, version: String) -> String {
    generate_fantome_filename(&name, &version)
}

/// Get export preview (list of files that would be exported)
#[tauri::command]
pub async fn get_export_preview(project_path: String) -> Result<Vec<String>, String> {
    let path = PathBuf::from(&project_path);
    let content_base = path.join("content").join("base");

    if !content_base.exists() {
        return Err(format!("Content directory not found: {}", content_base.display()));
    }

    let files: Vec<String> = walkdir::WalkDir::new(&content_base)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file())
        .filter_map(|e| {
            e.path()
                .strip_prefix(&content_base)
                .ok()
                .map(|p| p.to_string_lossy().to_string())
        })
        .collect();

    Ok(files)
}

/// Simple slugify function
fn slugify(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_alphanumeric() {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

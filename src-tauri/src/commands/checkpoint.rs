use crate::core::checkpoint::{Checkpoint, CheckpointDiff, CheckpointManager};
use std::path::PathBuf;

#[tauri::command]
pub async fn create_checkpoint(
    project_path: String,
    message: String,
    tags: Vec<String>,
) -> Result<Checkpoint, String> {
    let path = PathBuf::from(project_path);
    let manager = CheckpointManager::new(path);
    manager.init().map_err(|e| e.to_string())?;
    
    manager.create_checkpoint(message, tags).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_checkpoints(project_path: String) -> Result<Vec<Checkpoint>, String> {
    let path = PathBuf::from(project_path);
    let manager = CheckpointManager::new(path);
    manager.list_checkpoints().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn restore_checkpoint(project_path: String, checkpoint_id: String) -> Result<(), String> {
    let path = PathBuf::from(project_path);
    let manager = CheckpointManager::new(path);
    manager.restore_checkpoint(&checkpoint_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn compare_checkpoints(
    project_path: String,
    from_id: String,
    to_id: String,
) -> Result<CheckpointDiff, String> {
    let path = PathBuf::from(project_path);
    let manager = CheckpointManager::new(path);
    manager.compare_checkpoints(&from_id, &to_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_checkpoint(project_path: String, checkpoint_id: String) -> Result<(), String> {
    let path = PathBuf::from(project_path);
    let manager = CheckpointManager::new(path);
    manager.delete_checkpoint(&checkpoint_id).map_err(|e| e.to_string())
}

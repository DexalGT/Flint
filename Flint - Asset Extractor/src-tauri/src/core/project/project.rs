//! Project management for Flint
//!
//! This module provides data structures and logic for creating, loading,
//! and saving Flint mod projects using the league-mod compatible format.

use super::mod_project::{ModProject, ModProjectLayer, default_layers};
use crate::error::{Error, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{BufReader, BufWriter};
use std::path::{Path, PathBuf};

/// Project config file name (league-mod compatible)
const PROJECT_FILE: &str = "mod.config.json";

/// Represents a Flint mod project (runtime representation)
/// 
/// This struct combines league-mod compatible fields with Flint-specific
/// champion/skin data needed for the extraction workflow.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    // ===== League-mod compatible fields =====
    
    /// The name of the mod (slug format, no spaces)
    pub name: String,
    
    /// The display name of the mod
    pub display_name: String,
    
    /// The version of the mod (semver format)
    pub version: String,
    
    /// The description of the mod
    pub description: String,
    
    /// Layers of the mod project
    #[serde(default = "default_layers")]
    pub layers: Vec<ModProjectLayer>,
    
    // ===== Flint-specific fields =====
    
    /// Champion internal name (e.g., "Ahri") - Flint specific
    pub champion: String,
    
    /// Skin ID (0 for base skin) - Flint specific
    pub skin_id: u32,
    
    /// Path to League of Legends installation - Flint specific
    #[serde(skip_serializing_if = "Option::is_none")]
    pub league_path: Option<PathBuf>,
    
    /// Path to the project directory
    pub project_path: PathBuf,
    
    /// When the project was created
    pub created_at: DateTime<Utc>,
    
    /// When the project was last modified
    pub modified_at: DateTime<Utc>,
}

impl Project {
    /// Creates a new project
    pub fn new(
        name: impl Into<String>,
        champion: impl Into<String>,
        skin_id: u32,
        league_path: impl Into<PathBuf>,
        project_path: impl Into<PathBuf>,
    ) -> Self {
        let now = Utc::now();
        let name_str = name.into();
        let champion_str = champion.into();
        
        // Create display name from champion and skin
        let display_name = if skin_id == 0 {
            format!("{} Base Skin", champion_str)
        } else {
            format!("{} Skin {}", champion_str, skin_id)
        };
        
        Self {
            name: slugify(&name_str),
            display_name: name_str,
            version: "0.1.0".to_string(),
            description: format!("Mod for {} skin {}", champion_str, skin_id),
            layers: default_layers(),
            champion: champion_str,
            skin_id,
            league_path: Some(league_path.into()),
            project_path: project_path.into(),
            created_at: now,
            modified_at: now,
        }
    }

    /// Returns the path to the mod.config.json file
    pub fn config_path(&self) -> PathBuf {
        self.project_path.join(PROJECT_FILE)
    }

    /// Returns the path to the content directory for a specific layer
    pub fn content_path(&self, layer: &str) -> PathBuf {
        self.project_path.join("content").join(layer)
    }

    /// Returns the path to the base layer content (default for assets)
    /// This is the league-mod compatible path: content/base
    pub fn assets_path(&self) -> PathBuf {
        self.content_path("base")
    }

    /// Returns the path to the output directory
    pub fn output_path(&self) -> PathBuf {
        self.project_path.join("output")
    }

    /// Returns the layer names
    pub fn layer_names(&self) -> Vec<String> {
        self.layers.iter().map(|l| l.name.clone()).collect()
    }
}

/// Creates a new project with the required directory structure
///
/// # Arguments
/// * `name` - Project name (used as folder name)
/// * `champion` - Champion internal name
/// * `skin_id` - Skin ID
/// * `league_path` - Path to League installation
/// * `output_dir` - Directory where project folder will be created
pub fn create_project(
    name: &str,
    champion: &str,
    skin_id: u32,
    league_path: &Path,
    output_dir: &Path,
) -> Result<Project> {
    tracing::info!("Creating project '{}' for {} skin {}", name, champion, skin_id);

    // Validate inputs
    if name.is_empty() {
        return Err(Error::InvalidInput("Project name cannot be empty".to_string()));
    }
    if champion.is_empty() {
        return Err(Error::InvalidInput("Champion name cannot be empty".to_string()));
    }
    if !league_path.exists() {
        return Err(Error::InvalidInput(format!(
            "League path does not exist: {}",
            league_path.display()
        )));
    }
    
    // Create output directory if it doesn't exist
    if !output_dir.exists() {
        fs::create_dir_all(output_dir)
            .map_err(|e| Error::io_with_path(e, output_dir))?;
        tracing::info!("Created output directory: {}", output_dir.display());
    }

    // Create project directory name (no .flint extension, like league-mod)
    let project_dir_name = sanitize_filename(name);
    let project_path = output_dir.join(&project_dir_name);

    // Check if project already exists
    if project_path.exists() {
        return Err(Error::InvalidInput(format!(
            "Project already exists at: {}",
            project_path.display()
        )));
    }

    // Create project
    let project = Project::new(
        name,
        champion,
        skin_id,
        league_path,
        &project_path,
    );

    // Create directories
    fs::create_dir_all(&project_path)
        .map_err(|e| Error::io_with_path(e, &project_path))?;
    
    // Create content/base directory (league-mod compatible)
    fs::create_dir_all(project.assets_path())
        .map_err(|e| Error::io_with_path(e, project.assets_path()))?;
    
    fs::create_dir_all(project.output_path())
        .map_err(|e| Error::io_with_path(e, project.output_path()))?;

    // Save project file
    save_project(&project)?;

    tracing::info!("Project created at: {}", project_path.display());
    Ok(project)
}

/// Opens an existing project from a path
///
/// # Arguments
/// * `path` - Path to the project directory or mod.config.json file
pub fn open_project(path: &Path) -> Result<Project> {
    let project_path = if path.is_file() && path.file_name().and_then(|n| n.to_str()) == Some(PROJECT_FILE) {
        path.parent().unwrap_or(path).to_path_buf()
    } else {
        path.to_path_buf()
    };

    let config_path = project_path.join(PROJECT_FILE);
    
    if !config_path.exists() {
        return Err(Error::InvalidInput(format!(
            "Project file not found: {}",
            config_path.display()
        )));
    }

    tracing::info!("Opening project from: {}", config_path.display());

    let file = File::open(&config_path)
        .map_err(|e| Error::io_with_path(e, &config_path))?;
    let reader = BufReader::new(file);
    
    let mut project: Project = serde_json::from_reader(reader)
        .map_err(|e| Error::InvalidInput(format!("Failed to parse project file: {}", e)))?;

    // Set project path (not serialized)
    project.project_path = project_path;

    tracing::info!("Project '{}' loaded successfully", project.name);
    Ok(project)
}

/// Saves a project to disk
pub fn save_project(project: &Project) -> Result<()> {
    let config_path = project.config_path();
    tracing::debug!("Saving project to: {}", config_path.display());

    let file = File::create(&config_path)
        .map_err(|e| Error::io_with_path(e, &config_path))?;
    let writer = BufWriter::new(file);

    serde_json::to_writer_pretty(writer, project)
        .map_err(|e| Error::InvalidInput(format!("Failed to write project file: {}", e)))?;

    tracing::debug!("Project saved successfully");
    Ok(())
}

/// Sanitizes a filename to remove invalid characters
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' || c == ' ' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

/// Convert name to slug format
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

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_project_new() {
        let project = Project::new(
            "Test Project",
            "Ahri",
            0,
            "C:\\Riot Games\\League of Legends",
            "C:\\Projects\\test",
        );

        assert_eq!(project.name, "test-project");
        assert_eq!(project.display_name, "Test Project");
        assert_eq!(project.champion, "Ahri");
        assert_eq!(project.skin_id, 0);
        assert_eq!(project.layers.len(), 1);
        assert_eq!(project.layers[0].name, "base");
    }

    #[test]
    fn test_project_paths() {
        let project = Project::new(
            "Test",
            "Ahri",
            0,
            "C:\\League",
            "C:\\Projects\\test",
        );

        assert_eq!(project.config_path(), PathBuf::from("C:\\Projects\\test\\mod.config.json"));
        assert_eq!(project.assets_path(), PathBuf::from("C:\\Projects\\test\\content\\base"));
        assert_eq!(project.output_path(), PathBuf::from("C:\\Projects\\test\\output"));
    }

    #[test]
    fn test_project_content_path() {
        let project = Project::new("Test", "Ahri", 0, "C:\\League", "C:\\test");
        
        assert_eq!(project.content_path("base"), PathBuf::from("C:\\test\\content\\base"));
        assert_eq!(project.content_path("chroma1"), PathBuf::from("C:\\test\\content\\chroma1"));
    }

    #[test]
    fn test_sanitize_filename() {
        assert_eq!(sanitize_filename("Test Project"), "Test Project");
        assert_eq!(sanitize_filename("Test/Project"), "Test_Project");
        assert_eq!(sanitize_filename("Test:Project<>"), "Test_Project__");
        assert_eq!(sanitize_filename("Test-Project_123"), "Test-Project_123");
    }

    #[test]
    fn test_slugify() {
        assert_eq!(slugify("Test Project"), "test-project");
        assert_eq!(slugify("My Cool Mod"), "my-cool-mod");
    }

    #[test]
    fn test_layer_names() {
        let project = Project::new("Test", "Ahri", 0, "C:\\League", "C:\\test");
        let layers = project.layer_names();
        
        assert_eq!(layers.len(), 1);
        assert_eq!(layers[0], "base");
    }

    #[test]
    fn test_create_and_open_project() {
        let temp_dir = tempdir().unwrap();
        let league_dir = temp_dir.path().join("League");
        fs::create_dir_all(&league_dir).unwrap();

        let project = create_project(
            "Test Project",
            "Ahri",
            0,
            &league_dir,
            temp_dir.path(),
        ).unwrap();

        assert_eq!(project.display_name, "Test Project");
        assert!(project.project_path.exists());
        assert!(project.assets_path().exists());
        assert!(project.output_path().exists());
        assert!(project.config_path().exists());
        
        // Verify no .flint extension
        assert!(!project.project_path.to_string_lossy().ends_with(".flint"));

        // Test opening the project
        let loaded = open_project(&project.project_path).unwrap();
        assert_eq!(loaded.display_name, project.display_name);
        assert_eq!(loaded.champion, project.champion);
        assert_eq!(loaded.skin_id, project.skin_id);
    }

    #[test]
    fn test_create_project_empty_name() {
        let temp_dir = tempdir().unwrap();
        let result = create_project("", "Ahri", 0, temp_dir.path(), temp_dir.path());
        assert!(result.is_err());
    }

    #[test]
    fn test_create_project_empty_champion() {
        let temp_dir = tempdir().unwrap();
        let result = create_project("Test", "", 0, temp_dir.path(), temp_dir.path());
        assert!(result.is_err());
    }
}

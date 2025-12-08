//! ModProject data structures for League mod compatibility
//!
//! This module provides data structures compatible with the league-mod project format,
//! enabling future mod packaging and layer support.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Describes a mod project configuration file (mod.config.json)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ModProject {
    /// The name of the mod (slug format, no spaces)
    /// Example: `my-mod` or `ahri_skin_mod`
    pub name: String,

    /// The display name of the mod
    /// Example: `My Mod`
    pub display_name: String,

    /// The version of the mod (semver format)
    /// Example: `1.0.0`
    pub version: String,

    /// The description of the mod
    pub description: String,

    /// The authors of the mod
    pub authors: Vec<ModProjectAuthor>,

    /// The license of the mod
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub license: Option<ModProjectLicense>,

    /// File transformers to be applied during the build process
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub transformers: Vec<FileTransformer>,

    /// Layers of the mod project (loaded in order of priority)
    #[serde(default = "default_layers", skip_serializing_if = "Vec::is_empty")]
    pub layers: Vec<ModProjectLayer>,

    /// The thumbnail file path relative to the mod project folder
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,
}

impl ModProject {
    /// Creates a new ModProject with default values
    pub fn new(name: impl Into<String>, display_name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            display_name: display_name.into(),
            version: "0.1.0".to_string(),
            description: "A League of Legends mod".to_string(),
            authors: vec![],
            license: None,
            transformers: vec![],
            layers: default_layers(),
            thumbnail: None,
        }
    }

    /// Creates a ModProject from champion/skin information
    pub fn from_skin(name: &str, champion: &str, skin_id: u32) -> Self {
        let display_name = if skin_id == 0 {
            format!("{} Base Skin", champion)
        } else {
            format!("{} Skin {}", champion, skin_id)
        };

        Self {
            name: slugify(name),
            display_name,
            version: "0.1.0".to_string(),
            description: format!("Mod for {} skin {}", champion, skin_id),
            authors: vec![],
            license: None,
            transformers: vec![],
            layers: default_layers(),
            thumbnail: None,
        }
    }
}

/// Represents a layer in a mod project
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ModProjectLayer {
    /// The name of the layer (slug format)
    /// Example: `base`, `high_res_textures`, `chroma1`
    pub name: String,

    /// The priority of the layer (higher priority overrides lower)
    pub priority: i32,

    /// Optional description of the layer
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

impl ModProjectLayer {
    /// Returns the default base layer
    pub fn base() -> Self {
        Self {
            name: "base".to_string(),
            priority: 0,
            description: Some("Base layer of the mod".to_string()),
        }
    }
}

/// Returns the default layers for a mod project
pub fn default_layers() -> Vec<ModProjectLayer> {
    vec![ModProjectLayer::base()]
}

/// Author of a mod project
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum ModProjectAuthor {
    /// Simple author name
    Name(String),
    /// Author with role
    Role { name: String, role: String },
}

/// License for a mod project
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(untagged)]
pub enum ModProjectLicense {
    /// SPDX license identifier (e.g., "MIT", "Apache-2.0")
    Spdx(String),
    /// Custom license with name and URL
    Custom { name: String, url: String },
}

/// File transformer configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FileTransformer {
    /// The name of the transformer
    pub name: String,

    /// Glob patterns to match files
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub patterns: Vec<String>,

    /// Specific files to transform
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub files: Vec<String>,

    /// Transformer-specific options
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub options: Option<FileTransformerOptions>,
}

/// Transformer-specific configuration options
pub type FileTransformerOptions = HashMap<String, serde_json::Value>;

/// Flint-specific metadata stored alongside ModProject
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FlintMetadata {
    /// Champion internal name (e.g., "Ahri")
    pub champion: String,

    /// Skin ID (0 for base skin)
    pub skin_id: u32,

    /// Path to League of Legends installation
    pub league_path: String,

    /// When the project was created (ISO 8601)
    pub created_at: String,

    /// When the project was last modified (ISO 8601)
    pub modified_at: String,
}

/// Simple slugify function to create valid mod names
fn slugify(name: &str) -> String {
    name.chars()
        .map(|c| {
            if c.is_alphanumeric() {
                c.to_ascii_lowercase()
            } else if c == ' ' || c == '_' {
                '-'
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

    #[test]
    fn test_mod_project_new() {
        let project = ModProject::new("my-mod", "My Mod");
        assert_eq!(project.name, "my-mod");
        assert_eq!(project.display_name, "My Mod");
        assert_eq!(project.version, "0.1.0");
        assert_eq!(project.layers.len(), 1);
        assert_eq!(project.layers[0].name, "base");
    }

    #[test]
    fn test_mod_project_from_skin() {
        let project = ModProject::from_skin("ahri-base", "Ahri", 0);
        assert_eq!(project.name, "ahri-base");
        assert_eq!(project.display_name, "Ahri Base Skin");
    }

    #[test]
    fn test_slugify() {
        assert_eq!(slugify("My Mod"), "my-mod");
        assert_eq!(slugify("Test_Project"), "test-project");
        assert_eq!(slugify("Cool Mod 123"), "cool-mod-123");
    }

    #[test]
    fn test_default_layers() {
        let layers = default_layers();
        assert_eq!(layers.len(), 1);
        assert_eq!(layers[0].name, "base");
        assert_eq!(layers[0].priority, 0);
    }

    #[test]
    fn test_json_serialization() {
        let project = ModProject::new("test-mod", "Test Mod");
        let json = serde_json::to_string_pretty(&project).unwrap();
        let parsed: ModProject = serde_json::from_str(&json).unwrap();
        assert_eq!(project, parsed);
    }
}

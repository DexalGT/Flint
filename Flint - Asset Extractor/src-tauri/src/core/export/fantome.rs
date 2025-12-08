//! Fantome format export builder
//!
//! Creates .fantome mod packages which are ZIP files with the structure:
//! ```text
//! my_mod_1.0.0.fantome
//! ├── WAD/
//! │   └── {Champion}.wad.client/
//! │       └── {repathed assets}
//! └── META/
//!     ├── info.json  # Mod metadata
//!     └── image.png  # Optional thumbnail
//! ```

use crate::error::{Error, Result};
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::Path;
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

/// Metadata for a Fantome mod package
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FantomeMetadata {
    /// Display name of the mod
    #[serde(rename = "Name")]
    pub name: String,

    /// Author of the mod
    #[serde(rename = "Author")]
    pub author: String,

    /// Version string (e.g., "1.0.0")
    #[serde(rename = "Version")]
    pub version: String,

    /// Description of the mod
    #[serde(rename = "Description")]
    pub description: String,
}

impl Default for FantomeMetadata {
    fn default() -> Self {
        Self {
            name: "Untitled Mod".to_string(),
            author: "Unknown".to_string(),
            version: "1.0.0".to_string(),
            description: "A League of Legends mod".to_string(),
        }
    }
}

/// Result of a fantome export operation
#[derive(Debug, Clone)]
pub struct FantomeExportResult {
    /// Path to the created .fantome file
    pub output_path: String,
    /// Number of files included
    pub file_count: usize,
    /// Total size in bytes
    pub total_size: u64,
}

/// Export a project as a .fantome mod package
///
/// # Arguments
/// * `project_path` - Path to the Flint project directory
/// * `output_path` - Path where the .fantome file will be created
/// * `champion` - Champion name for the WAD folder structure
/// * `metadata` - Mod metadata for info.json
pub fn export_as_fantome(
    project_path: &Path,
    output_path: &Path,
    champion: &str,
    metadata: &FantomeMetadata,
) -> Result<FantomeExportResult> {
    let content_base = project_path.join("content").join("base");

    if !content_base.exists() {
        return Err(Error::InvalidInput(format!(
            "Content base directory not found: {}",
            content_base.display()
        )));
    }

    tracing::info!("Exporting fantome to: {}", output_path.display());

    // Create output file
    let file = File::create(output_path)
        .map_err(|e| Error::io_with_path(e, output_path))?;
    let writer = BufWriter::new(file);

    let mut zip = ZipWriter::new(writer);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    let mut file_count = 0;
    let mut total_size: u64 = 0;

    // Pack WAD directory structure
    let wad_folder_name = format!("{}.wad.client", champion);
    
    for entry in WalkDir::new(&content_base)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_file())
    {
        let path = entry.path();
        let relative_path = path.strip_prefix(&content_base)
            .map_err(|_| Error::InvalidInput("Failed to get relative path".to_string()))?;

        // Build the ZIP path: WAD/{champion}.wad.client/{relative_path}
        let zip_path = format!(
            "WAD/{}/{}",
            wad_folder_name,
            relative_path.to_string_lossy().replace('\\', "/")
        );

        zip.start_file(&zip_path, options)
            .map_err(|e| Error::InvalidInput(format!("Failed to create zip entry: {}", e)))?;

        let content = fs::read(path)
            .map_err(|e| Error::io_with_path(e, path))?;

        total_size += content.len() as u64;
        zip.write_all(&content)
            .map_err(|e| Error::InvalidInput(format!("Failed to write zip content: {}", e)))?;

        file_count += 1;
    }

    // Add META/info.json
    let info_json = serde_json::to_string_pretty(metadata)
        .map_err(|e| Error::InvalidInput(format!("Failed to serialize metadata: {}", e)))?;

    zip.start_file("META/info.json", options)
        .map_err(|e| Error::InvalidInput(format!("Failed to create info.json entry: {}", e)))?;
    zip.write_all(info_json.as_bytes())
        .map_err(|e| Error::InvalidInput(format!("Failed to write info.json: {}", e)))?;

    // Check for thumbnail
    let thumbnail_paths = ["thumbnail.png", "thumbnail.webp", "thumbnail.jpg", "image.png"];
    for thumb_name in thumbnail_paths {
        let thumb_path = project_path.join(thumb_name);
        if thumb_path.exists() {
            let content = fs::read(&thumb_path)
                .map_err(|e| Error::io_with_path(e, &thumb_path))?;

            // Always save as image.png in META folder (convert if needed)
            zip.start_file("META/image.png", options)
                .map_err(|e| Error::InvalidInput(format!("Failed to create thumbnail entry: {}", e)))?;
            zip.write_all(&content)
                .map_err(|e| Error::InvalidInput(format!("Failed to write thumbnail: {}", e)))?;
            break;
        }
    }

    zip.finish()
        .map_err(|e| Error::InvalidInput(format!("Failed to finalize zip: {}", e)))?;

    tracing::info!(
        "Fantome export complete: {} files, {} bytes",
        file_count,
        total_size
    );

    Ok(FantomeExportResult {
        output_path: output_path.to_string_lossy().to_string(),
        file_count,
        total_size,
    })
}

/// Generate a default filename for the fantome package
pub fn generate_fantome_filename(name: &str, version: &str) -> String {
    let slug = name
        .chars()
        .map(|c| if c.is_alphanumeric() { c.to_ascii_lowercase() } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    format!("{}_{}.fantome", slug, version)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_fantome_filename() {
        assert_eq!(
            generate_fantome_filename("My Cool Mod", "1.0.0"),
            "my-cool-mod_1.0.0.fantome"
        );
        assert_eq!(
            generate_fantome_filename("Ahri Skin", "0.1.0"),
            "ahri-skin_0.1.0.fantome"
        );
    }

    #[test]
    fn test_fantome_metadata_default() {
        let meta = FantomeMetadata::default();
        assert_eq!(meta.name, "Untitled Mod");
        assert_eq!(meta.version, "1.0.0");
    }

    #[test]
    fn test_fantome_metadata_serialization() {
        let meta = FantomeMetadata {
            name: "Test Mod".to_string(),
            author: "Test Author".to_string(),
            version: "2.0.0".to_string(),
            description: "A test mod".to_string(),
        };

        let json = serde_json::to_string_pretty(&meta).unwrap();
        assert!(json.contains("\"Name\": \"Test Mod\""));
        assert!(json.contains("\"Author\": \"Test Author\""));
    }
}

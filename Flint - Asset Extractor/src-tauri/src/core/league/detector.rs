//! League of Legends installation detection
//!
//! This module provides functionality to automatically detect and validate
//! League of Legends installations on Windows systems.

use crate::error::{Error, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Common installation paths to check
const COMMON_PATHS: &[&str] = &[
    "C:\\Riot Games\\League of Legends",
    "D:\\Riot Games\\League of Legends",
    "E:\\Riot Games\\League of Legends",
    "E:\\Oyunlar\\Riot Games\\League of Legends",
    "C:\\Program Files\\Riot Games\\League of Legends",
    "C:\\Program Files (x86)\\Riot Games\\League of Legends",
    "D:\\Program Files\\Riot Games\\League of Legends",
];

/// Files that should exist in a valid League installation
const REQUIRED_FILES: &[&str] = &[
    "LeagueClient.exe",
];

/// Directories that should exist in a valid League installation
const REQUIRED_DIRS: &[&str] = &[
    "Game",
];

/// Represents a detected League of Legends installation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeagueInstallation {
    /// Path to the League of Legends installation directory
    pub path: PathBuf,
    /// Path to the Game directory
    pub game_path: PathBuf,
    /// Whether this was detected automatically or set manually
    pub auto_detected: bool,
}

impl LeagueInstallation {
    /// Creates a new LeagueInstallation from a validated path
    pub fn new(path: PathBuf, auto_detected: bool) -> Self {
        let game_path = path.join("Game");
        Self {
            path,
            game_path,
            auto_detected,
        }
    }

    /// Returns the path to the DATA directory
    pub fn data_path(&self) -> PathBuf {
        self.game_path.join("DATA")
    }

    /// Returns the path to the Champions directory
    pub fn champions_path(&self) -> PathBuf {
        self.data_path().join("FINAL").join("Champions")
    }
}

/// Attempts to detect a League of Legends installation automatically
///
/// Detection order:
/// 1. Windows registry (Riot Client path)
/// 2. Common installation paths
///
/// # Returns
/// * `Ok(LeagueInstallation)` - If a valid installation was found
/// * `Err(Error)` - If no valid installation was found
pub fn detect_league_installation() -> Result<LeagueInstallation> {
    tracing::info!("Attempting to detect League of Legends installation");

    // Try registry first (Windows only)
    #[cfg(windows)]
    {
        if let Some(path) = detect_from_registry() {
            tracing::info!("Found League installation via registry: {}", path.display());
            if let Ok(installation) = validate_and_create(&path, true) {
                return Ok(installation);
            }
        }
    }

    // Try common paths
    for path_str in COMMON_PATHS {
        let path = PathBuf::from(path_str);
        if let Ok(installation) = validate_and_create(&path, true) {
            tracing::info!("Found League installation at common path: {}", path.display());
            return Ok(installation);
        }
    }

    tracing::warn!("No League of Legends installation found");
    Err(Error::InvalidInput(
        "Could not detect League of Legends installation. Please specify the path manually.".to_string()
    ))
}

/// Validates a manually specified League path
///
/// # Arguments
/// * `path` - The path to validate
///
/// # Returns
/// * `Ok(LeagueInstallation)` - If the path is valid
/// * `Err(Error)` - If the path is invalid
pub fn validate_league_path(path: impl AsRef<Path>) -> Result<LeagueInstallation> {
    let path = path.as_ref();
    tracing::debug!("Validating League path: {}", path.display());
    validate_and_create(path, false)
}

/// Validates a path and creates a LeagueInstallation if valid
fn validate_and_create(path: &Path, auto_detected: bool) -> Result<LeagueInstallation> {
    // Check path exists
    if !path.exists() {
        return Err(Error::InvalidInput(format!(
            "Path does not exist: {}",
            path.display()
        )));
    }

    // Check required files
    for file in REQUIRED_FILES {
        let file_path = path.join(file);
        if !file_path.exists() {
            return Err(Error::InvalidInput(format!(
                "Required file not found: {} (expected at {})",
                file,
                file_path.display()
            )));
        }
    }

    // Check required directories
    for dir in REQUIRED_DIRS {
        let dir_path = path.join(dir);
        if !dir_path.is_dir() {
            return Err(Error::InvalidInput(format!(
                "Required directory not found: {} (expected at {})",
                dir,
                dir_path.display()
            )));
        }
    }

    tracing::debug!("League path validated successfully: {}", path.display());
    Ok(LeagueInstallation::new(path.to_path_buf(), auto_detected))
}

/// Attempts to detect League installation from Windows registry
#[cfg(windows)]
fn detect_from_registry() -> Option<PathBuf> {
    use winreg::enums::*;
    use winreg::RegKey;

    tracing::debug!("Checking Windows registry for Riot Client path");

    // Try HKEY_CURRENT_USER first
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    
    // Try Riot Client path
    if let Ok(key) = hkcu.open_subkey("Software\\Riot Games\\RADS") {
        if let Ok(path) = key.get_value::<String, _>("LocalRootFolder") {
            let league_path = PathBuf::from(&path);
            // The registry might point to Riot Games folder, so check for League subfolder
            let with_league = league_path.join("League of Legends");
            if with_league.exists() {
                return Some(with_league);
            }
            if league_path.exists() {
                return Some(league_path);
            }
        }
    }

    // Try alternative registry paths
    if let Ok(key) = hkcu.open_subkey("Software\\Riot Games\\Riot Client") {
        if let Ok(path) = key.get_value::<String, _>("InstallLocation") {
            // Riot Client is usually at same level as League
            let riot_path = PathBuf::from(&path);
            if let Some(parent) = riot_path.parent() {
                let league_path = parent.join("League of Legends");
                if league_path.exists() {
                    return Some(league_path);
                }
            }
        }
    }

    // Try HKEY_LOCAL_MACHINE
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(key) = hklm.open_subkey("SOFTWARE\\Riot Games\\League of Legends") {
        if let Ok(path) = key.get_value::<String, _>("Location") {
            let league_path = PathBuf::from(&path);
            if league_path.exists() {
                return Some(league_path);
            }
        }
    }

    None
}

#[cfg(not(windows))]
fn detect_from_registry() -> Option<PathBuf> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_league_installation_new() {
        let path = PathBuf::from("C:\\Riot Games\\League of Legends");
        let installation = LeagueInstallation::new(path.clone(), true);
        
        assert_eq!(installation.path, path);
        assert_eq!(installation.game_path, path.join("Game"));
        assert!(installation.auto_detected);
    }

    #[test]
    fn test_league_installation_paths() {
        let path = PathBuf::from("C:\\Riot Games\\League of Legends");
        let installation = LeagueInstallation::new(path.clone(), false);
        
        assert_eq!(installation.data_path(), path.join("Game").join("DATA"));
        assert_eq!(
            installation.champions_path(),
            path.join("Game").join("DATA").join("FINAL").join("Champions")
        );
    }

    #[test]
    fn test_validate_nonexistent_path() {
        let result = validate_league_path("/nonexistent/path/to/league");
        assert!(result.is_err());
        
        if let Err(Error::InvalidInput(msg)) = result {
            assert!(msg.contains("does not exist"));
        } else {
            panic!("Expected InvalidInput error");
        }
    }

    #[test]
    fn test_common_paths_not_empty() {
        assert!(!COMMON_PATHS.is_empty());
    }

    #[test]
    fn test_required_files_not_empty() {
        assert!(!REQUIRED_FILES.is_empty());
        assert!(REQUIRED_FILES.contains(&"LeagueClient.exe"));
    }
}

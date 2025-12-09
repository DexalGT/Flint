//! Repathing module for modifying asset paths in BIN files
//!
//! This module implements the "bumpath" algorithm that prefixes asset paths
//! with a unique identifier (ASSETS/{creator}/{project}) to prevent conflicts between mods.

pub mod refather;

pub use refather::{repath_project, RepathConfig, RepathResult};

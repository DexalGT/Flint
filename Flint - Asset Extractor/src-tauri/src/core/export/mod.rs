//! Export module for creating distributable mod packages
//!
//! This module provides functionality to export projects in:
//! - `.fantome` format (legacy, widely supported)
//! - `.modpkg` format (modern format)

pub mod fantome;

pub use fantome::{export_as_fantome, FantomeMetadata};

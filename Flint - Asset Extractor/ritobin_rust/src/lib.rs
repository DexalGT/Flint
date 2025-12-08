//! # ritobin_rust
//!
//! A Rust library for reading and writing League of Legends binary property files (`.bin` format).
//!
//! This library provides comprehensive support for:
//! - **Binary format** (`.bin`): The native PROP/PTCH format used by League of Legends
//! - **Text format** (`.py`): Human-readable text representation
//! - **JSON format**: Standard JSON serialization
//! - **Hash files**: FNV1a and XXH64 hash loading for unhashing property names
//!
//! ## Quick Start
//!
//! ```no_run
//! use ritobin_rust::binary::{read_bin, write_bin};
//! use std::fs;
//!
//! // Read a binary file
//! let data = fs::read("champion.bin")?;
//! let mut bin = read_bin(&data)?;
//!
//! // Unhash with hash files (optional)
//! let mut unhasher = ritobin_rust::unhash::BinUnhasher::new();
//! unhasher.load_auto("hashes.game.txt")?;
//! unhasher.unhash_bin(&mut bin);
//!
//! // Convert to text format
//! let text = ritobin_rust::text::write_text(&bin)?;
//! fs::write("champion.py", text)?;
//! # Ok::<(), Box<dyn std::error::Error>>(())
//! ```
//!
//! ## Format Conversion
//!
//! ```no_run
//! use ritobin_rust::{binary, text, json};
//!
//! // Binary -> Text
//! let bin = binary::read_bin(&std::fs::read("file.bin")?)?;
//! let text = text::write_text(&bin)?;
//!
//! // Text -> JSON
//! let bin = text::read_text(&text)?;
//! let json = json::write_json(&bin)?;
//!
//! // JSON -> Binary
//! let bin = json::read_json(&json)?;
//! let bytes = binary::write_bin(&bin)?;
//! # Ok::<(), Box<dyn std::error::Error>>(())
//! ```
//!
//! ## Hash Loading
//!
//! The library supports both text and binary hash files. Binary format is 10-50x faster:
//!
//! ```no_run
//! use ritobin_rust::unhash::BinUnhasher;
//!
//! let mut unhasher = BinUnhasher::new();
//!
//! // Automatically uses .bin if available, falls back to .txt
//! unhasher.load_auto("hashes.game.txt")?;
//!
//! // Or explicitly load binary format
//! unhasher.load_binary_file("hashes.game.bin")?;
//! # Ok::<(), std::io::Error>(())
//! ```

pub mod hash;
pub mod model;
pub mod binary;
pub mod text;
pub mod unhash;
pub mod json;
pub mod hash_binary;

pub use model::Bin;

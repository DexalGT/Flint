//! Repathing engine for modifying asset paths in BIN files
//!
//! This module implements the "bumpath" algorithm that:
//! 1. Scans BIN files for string values containing asset paths (assets/, data/)
//! 2. Prefixes those paths with a unique identifier (ASSETS/{creator}/{project})
//! 3. Relocates the actual asset files to match the new paths
//! 4. Optionally combines linked BINs into a single concat BIN

use crate::core::bin::concat::{concatenate_linked_bins, classify_bin, BinCategory};
use crate::core::bin::ltk_bridge::{read_bin, write_bin};
use crate::error::{Error, Result};
use ltk_meta::PropertyValueEnum;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

/// Configuration for repathing operations
#[derive(Debug, Clone)]
pub struct RepathConfig {
    pub creator_name: String,
    pub project_name: String,
    pub champion: String,
    pub target_skin_id: u32,
    pub combine_linked_bins: bool,
    pub cleanup_unused: bool,
}

impl RepathConfig {
    pub fn prefix(&self) -> String {
        let creator = self.creator_name.replace(' ', "-");
        let project = self.project_name.replace(' ', "-");
        format!("{}/{}", creator, project)
    }
}

/// Result of a repathing operation
#[derive(Debug, Clone)]
pub struct RepathResult {
    pub bins_processed: usize,
    pub paths_modified: usize,
    pub files_relocated: usize,
    pub bins_combined: usize,
    pub files_removed: usize,
    pub missing_paths: Vec<String>,
}

/// Repath all assets in a project directory
pub fn repath_project(
    content_base: &Path,
    config: &RepathConfig,
    path_mappings: &HashMap<String, String>,
) -> Result<RepathResult> {
    tracing::info!(
        "Starting repathing for project with prefix: ASSETS/{}",
        config.prefix()
    );

    if !content_base.exists() {
        return Err(Error::InvalidInput(format!(
            "Content base directory not found: {}",
            content_base.display()
        )));
    }

    let mut result = RepathResult {
        bins_processed: 0,
        paths_modified: 0,
        files_relocated: 0,
        bins_combined: 0,
        files_removed: 0,
        missing_paths: Vec::new(),
    };

    // Step 0: Find the main skin BIN
    let main_bin_path = if !config.champion.is_empty() {
        find_main_skin_bin(content_base, &config.champion, config.target_skin_id)
    } else {
        None
    };

    let mut bin_files: Vec<PathBuf> = Vec::new();

    if let Some(ref main_path) = main_bin_path {
        tracing::info!("Found main skin BIN: {}", main_path.display());
        bin_files.push(main_path.clone());

        // Read the main BIN to get its linked BINs
        if let Ok(data) = fs::read(main_path) {
            if let Ok(bin) = read_bin(&data) {
                tracing::info!("Main skin BIN has {} dependencies", bin.dependencies.len());
                
                for dep_path in &bin.dependencies {
                    let normalized_path = dep_path.to_lowercase().replace('\\', "/");
                    
                    if classify_bin(&normalized_path) == BinCategory::Ignore {
                        tracing::warn!("Ignoring suspicious linked BIN: {}", normalized_path);
                        
                        // Aggressively delete the file so it doesn't crash other tools
                        let deletion_path = path_mappings.get(&normalized_path)
                            .cloned()
                            .unwrap_or_else(|| normalized_path.clone());
                        let full_del_path = content_base.join(&deletion_path);
                        if full_del_path.exists() {
                            if let Err(e) = fs::remove_file(&full_del_path) {
                                tracing::warn!("Failed to delete ignored BIN {}: {}", deletion_path, e);
                            } else {
                                tracing::info!("Deleted ignored BIN: {}", deletion_path);
                            }
                        }
                        continue;
                    }

                    let actual_path = path_mappings.get(&normalized_path)
                        .cloned()
                        .unwrap_or_else(|| normalized_path.clone());
                    
                    let full_path = content_base.join(&actual_path);
                    if full_path.exists() {
                        bin_files.push(full_path);
                    } else {
                        tracing::warn!("Linked BIN not found: {}", normalized_path);
                    }
                }
            }
        }
    } else {
        tracing::warn!("No main skin BIN found, falling back to scanning all BINs");
        bin_files = WalkDir::new(content_base)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| {
                e.path()
                    .extension()
                    .map(|ext| ext.eq_ignore_ascii_case("bin"))
                    .unwrap_or(false)
            })
            .filter(|e| {
                if let Ok(rel_path) = e.path().strip_prefix(content_base) {
                    let rel_str = rel_path.to_string_lossy();
                    if classify_bin(&rel_str) == BinCategory::Ignore {
                        tracing::warn!("Ignoring suspicious BIN file: {}", rel_str);
                        if let Err(e) = fs::remove_file(e.path()) {
                            tracing::warn!("Failed to delete ignored BIN {}: {}", rel_str, e);
                        } else {
                            tracing::info!("Deleted ignored BIN: {}", rel_str);
                        }
                        return false;
                    }
                }
                true
            })
            .map(|e| e.path().to_path_buf())
            .collect();
    }

    tracing::info!("Processing {} BIN files", bin_files.len());

    // Step 1: Combine linked BINs if requested
    if config.combine_linked_bins && main_bin_path.is_some() {
        let main_path = main_bin_path.as_ref().unwrap();
        
        match concatenate_linked_bins(
            main_path,
            &config.project_name,
            &config.creator_name,
            &config.champion,
            content_base,
            path_mappings,
        ) {
            Ok(concat_result) => {
                result.bins_combined = concat_result.source_count;
                tracing::info!("Combined {} linked BINs", concat_result.source_count);
                
                let concat_full_path = content_base.join(&concat_result.concat_path);
                if concat_full_path.exists() {
                    bin_files.push(concat_full_path);
                }
                
                // Remove deleted source BINs from bin_files
                for source_path in &concat_result.source_paths {
                    let full_path = content_base.join(source_path);
                    bin_files.retain(|p| p != &full_path);
                }
            }
            Err(e) => {
                tracing::warn!("Failed to combine linked BINs: {}", e);
            }
        }
    }

    // Step 2: Scan BINs to collect referenced asset paths
    let mut all_asset_paths: HashSet<String> = HashSet::new();
    for bin_path in &bin_files {
        if let Ok(paths) = scan_bin_for_paths(bin_path) {
            all_asset_paths.extend(paths);
        }
    }
    tracing::info!("Found {} unique asset paths in BINs", all_asset_paths.len());

    // Step 3: Determine which paths actually exist
    let existing_paths: HashSet<String> = all_asset_paths
        .iter()
        .filter(|path| content_base.join(path).exists())
        .cloned()
        .collect();

    for path in all_asset_paths.difference(&existing_paths) {
        result.missing_paths.push(path.clone());
    }

    // Step 4: Repath BIN files
    let prefix = config.prefix();
    for bin_path in &bin_files {
        match repath_bin_file(bin_path, &existing_paths, &prefix) {
            Ok(modified_count) => {
                result.bins_processed += 1;
                result.paths_modified += modified_count;
            }
            Err(e) => {
                tracing::warn!("Failed to repath {}: {}", bin_path.display(), e);
            }
        }
    }

    // Step 5: Relocate asset files
    result.files_relocated = relocate_assets(content_base, &existing_paths, &prefix)?;

    // Step 6: Clean up unused files
    if config.cleanup_unused {
        result.files_removed = cleanup_unused_files(content_base, &existing_paths, &prefix)?;
    }

    // Step 7: Clean up irrelevant extracted BINs
    cleanup_irrelevant_bins(content_base, &config.champion, config.target_skin_id)?;

    // Step 8: Clean up empty directories
    cleanup_empty_dirs(content_base)?;

    tracing::info!(
        "Repathing complete: {} bins, {} paths modified, {} files relocated",
        result.bins_processed,
        result.paths_modified,
        result.files_relocated
    );

    Ok(result)
}

/// Scan a BIN file for asset path references
fn scan_bin_for_paths(bin_path: &Path) -> Result<Vec<String>> {
    let data = fs::read(bin_path).map_err(|e| Error::io_with_path(e, bin_path))?;
    let bin = read_bin(&data)
        .map_err(|e| Error::InvalidInput(format!("Failed to parse BIN: {}", e)))?;

    let mut paths = Vec::new();

    for object in bin.objects.values() {
        for prop in object.properties.values() {
            collect_paths_from_value(&prop.value, &mut paths);
        }
    }

    Ok(paths)
}

/// Recursively collect asset paths from a PropertyValueEnum
fn collect_paths_from_value(value: &PropertyValueEnum, paths: &mut Vec<String>) {
    match value {
        PropertyValueEnum::String(s) => {
            if is_asset_path(&s.0) {
                paths.push(normalize_path(&s.0));
            }
        }
        PropertyValueEnum::Container(c) => {
            for item in &c.items {
                collect_paths_from_value(item, paths);
            }
        }
        PropertyValueEnum::UnorderedContainer(c) => {
            for item in &c.0.items {
                collect_paths_from_value(item, paths);
            }
        }
        PropertyValueEnum::Struct(s) => {
            for prop in s.properties.values() {
                collect_paths_from_value(&prop.value, paths);
            }
        }
        PropertyValueEnum::Embedded(e) => {
            for prop in e.0.properties.values() {
                collect_paths_from_value(&prop.value, paths);
            }
        }
        PropertyValueEnum::Optional(o) => {
            if let Some(inner) = &o.value {
                collect_paths_from_value(inner.as_ref(), paths);
            }
        }
        PropertyValueEnum::Map(m) => {
            for (key, val) in &m.entries {
                collect_paths_from_value(&key.0, paths);
                collect_paths_from_value(val, paths);
            }
        }
        _ => {}
    }
}

fn is_asset_path(s: &str) -> bool {
    let lower = s.to_lowercase();
    lower.starts_with("assets/") || lower.starts_with("data/")
}

fn normalize_path(s: &str) -> String {
    s.to_lowercase().replace('\\', "/")
}

fn apply_prefix_to_path(path: &str, prefix: &str) -> String {
    let lower = path.to_lowercase();
    if lower.starts_with("assets/") {
        format!("ASSETS/{}{}", prefix, &path[6..])
    } else if lower.starts_with("data/") {
        format!("ASSETS/{}{}", prefix, &path[4..])
    } else {
        format!("ASSETS/{}/{}", prefix, path)
    }
}

/// Repath a single BIN file
fn repath_bin_file(bin_path: &Path, existing_paths: &HashSet<String>, prefix: &str) -> Result<usize> {
    let data = fs::read(bin_path).map_err(|e| Error::io_with_path(e, bin_path))?;
    let mut bin = read_bin(&data)
        .map_err(|e| Error::InvalidInput(format!("Failed to parse BIN: {}", e)))?;

    let mut modified_count = 0;

    for object in bin.objects.values_mut() {
        for prop in object.properties.values_mut() {
            modified_count += repath_value(&mut prop.value, existing_paths, prefix);
        }
    }

    if modified_count > 0 {
        let new_data = write_bin(&bin)
            .map_err(|e| Error::InvalidInput(format!("Failed to write BIN: {}", e)))?;

        fs::write(bin_path, new_data).map_err(|e| Error::io_with_path(e, bin_path))?;
        tracing::debug!("Repathed {} paths in {}", modified_count, bin_path.display());
    }

    Ok(modified_count)
}

/// Recursively repath string values in a PropertyValueEnum
fn repath_value(value: &mut PropertyValueEnum, existing_paths: &HashSet<String>, prefix: &str) -> usize {
    let mut count = 0;

    match value {
        PropertyValueEnum::String(s) => {
            if is_asset_path(&s.0) {
                let normalized = normalize_path(&s.0);
                if existing_paths.contains(&normalized) {
                    s.0 = apply_prefix_to_path(&s.0, prefix);
                    count += 1;
                }
            }
        }
        PropertyValueEnum::Container(c) => {
            for item in &mut c.items {
                count += repath_value(item, existing_paths, prefix);
            }
        }
        PropertyValueEnum::UnorderedContainer(c) => {
            for item in &mut c.0.items {
                count += repath_value(item, existing_paths, prefix);
            }
        }
        PropertyValueEnum::Struct(s) => {
            for prop in s.properties.values_mut() {
                count += repath_value(&mut prop.value, existing_paths, prefix);
            }
        }
        PropertyValueEnum::Embedded(e) => {
            for prop in e.0.properties.values_mut() {
                count += repath_value(&mut prop.value, existing_paths, prefix);
            }
        }
        PropertyValueEnum::Optional(o) => {
            if let Some(inner) = &mut o.value {
                count += repath_value(inner.as_mut(), existing_paths, prefix);
            }
        }
        PropertyValueEnum::Map(m) => {
            // Note: Map keys are immutable (wrapped in PropertyValueUnsafeEq)
            // Only values can be repathed
            for val in m.entries.values_mut() {
                count += repath_value(val, existing_paths, prefix);
            }
        }
        _ => {}
    }

    count
}

fn relocate_assets(content_base: &Path, existing_paths: &HashSet<String>, prefix: &str) -> Result<usize> {
    let mut relocated = 0;

    for path in existing_paths {
        if path.to_lowercase().ends_with(".bin") {
            continue;
        }
        
        let source = content_base.join(path);
        let new_path = apply_prefix_to_path(path, prefix);
        let dest = content_base.join(&new_path);

        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent).map_err(|e| Error::io_with_path(e, parent))?;
        }

        if source.exists() {
            fs::copy(&source, &dest).map_err(|e| Error::io_with_path(e, &source))?;
            fs::remove_file(&source).map_err(|e| Error::io_with_path(e, &source))?;
            relocated += 1;
        }
    }

    Ok(relocated)
}

fn cleanup_unused_files(content_base: &Path, referenced_paths: &HashSet<String>, prefix: &str) -> Result<usize> {
    let mut removed = 0;

    let expected_paths: HashSet<String> = referenced_paths
        .iter()
        .map(|p| normalize_path(&apply_prefix_to_path(p, prefix)))
        .collect();

    for entry in WalkDir::new(content_base)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            if ext.eq_ignore_ascii_case("bin") {
                continue;
            }
        }

        if let Ok(rel_path) = path.strip_prefix(content_base) {
            let normalized = normalize_path(&rel_path.to_string_lossy());
            if !expected_paths.contains(&normalized) {
                if let Err(e) = fs::remove_file(path) {
                    tracing::warn!("Failed to remove {}: {}", path.display(), e);
                } else {
                    removed += 1;
                }
            }
        }
    }

    Ok(removed)
}

/// Remove irrelevant extracted BINs:
/// 1. Champion Root BIN ({Champion}.bin) - always removed as we link to original
/// 2. Unused Animation Bins - keep only the one matching target skin ID
fn cleanup_irrelevant_bins(content_base: &Path, champion: &str, target_skin_id: u32) -> Result<usize> {
    let mut removed = 0;
    let champion_lower = champion.to_lowercase();
    let root_bin_name = format!("{}.bin", champion_lower);
    
    // Pattern for animation bins: "Skin{ID}.bin"
    let target_anim_name = format!("skin{}.bin", target_skin_id);
    let target_anim_name_padded = format!("skin{:02}.bin", target_skin_id);

    for entry in WalkDir::new(content_base)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .map(|ext| ext.eq_ignore_ascii_case("bin"))
                .unwrap_or(false)
        })
    {
        let path = entry.path();
        if let Ok(rel_path) = path.strip_prefix(content_base) {
            let rel_str = rel_path.to_string_lossy().to_lowercase().replace('\\', "/");
            let filename = path.file_name().unwrap_or_default().to_string_lossy().to_lowercase();

            // Skip if it's the concatenated BIN we just made
            if filename.contains("__concat") {
                continue;
            }

            let category = classify_bin(&rel_str);
            let mut should_remove = false;

            match category {
                BinCategory::ChampionRoot => {
                    should_remove = true;
                },
                BinCategory::Animation => {
                    // Remove if it doesn't match target skin ID
                    if filename != target_anim_name && filename != target_anim_name_padded {
                        should_remove = true;
                    }
                },
                BinCategory::LinkedData => {
                    // Check for misplaced root bin in Type 3 folders
                    if filename == root_bin_name {
                        should_remove = true;
                    }
                },
                BinCategory::Ignore => {
                    should_remove = true;
                }
            }

            if should_remove {
                if let Err(e) = fs::remove_file(path) {
                    tracing::warn!("Failed to remove irrelevant BIN {}: {}", path.display(), e);
                } else {
                    tracing::debug!("Removed irrelevant BIN: {}", rel_str);
                    removed += 1;
                }
            }
        }
    }
    
    if removed > 0 {
        tracing::info!("Cleaned up {} irrelevant extracted BIN files", removed);
    }
    
    Ok(removed)
}

fn cleanup_empty_dirs(dir: &Path) -> Result<()> {
    for entry in WalkDir::new(dir)
        .contents_first(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path.is_dir() {
            if let Ok(entries) = fs::read_dir(path) {
                if entries.count() == 0 {
                    let _ = fs::remove_dir(path);
                }
            }
        }
    }
    Ok(())
}

fn find_main_skin_bin(content_base: &Path, champion: &str, skin_id: u32) -> Option<PathBuf> {
    let champion_lower = champion.to_lowercase();
    
    let patterns = vec![
        format!("data/characters/{}/skins/skin{}.bin", champion_lower, skin_id),
        format!("data/characters/{}/skins/skin{:02}.bin", champion_lower, skin_id),
    ];
    
    for pattern in &patterns {
        let direct_path = content_base.join(pattern);
        if direct_path.exists() {
            return Some(direct_path);
        }
    }

    // Fallback: search for any matching BIN
    for entry in WalkDir::new(content_base)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path()
                .extension()
                .map(|ext| ext.eq_ignore_ascii_case("bin"))
                .unwrap_or(false)
        })
    {
        let path = entry.path();
        if let Ok(rel_path) = path.strip_prefix(content_base) {
            let rel_str = rel_path.to_string_lossy().to_lowercase().replace('\\', "/");
            for pattern in &patterns {
                if rel_str == *pattern {
                    return Some(path.to_path_buf());
                }
            }
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_asset_path() {
        assert!(is_asset_path("assets/characters/ahri/skin0.bin"));
        assert!(is_asset_path("data/effects.bin"));
        assert!(!is_asset_path("some/other/path.txt"));
    }

    #[test]
    fn test_apply_prefix_to_path() {
        assert_eq!(
            apply_prefix_to_path("assets/characters/ahri/skin.dds", "SirDexal/MyMod"),
            "ASSETS/SirDexal/MyMod/characters/ahri/skin.dds"
        );
    }
}

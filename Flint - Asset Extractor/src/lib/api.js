/**
 * Flint - Tauri Bridge Layer
 * Async wrappers for all Tauri commands with error handling
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * Wrap a Tauri command with consistent error handling
 * @param {string} command - The Tauri command name
 * @param {object} args - Command arguments
 * @returns {Promise<any>}
 */
async function invokeCommand(command, args = {}) {
    try {
        return await invoke(command, args);
    } catch (error) {
        console.error(`[Flint] Command "${command}" failed:`, error);
        throw new FlintError(command, error);
    }
}

/**
 * Custom error class for Flint API errors
 */
export class FlintError extends Error {
    constructor(command, originalError) {
        const message = typeof originalError === 'string'
            ? originalError
            : originalError?.message || 'Unknown error';
        super(message);
        this.name = 'FlintError';
        this.command = command;
        this.originalError = originalError;
    }

    /**
     * Get a user-friendly error message
     */
    getUserMessage() {
        const messages = {
            // Hash commands
            'detect_league': 'Could not detect League of Legends installation.',
            'validate_league': 'The selected path is not a valid League of Legends installation.',
            'download_hashes': 'Failed to download hash files. Please check your internet connection.',
            'get_hash_status': 'Failed to check hash status.',
            'reload_hashes': 'Failed to reload hash files.',

            // Champion commands
            'discover_champions': 'Failed to discover champions.',
            'get_champion_skins': 'Failed to get skins for this champion.',
            'search_champions': 'Champion search failed.',

            // Project commands
            'create_project': 'Failed to create project.',
            'open_project': 'Failed to open project. The project file may be corrupted.',
            'save_project': 'Failed to save project.',
            'list_project_files': 'Failed to list project files.',
            'preconvert_project_bins': 'Failed to pre-convert BIN files.',

            // WAD commands
            'read_wad': 'Failed to read WAD file. The file may be corrupted.',
            'get_wad_chunks': 'Failed to read WAD contents.',
            'extract_wad': 'Failed to extract files from WAD.',

            // BIN commands
            'convert_bin_to_text': 'Failed to convert BIN to text format.',
            'convert_bin_to_json': 'Failed to convert BIN to JSON format.',
            'convert_text_to_bin': 'Failed to convert text to BIN format.',
            'convert_json_to_bin': 'Failed to convert JSON to BIN format.',
            'read_bin_info': 'Failed to read BIN file information.',
            'parse_bin_file_to_text': 'Failed to parse BIN file.',
            'read_or_convert_bin': 'Failed to load BIN file.',
            'save_ritobin_to_bin': 'Failed to save BIN file.',
            'parse_bin_to_tree': 'Failed to parse BIN structure.',
            'get_bin_paths': 'Failed to extract paths from BIN file.',

            // File commands
            'read_file_bytes': 'Failed to read file.',
            'read_file_info': 'Failed to get file information.',
            'decode_dds_to_png': 'Failed to decode texture file.',
            'read_text_file': 'Failed to read text file.',

            // Validation commands
            'extract_asset_references': 'Failed to extract asset references.',
            'validate_assets': 'Asset validation failed.',

            // Export commands
            'export_fantome': 'Failed to export Fantome package.',
            'export_modpkg': 'Failed to export modpkg package.',
        };
        return messages[this.command] || this.message;
    }

    /**
     * Get a recovery suggestion for this error
     * @returns {string|null}
     */
    getRecoverySuggestion() {
        const suggestions = {
            'detect_league': 'Go to Settings (Ctrl+,) and set the League path manually.',
            'validate_league': 'Make sure the path points to the League of Legends "Game" folder.',
            'download_hashes': 'Check your internet connection and try again. Hashes are required for file path resolution.',
            'discover_champions': 'Ensure League path is set correctly in Settings.',
            'create_project': 'Check that you have write permissions to the selected folder.',
            'open_project': 'Try opening a different project or create a new one.',
            'save_project': 'Check that the project folder still exists and is writable.',
            'save_ritobin_to_bin': 'Check for syntax errors in the BIN editor. Make sure the file is not read-only.',
            'decode_dds_to_png': 'The texture format may not be supported. Try viewing the file as hex.',
            'read_file_bytes': 'Check that the file exists and is accessible.',
            'export_fantome': 'Ensure all project files are saved and the output path is writable.',
        };
        return suggestions[this.command] || null;
    }
}

// =============================================================================
// Hash Management Commands
// =============================================================================

/**
 * Download hash files from CommunityDragon
 * @returns {Promise<{downloaded: number, total: number}>}
 */
export async function downloadHashes() {
    return invokeCommand('download_hashes');
}

/**
 * Get current hash status
 * @returns {Promise<{loaded: boolean, count: number, lastUpdate: string|null}>}
 */
export async function getHashStatus() {
    return invokeCommand('get_hash_status');
}

/**
 * Reload hashes from disk
 * @returns {Promise<{count: number}>}
 */
export async function reloadHashes() {
    return invokeCommand('reload_hashes');
}

// =============================================================================
// League Detection Commands
// =============================================================================

/**
 * Detect League of Legends installation path
 * @returns {Promise<{path: string, source: string}>}
 */
export async function detectLeague() {
    return invokeCommand('detect_league');
}

/**
 * Validate a League installation path
 * @param {string} path - Path to validate
 * @returns {Promise<{valid: boolean, version: string|null}>}
 */
export async function validateLeague(path) {
    return invokeCommand('validate_league', { path });
}

// =============================================================================
// Champion Discovery Commands
// =============================================================================

/**
 * Discover all champions from League installation
 * @param {string} leaguePath - League installation path
 * @returns {Promise<Array<{name: string, id: string}>>}
 */
export async function discoverChampions(leaguePath) {
    return invokeCommand('discover_champions', { leaguePath });
}

/**
 * Get skins for a specific champion
 * @param {string} leaguePath - League installation path
 * @param {string} championId - Champion ID (e.g., "Ahri")
 * @returns {Promise<Array<{id: number, name: string}>>}
 */
export async function getChampionSkins(leaguePath, championId) {
    return invokeCommand('get_champion_skins', { leaguePath, championId });
}

/**
 * Search champions by name
 * @param {string} leaguePath - League installation path
 * @param {string} query - Search query
 * @returns {Promise<Array<{name: string, id: string}>>}
 */
export async function searchChampions(leaguePath, query) {
    return invokeCommand('search_champions', { leaguePath, query });
}

// =============================================================================
// Project Management Commands
// =============================================================================

/**
 * Create a new project
 * @param {object} params - Project parameters
 * @param {string} params.name - Project name
 * @param {string} params.champion - Champion name
 * @param {number} params.skin - Skin ID
 * @param {string} params.projectPath - Where to create the project
 * @param {string} params.leaguePath - League installation path
 * @param {string} [params.creatorName] - Creator name for repathing (e.g., "SirDexal")
 * @returns {Promise<{path: string}>}
 */
export async function createProject({ name, champion, skin, projectPath, leaguePath, creatorName }) {
    return invokeCommand('create_project', {
        name,
        champion,
        skinId: skin,      // Backend expects skin_id (camelCase becomes skinId in Tauri)
        outputPath: projectPath,  // Backend expects output_path 
        leaguePath,       // Backend expects league_path
        creatorName,      // Backend expects creator_name (optional)
    });
}

/**
 * Open an existing project
 * @param {string} projectPath - Path to mod.config.json or project directory
 * @returns {Promise<{name: string, champion: string, skin: number, version: string, display_name: string, mod_project: object}>}
 */
export async function openProject(projectPath) {
    return invokeCommand('open_project', { path: projectPath });
}

/**
 * Save project changes
 * @param {string} projectPath - Path to project directory
 * @returns {Promise<void>}
 */
export async function saveProject(project) {
    return invokeCommand('save_project', { project });
}

/**
 * List files in a project directory
 * @param {string} projectPath - Path to project directory
 * @returns {Promise<object>} - File tree structure
 */
export async function listProjectFiles(projectPath) {
    return invokeCommand('list_project_files', { projectPath });
}

/**
 * Pre-convert all BIN files in a project to .ritobin format
 * This enables instant loading when users open BIN files
 * @param {string} projectPath - Path to project directory
 * @returns {Promise<number>} - Number of files converted
 */
export async function preconvertProjectBins(projectPath) {
    return invokeCommand('preconvert_project_bins', { projectPath });
}

// =============================================================================
// WAD Commands
// =============================================================================

/**
 * Read WAD file information
 * @param {string} wadPath - Path to WAD file
 * @returns {Promise<{version: string, chunkCount: number}>}
 */
export async function readWad(wadPath) {
    return invokeCommand('read_wad', { wadPath });
}

/**
 * Get chunks from a WAD file
 * @param {string} wadPath - Path to WAD file
 * @returns {Promise<Array<{hash: string, path: string|null, size: number}>>}
 */
export async function getWadChunks(wadPath) {
    return invokeCommand('get_wad_chunks', { wadPath });
}

/**
 * Extract files from a WAD
 * @param {string} wadPath - Path to WAD file
 * @param {string} outputPath - Output directory
 * @param {string[]} [hashes] - Optional specific hashes to extract
 * @returns {Promise<{extracted: number}>}
 */
export async function extractWad(wadPath, outputPath, hashes = null) {
    return invokeCommand('extract_wad', { wadPath, outputPath, hashes });
}

// =============================================================================
// BIN Commands
// =============================================================================

/**
 * Convert BIN to text format
 * @param {Uint8Array} binData - Binary BIN data
 * @returns {Promise<string>}
 */
export async function convertBinToText(binData) {
    return invokeCommand('convert_bin_to_text', { binData: Array.from(binData) });
}

/**
 * Convert BIN to JSON format
 * @param {Uint8Array} binData - Binary BIN data
 * @returns {Promise<object>}
 */
export async function convertBinToJson(binData) {
    return invokeCommand('convert_bin_to_json', { binData: Array.from(binData) });
}

/**
 * Convert text to BIN format
 * @param {string} textContent - Text content
 * @returns {Promise<Uint8Array>}
 */
export async function convertTextToBin(textContent) {
    const result = await invokeCommand('convert_text_to_bin', { textContent });
    return new Uint8Array(result);
}

/**
 * Convert JSON to BIN format
 * @param {object} jsonContent - JSON content
 * @returns {Promise<Uint8Array>}
 */
export async function convertJsonToBin(jsonContent) {
    const result = await invokeCommand('convert_json_to_bin', { jsonContent });
    return new Uint8Array(result);
}

/**
 * Read BIN file info
 * @param {Uint8Array} binData - Binary BIN data
 * @returns {Promise<{version: string, entryCount: number}>}
 */
export async function readBinInfo(binData) {
    return invokeCommand('read_bin_info', { binData: Array.from(binData) });
}

/**
 * Parse a BIN file and return Python-like text format for editing
 * @param {string} path - Path to the .bin file
 * @returns {Promise<string>} - Python-like text format
 */
export async function parseBinFileToText(path) {
    return invokeCommand('parse_bin_file_to_text', { path });
}

/**
 * Read or convert a BIN file, using cached .ritobin if available
 * @param {string} binPath - Path to the .bin file
 * @returns {Promise<string>} - Python-like text format
 */
export async function readOrConvertBin(binPath) {
    return invokeCommand('read_or_convert_bin', { binPath });
}

/**
 * Save edited ritobin content back to .bin file
 * @param {string} binPath - Path to the .bin file
 * @param {string} content - The edited text content
 * @returns {Promise<void>}
 */
export async function saveRitobinToBin(binPath, content) {
    return invokeCommand('save_ritobin_to_bin', { binPath, content });
}

/**
 * Parse a BIN file into a hierarchical tree structure for the property tree view
 * @param {string} binPath - Path to the .bin file
 * @returns {Promise<Array>} - Array of BinTreeNode objects
 */
export async function parseBinToTree(binPath) {
    return invokeCommand('parse_bin_to_tree', { binPath });
}

/**
 * Get all file and link paths from a BIN file for the path inspector
 * @param {string} binPath - Path to the .bin file
 * @returns {Promise<Array>} - Array of BinPathInfo objects with path, hash, type, nodeId, context
 */
export async function getBinPaths(binPath) {
    return invokeCommand('get_bin_paths', { binPath });
}

// =============================================================================
// Validation Commands
// =============================================================================


/**
 * Extract asset references from BIN data
 * @param {Uint8Array} binData - Binary BIN data
 * @returns {Promise<string[]>}
 */
export async function extractAssetReferences(binData) {
    return invokeCommand('extract_asset_references', { binData: Array.from(binData) });
}

/**
 * Validate assets against WAD contents
 * @param {string[]} assetPaths - Asset paths to validate
 * @param {string} wadPath - WAD file to check against
 * @returns {Promise<{valid: string[], missing: string[]}>}
 */
export async function validateAssets(assetPaths, wadPath) {
    return invokeCommand('validate_assets', { assetPaths, wadPath });
}

// =============================================================================
// File Commands (Preview System)
// =============================================================================

/**
 * Read raw file bytes from disk
 * @param {string} path - Path to the file
 * @returns {Promise<Uint8Array>}
 */
export async function readFileBytes(path) {
    const result = await invokeCommand('read_file_bytes', { path });
    return new Uint8Array(result);
}

/**
 * Get file metadata and type information
 * @param {string} path - Path to the file
 * @returns {Promise<{path: string, size: number, fileType: string, extension: string, dimensions: [number, number]|null}>}
 */
export async function readFileInfo(path) {
    return invokeCommand('read_file_info', { path });
}

/**
 * Decode a DDS texture to base64-encoded PNG
 * @param {string} path - Path to the DDS file
 * @returns {Promise<{data: string, width: number, height: number, format: string}>}
 */
export async function decodeDdsToPng(path) {
    return invokeCommand('decode_dds_to_png', { path });
}

/**
 * Read text file content
 * @param {string} path - Path to the text file
 * @returns {Promise<string>}
 */
export async function readTextFile(path) {
    return invokeCommand('read_text_file', { path });
}

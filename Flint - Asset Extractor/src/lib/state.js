/**
 * Flint - Application State Management
 * Simple reactive state with event emitter pattern
 */

/**
 * Create a reactive state store
 */
class StateStore {
    constructor(initialState = {}) {
        this._state = { ...initialState };
        this._listeners = new Map();
        this._nextId = 0;
    }

    /**
     * Get current state
     */
    get state() {
        return this._state;
    }

    /**
     * Get a specific state value
     * @param {string} key 
     */
    get(key) {
        return this._state[key];
    }

    /**
     * Set state value(s) and notify listeners
     * @param {object|string} keyOrUpdates - Key name or object of updates
     * @param {any} [value] - Value if key is string
     */
    set(keyOrUpdates, value) {
        const updates = typeof keyOrUpdates === 'string'
            ? { [keyOrUpdates]: value }
            : keyOrUpdates;

        const changedKeys = [];
        for (const [key, val] of Object.entries(updates)) {
            if (this._state[key] !== val) {
                this._state[key] = val;
                changedKeys.push(key);
            }
        }

        if (changedKeys.length > 0) {
            this._notify(changedKeys);
        }
    }

    /**
     * Subscribe to state changes
     * @param {string|string[]} keys - Key(s) to watch
     * @param {function} callback - Called with (newValue, key, state)
     * @returns {function} Unsubscribe function
     */
    subscribe(keys, callback) {
        const keyArray = Array.isArray(keys) ? keys : [keys];
        const id = this._nextId++;

        for (const key of keyArray) {
            if (!this._listeners.has(key)) {
                this._listeners.set(key, new Map());
            }
            this._listeners.get(key).set(id, callback);
        }

        // Return unsubscribe function
        return () => {
            for (const key of keyArray) {
                this._listeners.get(key)?.delete(id);
            }
        };
    }

    /**
     * Notify listeners of changes
     * @param {string[]} changedKeys 
     */
    _notify(changedKeys) {
        for (const key of changedKeys) {
            const listeners = this._listeners.get(key);
            if (listeners) {
                for (const callback of listeners.values()) {
                    try {
                        callback(this._state[key], key, this._state);
                    } catch (error) {
                        console.error('[Flint] State listener error:', error);
                    }
                }
            }
        }
    }
}

// =============================================================================
// Application State
// =============================================================================

/**
 * @typedef {Object} AppState
 * @property {'ready'|'working'|'error'} status - Application status
 * @property {string|null} statusMessage - Status message
 * @property {boolean} hashesLoaded - Whether hashes are loaded
 * @property {number} hashCount - Number of loaded hashes
 * @property {string|null} leaguePath - League installation path
 * @property {object|null} currentProject - Current project data
 * @property {string|null} currentProjectPath - Path to current project
 * @property {object[]} recentProjects - Recent projects list
 * @property {string|null} selectedFile - Currently selected file in tree
 * @property {string} currentView - Current view: 'welcome' | 'preview' | 'editor'
 * @property {string|null} activeModal - Current modal: null | 'newProject' | 'settings'
 */

const initialState = {
    // App status
    status: 'ready',
    statusMessage: 'Ready',

    // Creator info (for repathing)
    creatorName: null,

    // Hash status
    hashesLoaded: false,
    hashCount: 0,

    // League installation
    leaguePath: null,

    // Project state
    currentProject: null,
    currentProjectPath: null,
    recentProjects: [],

    // UI state
    selectedFile: null,
    currentView: 'welcome',
    activeModal: null,
    modalOptions: null,

    // File tree
    fileTree: null,
    expandedFolders: new Set(),

    // Champions (cached)
    champions: [],
    championsLoaded: false,

    // Toast notifications
    toasts: [],
};

// Create the global state store
export const state = new StateStore(initialState);

// =============================================================================
// Image Cache (LRU for decoded DDS images)
// =============================================================================

const IMAGE_CACHE_MAX_SIZE = 50;
const imageCache = new Map();

/**
 * Get a cached image or null if not cached
 * @param {string} path - File path
 * @returns {object|null} - Cached image data or null
 */
export function getCachedImage(path) {
    const cached = imageCache.get(path);
    if (cached) {
        // Move to end (most recently used)
        imageCache.delete(path);
        imageCache.set(path, cached);
        console.log('[Flint] Image cache hit:', path);
        return cached;
    }
    return null;
}

/**
 * Cache an image
 * @param {string} path - File path
 * @param {object} imageData - Image data to cache
 */
export function cacheImage(path, imageData) {
    // Evict oldest if at capacity
    if (imageCache.size >= IMAGE_CACHE_MAX_SIZE) {
        const oldestKey = imageCache.keys().next().value;
        imageCache.delete(oldestKey);
        console.log('[Flint] Image cache evicted:', oldestKey);
    }
    imageCache.set(path, imageData);
    console.log('[Flint] Image cached:', path, `(${imageCache.size}/${IMAGE_CACHE_MAX_SIZE})`);
}

/**
 * Clear the image cache
 */
export function clearImageCache() {
    imageCache.clear();
    console.log('[Flint] Image cache cleared');
}

// =============================================================================
// Settings Persistence
// =============================================================================

const SETTINGS_KEY = 'flint_settings';

/**
 * Load settings from localStorage
 */
export function loadSettings() {
    try {
        const stored = localStorage.getItem(SETTINGS_KEY);
        if (stored) {
            const settings = JSON.parse(stored);
            state.set({
                leaguePath: settings.leaguePath || null,
                recentProjects: settings.recentProjects || [],
                creatorName: settings.creatorName || null,
            });
        }
    } catch (error) {
        console.error('[Flint] Failed to load settings:', error);
    }
}

/**
 * Save settings to localStorage
 */
export function saveSettings() {
    try {
        const settings = {
            leaguePath: state.get('leaguePath'),
            recentProjects: state.get('recentProjects'),
            creatorName: state.get('creatorName'),
        };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
        console.error('[Flint] Failed to save settings:', error);
    }
}

/**
 * Add a project to recent projects list
 * @param {object} project - Project info from backend
 * @param {string} path - Project path
 */
export function addRecentProject(project, path) {
    const recent = state.get('recentProjects').filter(p => p.path !== path);
    recent.unshift({
        name: project.display_name || project.name,  // Use display_name if available
        champion: project.champion,
        skin: project.skin_id ?? project.skin,  // Backend uses skin_id
        path: path,
        lastOpened: new Date().toISOString(),
    });
    // Keep only last 10
    state.set('recentProjects', recent.slice(0, 10));
    saveSettings();
}

/**
 * Remove a project from recent projects list
 * @param {string} path - Project path to remove
 */
export function removeRecentProject(path) {
    const recent = state.get('recentProjects').filter(p => p.path !== path);
    state.set('recentProjects', recent);
    saveSettings();
}

/**
 * Clean stale recent projects (ones whose folders no longer exist)
 * Uses the list_project_files API to check if project exists
 */
export async function cleanStaleProjects() {
    try {
        const { invoke } = await import('@tauri-apps/api/core');
        const recent = state.get('recentProjects');
        const validProjects = [];

        for (const project of recent) {
            try {
                // Try to list files - will fail if path doesn't exist
                await invoke('list_project_files', { projectPath: project.path });
                validProjects.push(project);
            } catch (e) {
                console.log('[Flint] Removing stale project:', project.path);
            }
        }

        if (validProjects.length !== recent.length) {
            state.set('recentProjects', validProjects);
            saveSettings();
            console.log(`[Flint] Cleaned ${recent.length - validProjects.length} stale projects`);
        }
    } catch (error) {
        console.error('[Flint] Failed to clean stale projects:', error);
    }
}

// =============================================================================
// Status Helpers
// =============================================================================

/**
 * Set app status to working
 * @param {string} message 
 */
export function setWorking(message = 'Working...') {
    state.set({
        status: 'working',
        statusMessage: message,
    });
}

/**
 * Set app status to ready
 * @param {string} [message]
 */
export function setReady(message = 'Ready') {
    state.set({
        status: 'ready',
        statusMessage: message,
    });
}

/**
 * Set app status to error
 * @param {string} message 
 */
export function setError(message) {
    state.set({
        status: 'error',
        statusMessage: message,
    });
}

/**
 * Open a modal
 * @param {'newProject'|'settings'|'export'} modal 
 * @param {object} [options] - Modal-specific options
 */
export function openModal(modal, options = null) {
    state.set({
        activeModal: modal,
        modalOptions: options
    });
}

/**
 * Close current modal
 */
export function closeModal() {
    state.set({
        activeModal: null,
        modalOptions: null
    });
}

// =============================================================================
// Toast Notifications
// =============================================================================

let toastId = 0;

/**
 * Show a toast notification
 * @param {'info'|'success'|'warning'|'error'} type - Toast type
 * @param {string} message - Toast message
 * @param {object} [options] - Additional options
 * @param {string} [options.suggestion] - Recovery suggestion
 * @param {number} [options.duration] - Auto-dismiss duration in ms (default: 5000, 0 = no auto-dismiss)
 * @returns {number} Toast ID for manual dismissal
 */
export function showToast(type, message, options = {}) {
    const id = ++toastId;
    const toast = {
        id,
        type,
        message,
        suggestion: options.suggestion || null,
        timestamp: Date.now(),
    };

    const toasts = [...state.get('toasts'), toast];
    state.set('toasts', toasts);

    // Auto-dismiss after duration (default 5s, unless 0)
    const duration = options.duration !== undefined ? options.duration : 5000;
    if (duration > 0) {
        setTimeout(() => dismissToast(id), duration);
    }

    return id;
}

/**
 * Dismiss a toast notification
 * @param {number} id - Toast ID to dismiss
 */
export function dismissToast(id) {
    const toasts = state.get('toasts').filter(t => t.id !== id);
    state.set('toasts', toasts);
}

/**
 * Show an error toast from a FlintError
 * @param {Error} error - The error (preferably FlintError)
 */
export function showErrorToast(error) {
    const message = error.getUserMessage ? error.getUserMessage() : error.message;
    const suggestion = error.getRecoverySuggestion ? error.getRecoverySuggestion() : null;
    showToast('error', message, { suggestion, duration: 8000 });
}

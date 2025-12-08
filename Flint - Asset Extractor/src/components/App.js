/**
 * Flint - Main Application Component
 */

import { h, initShortcuts, registerShortcut } from '../lib/utils.js';
import { state, loadSettings, openModal, closeModal, cleanStaleProjects } from '../lib/state.js';
import * as api from '../lib/api.js';

import { TopBar } from './TopBar.js';
import { LeftPanel } from './FileTree.js';
import { CenterPanel } from './CenterPanel.js';
import { StatusBar } from './StatusBar.js';
import { NewProjectModal } from './modals/NewProjectModal.js';
import { SettingsModal } from './modals/SettingsModal.js';
import { ExportModal } from './modals/ExportModal.js';
import { FirstTimeSetupModal } from './modals/FirstTimeSetupModal.js';
import { ToastContainer } from './Toast.js';

/**
 * Initialize and mount the Flint application
 */
export async function initApp() {
    console.log('[Flint] Initializing application...');

    // Load persisted settings
    loadSettings();

    // Clean up stale recent projects (async, non-blocking)
    cleanStaleProjects();

    // Initialize keyboard shortcuts
    initShortcuts();
    registerShortcuts();

    // Build the app structure
    const app = document.getElementById('app');
    if (!app) {
        console.error('[Flint] Could not find #app element');
        return;
    }

    app.innerHTML = '';

    // Create main layout
    const topbar = TopBar();
    const mainContent = h('div', { className: 'main-content', id: 'main-content' });
    const statusbar = StatusBar();

    // Left panel (file tree) - only visible when project is open
    const leftPanel = LeftPanel();
    leftPanel.id = 'left-panel';

    // Panel resizer
    const resizer = h('div', { className: 'panel-resizer', id: 'panel-resizer' });
    setupPanelResizer(resizer, leftPanel);

    // Center panel
    const centerPanel = CenterPanel();

    mainContent.append(leftPanel, resizer, centerPanel);
    app.append(topbar, mainContent, statusbar);

    // Update layout visibility based on project state
    const updateLayoutVisibility = () => {
        const hasProject = state.get('currentProjectPath');
        leftPanel.style.display = hasProject ? '' : 'none';
        resizer.style.display = hasProject ? '' : 'none';
    };

    // Initial visibility
    updateLayoutVisibility();

    // Update when project changes
    state.subscribe('currentProjectPath', updateLayoutVisibility);

    // Add modals to body
    document.body.appendChild(NewProjectModal());
    document.body.appendChild(SettingsModal());
    document.body.appendChild(ExportModal());
    document.body.appendChild(FirstTimeSetupModal());

    // Add toast container
    document.body.appendChild(ToastContainer());

    // Load initial data
    await loadInitialData();

    // Check if first-time setup is needed
    if (!state.get('creatorName')) {
        openModal('firstTimeSetup');
    }

    console.log('[Flint] Application initialized');
}

/**
 * Register keyboard shortcuts
 */
function registerShortcuts() {
    // New project: Ctrl+N
    registerShortcut('ctrl+n', () => {
        openModal('newProject');
    });

    // Save: Ctrl+S
    registerShortcut('ctrl+s', async () => {
        const project = state.get('currentProject');
        if (project) {
            try {
                state.set({ status: 'working', statusMessage: 'Saving...' });
                await api.saveProject(project);
                state.set({ status: 'ready', statusMessage: 'Saved' });
            } catch (error) {
                console.error('Failed to save:', error);
                state.set({ status: 'error', statusMessage: 'Save failed' });
            }
        }
    });

    // Settings: Ctrl+,
    registerShortcut('ctrl+,', () => {
        openModal('settings');
    });

    // Export: Ctrl+E (when project is open)
    registerShortcut('ctrl+e', () => {
        if (state.get('currentProject')) {
            openModal('export');
        }
    });

    // Close modal: Escape
    registerShortcut('escape', () => {
        if (state.get('activeModal')) {
            closeModal();
        }
    });
}

/**
 * Set up panel resizer drag behavior
 * @param {HTMLElement} resizer 
 * @param {HTMLElement} panel 
 */
function setupPanelResizer(resizer, panel) {
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.clientX;
        startWidth = panel.offsetWidth;

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const diff = e.clientX - startX;
        const newWidth = Math.min(400, Math.max(200, startWidth + diff));
        panel.style.width = `${newWidth}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });

    // Double-click to toggle collapse
    resizer.addEventListener('dblclick', () => {
        if (panel.style.width === '48px') {
            panel.style.width = '280px';
        } else {
            panel.style.width = '48px';
        }
    });
}

/**
 * Load initial data (hash status, detect League)
 */
async function loadInitialData() {
    try {
        // Get initial hash status (may be 0 if still loading)
        let hashStatus = await api.getHashStatus();
        state.set({
            hashesLoaded: hashStatus.loaded_count > 0,
            hashCount: hashStatus.loaded_count
        });

        // Poll for hash status since backend loads async
        if (hashStatus.loaded_count === 0) {
            pollHashStatus();
        }

        // Try to detect League if not already set
        if (!state.get('leaguePath')) {
            try {
                const leagueResult = await api.detectLeague();
                if (leagueResult.path) {
                    state.set({ leaguePath: leagueResult.path });
                    console.log('[Flint] Auto-detected League path:', leagueResult.path);
                }
            } catch (error) {
                // Ignore - user can set manually
                console.log('[Flint] League auto-detection failed, user will set manually');
            }
        }

    } catch (error) {
        console.error('[Flint] Failed to load initial data:', error);
    }
}

/**
 * Poll for hash status until hashes are loaded
 */
async function pollHashStatus() {
    const maxAttempts = 30; // Poll for up to 30 seconds
    let attempts = 0;

    const poll = async () => {
        try {
            const status = await api.getHashStatus();
            if (status.loaded_count > 0) {
                state.set({
                    hashesLoaded: true,
                    hashCount: status.loaded_count
                });
                console.log(`[Flint] Hashes loaded: ${status.loaded_count.toLocaleString()}`);
                return;
            }

            attempts++;
            if (attempts < maxAttempts) {
                setTimeout(poll, 1000);
            }
        } catch (error) {
            console.error('[Flint] Error polling hash status:', error);
        }
    };

    setTimeout(poll, 1000);
}

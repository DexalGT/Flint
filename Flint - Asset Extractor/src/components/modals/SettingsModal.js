/**
 * Flint - Settings Modal Component
 */

import { h, showToast } from '../../lib/utils.js';
import { state, closeModal, saveSettings, setWorking, setReady, setError } from '../../lib/state.js';
import * as api from '../../lib/api.js';

/**
 * Create the SettingsModal component
 * @returns {HTMLElement}
 */
export function SettingsModal() {
    const overlay = h('div', {
        className: 'modal-overlay',
        id: 'settings-modal',
        onClick: (e) => { if (e.target === overlay) closeModal(); }
    });

    const modal = h('div', { className: 'modal' });

    // Header
    const header = h('div', { className: 'modal__header' },
        h('h2', { className: 'modal__title' }, 'Settings'),
        h('button', { className: 'modal__close', onClick: closeModal }, '✕')
    );

    // Body
    const body = h('div', { className: 'modal__body' });

    // Creator Name (for repathing)
    body.appendChild(
        h('div', { className: 'form-group' },
            h('label', { className: 'form-label' }, 'Creator Name'),
            h('input', {
                type: 'text',
                className: 'form-input',
                id: 'creator-name-input',
                placeholder: 'e.g., SirDexal',
                value: state.get('creatorName') || ''
            }),
            h('p', {
                style: { marginTop: '4px', fontSize: '12px', color: 'var(--text-secondary)' }
            }, 'Used for repathing: ASSETS/{CreatorName}/{ProjectName}/')
        )
    );

    // League Installation Path
    body.appendChild(
        h('div', { className: 'form-group' },
            h('label', { className: 'form-label' }, 'League of Legends Installation Path'),
            h('div', { className: 'form-input--with-button' },
                h('input', {
                    type: 'text',
                    className: 'form-input',
                    id: 'league-path-input',
                    placeholder: 'C:\\Riot Games\\League of Legends',
                    value: state.get('leaguePath') || ''
                }),
                h('button', {
                    className: 'btn btn--secondary',
                    onClick: selectLeaguePath
                }, '...'),
                h('button', {
                    className: 'btn btn--ghost',
                    onClick: detectLeaguePath,
                    title: 'Auto-detect League path'
                }, '🔍')
            ),
            h('div', {
                id: 'league-path-status',
                style: { marginTop: '8px', fontSize: '12px' }
            })
        )
    );

    // Default Project Location
    body.appendChild(
        h('div', { className: 'form-group' },
            h('label', { className: 'form-label' }, 'Default Project Location'),
            h('div', { className: 'form-input--with-button' },
                h('input', {
                    type: 'text',
                    className: 'form-input',
                    id: 'default-project-path-input',
                    placeholder: 'C:\\Users\\...\\Flint Projects'
                }),
                h('button', {
                    className: 'btn btn--secondary',
                    onClick: selectDefaultProjectPath
                }, '...')
            )
        )
    );

    // Hash Management
    body.appendChild(
        h('div', { className: 'form-group' },
            h('label', { className: 'form-label' }, 'Hash Files'),
            h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
                h('span', {
                    id: 'hash-status-text',
                    style: { flex: 1, color: 'var(--text-secondary)' }
                }, 'Loading...'),
                h('button', {
                    className: 'btn btn--secondary',
                    onClick: reloadHashes
                }, 'Reload'),
                h('button', {
                    className: 'btn btn--secondary',
                    onClick: downloadHashes
                }, 'Download')
            )
        )
    );

    // Footer
    const footer = h('div', { className: 'modal__footer' },
        h('button', { className: 'btn btn--secondary', onClick: closeModal }, 'Cancel'),
        h('button', {
            className: 'btn btn--primary',
            onClick: handleSaveSettings
        }, 'Save Settings')
    );

    modal.append(header, body, footer);
    overlay.appendChild(modal);

    // Subscribe to modal visibility
    state.subscribe('activeModal', (active) => {
        if (active === 'settings') {
            overlay.classList.add('modal-overlay--visible');
            updateHashStatus();
            updateLeaguePathInput();
        } else {
            overlay.classList.remove('modal-overlay--visible');
        }
    });

    return overlay;
}

/**
 * Update league path input value
 */
function updateLeaguePathInput() {
    const input = document.getElementById('league-path-input');
    if (input && state.get('leaguePath')) {
        input.value = state.get('leaguePath');
    }
}

/**
 * Update hash status display
 */
async function updateHashStatus() {
    const statusText = document.getElementById('hash-status-text');
    if (!statusText) return;

    const count = state.get('hashCount');
    const loaded = state.get('hashesLoaded');

    if (loaded && count > 0) {
        statusText.textContent = `${count.toLocaleString()} hashes loaded`;
        statusText.style.color = 'var(--success)';
    } else {
        statusText.textContent = 'No hashes loaded';
        statusText.style.color = 'var(--warning)';
    }
}

/**
 * Select League path via file dialog
 */
async function selectLeaguePath() {
    try {
        const { open } = await import('@tauri-apps/plugin-dialog');

        const selected = await open({
            title: 'Select League of Legends Installation',
            directory: true
        });

        if (selected) {
            const input = document.getElementById('league-path-input');
            if (input) input.value = selected;
            await validateLeaguePath(selected);
        }
    } catch (error) {
        console.error('Failed to open folder picker:', error);
    }
}

/**
 * Auto-detect League path
 */
async function detectLeaguePath() {
    const statusDiv = document.getElementById('league-path-status');
    const input = document.getElementById('league-path-input');

    try {
        setWorking('Detecting League installation...');

        const result = await api.detectLeague();

        if (result.path) {
            if (input) input.value = result.path;
            if (statusDiv) {
                statusDiv.textContent = `✓ Found via ${result.source}`;
                statusDiv.style.color = 'var(--success)';
            }
            setReady('League installation detected');
        }
    } catch (error) {
        console.error('Failed to detect League:', error);
        if (statusDiv) {
            statusDiv.textContent = '✗ Could not detect League installation';
            statusDiv.style.color = 'var(--error)';
        }
        setReady();
        showToast('Could not detect League installation. Please select manually.', 'warning');
    }
}

/**
 * Validate a League path
 * @param {string} path 
 */
async function validateLeaguePath(path) {
    const statusDiv = document.getElementById('league-path-status');

    try {
        // If validateLeague succeeds, the path is valid
        const result = await api.validateLeague(path);

        // Backend returns LeagueInstallation on success
        if (result && result.path) {
            if (statusDiv) {
                statusDiv.textContent = '✓ Valid League installation';
                statusDiv.style.color = 'var(--success)';
            }
        }
    } catch (error) {
        // If it throws, the path is invalid
        console.error('Failed to validate League path:', error);
        if (statusDiv) {
            statusDiv.textContent = '✗ Not a valid League installation';
            statusDiv.style.color = 'var(--error)';
        }
    }
}

/**
 * Select default project path
 */
async function selectDefaultProjectPath() {
    try {
        const { open } = await import('@tauri-apps/plugin-dialog');

        const selected = await open({
            title: 'Select Default Project Location',
            directory: true
        });

        if (selected) {
            const input = document.getElementById('default-project-path-input');
            if (input) input.value = selected;
        }
    } catch (error) {
        console.error('Failed to open folder picker:', error);
    }
}

/**
 * Reload hash files
 */
async function reloadHashes() {
    try {
        setWorking('Reloading hashes...');
        await api.reloadHashes();

        // Get the updated count
        const status = await api.getHashStatus();
        const count = status?.loaded_count || 0;

        state.set({ hashCount: count, hashesLoaded: count > 0 });
        updateHashStatus();
        setReady('Hashes reloaded');
        showToast(`Loaded ${count.toLocaleString()} hashes`, 'success');
    } catch (error) {
        console.error('Failed to reload hashes:', error);
        setError('Failed to reload hashes');
        showToast('Failed to reload hashes', 'error');
    }
}

/**
 * Download hash files from CommunityDragon
 */
async function downloadHashes() {
    try {
        setWorking('Downloading hashes...');
        const result = await api.downloadHashes();

        // Get the hash count after download
        const status = await api.getHashStatus();
        const count = status?.loaded_count || 0;

        state.set({ hashCount: count, hashesLoaded: count > 0 });
        updateHashStatus();
        setReady('Hashes downloaded');
        showToast(`Downloaded ${result.downloaded} hash files (${count.toLocaleString()} hashes)`, 'success');
    } catch (error) {
        console.error('Failed to download hashes:', error);
        setError('Failed to download hashes');
        showToast('Failed to download hashes. Check your internet connection.', 'error');
    }
}

/**
 * Save settings
 */
async function handleSaveSettings() {
    const leaguePathInput = document.getElementById('league-path-input');
    const creatorNameInput = document.getElementById('creator-name-input');
    const leaguePath = leaguePathInput?.value?.trim();
    const creatorName = creatorNameInput?.value?.trim();

    // Validate League path if provided
    if (leaguePath) {
        try {
            // If this succeeds, the path is valid
            await api.validateLeague(leaguePath);
        } catch (error) {
            console.error('Failed to validate League path:', error);
            showToast('The selected League path is invalid', 'error');
            return;
        }
    }

    // Save to state
    state.set({ leaguePath, creatorName });

    // Clear champion cache so it reloads
    state.set({ champions: [], championsLoaded: false });

    // Persist
    saveSettings();

    showToast('Settings saved', 'success');
    closeModal();
}

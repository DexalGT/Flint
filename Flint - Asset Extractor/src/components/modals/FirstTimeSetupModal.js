/**
 * Flint - First Time Setup Modal Component
 * 
 * Shown on first launch when creator name is not configured.
 * This is required for the repathing system to work properly.
 */

import { h, showToast } from '../../lib/utils.js';
import { state, closeModal, saveSettings, setWorking, setReady, setError } from '../../lib/state.js';
import * as api from '../../lib/api.js';

/**
 * Create the FirstTimeSetupModal component
 * @returns {HTMLElement}
 */
export function FirstTimeSetupModal() {
    const overlay = h('div', {
        className: 'modal-overlay',
        id: 'first-time-setup-modal',
        // Don't allow clicking outside to close - this is required setup
    });

    const modal = h('div', { className: 'modal' });

    // Header
    const header = h('div', { className: 'modal__header' },
        h('h2', { className: 'modal__title' }, '👋 Welcome to Flint!')
    );

    // Body
    const body = h('div', { className: 'modal__body' });

    // Welcome message
    body.appendChild(
        h('p', { style: { marginBottom: '16px', color: 'var(--text-secondary)' } },
            'Let\'s set up a few things before you start creating mods.'
        )
    );

    // Creator Name (required)
    body.appendChild(
        h('div', { className: 'form-group' },
            h('label', { className: 'form-label' },
                'Creator Name ',
                h('span', { style: { color: 'var(--error)' } }, '*')
            ),
            h('input', {
                type: 'text',
                className: 'form-input',
                id: 'setup-creator-name-input',
                placeholder: 'e.g., SirDexal'
            }),
            h('p', {
                style: { marginTop: '4px', fontSize: '12px', color: 'var(--text-secondary)' }
            }, 'Your creator name is used for repathing assets to prevent mod conflicts.'),
            h('p', {
                style: { marginTop: '4px', fontSize: '12px', color: 'var(--text-tertiary)' }
            }, 'Example: ASSETS/SirDexal/MyMod/...')
        )
    );

    // League Path (optional but recommended)
    body.appendChild(
        h('div', { className: 'form-group' },
            h('label', { className: 'form-label' }, 'League of Legends Path'),
            h('div', { className: 'form-input--with-button' },
                h('input', {
                    type: 'text',
                    className: 'form-input',
                    id: 'setup-league-path-input',
                    placeholder: 'C:\\Riot Games\\League of Legends'
                }),
                h('button', {
                    className: 'btn btn--secondary',
                    onClick: selectLeaguePath
                }, '...'),
                h('button', {
                    className: 'btn btn--ghost',
                    onClick: detectLeaguePath,
                    title: 'Auto-detect'
                }, '🔍')
            ),
            h('div', {
                id: 'setup-league-path-status',
                style: { marginTop: '8px', fontSize: '12px' }
            })
        )
    );

    // Footer
    const footer = h('div', { className: 'modal__footer' },
        h('button', {
            className: 'btn btn--primary',
            onClick: handleCompleteSetup
        }, 'Complete Setup')
    );

    modal.append(header, body, footer);
    overlay.appendChild(modal);

    // Subscribe to modal visibility
    state.subscribe('activeModal', (active) => {
        if (active === 'firstTimeSetup') {
            overlay.classList.add('modal-overlay--visible');
            // Try auto-detecting League path
            setTimeout(() => detectLeaguePath(), 100);
        } else {
            overlay.classList.remove('modal-overlay--visible');
        }
    });

    return overlay;
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
            const input = document.getElementById('setup-league-path-input');
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
    const statusDiv = document.getElementById('setup-league-path-status');
    const input = document.getElementById('setup-league-path-input');

    try {
        const result = await api.detectLeague();

        if (result.path) {
            if (input) input.value = result.path;
            if (statusDiv) {
                statusDiv.textContent = `✓ Found via ${result.source}`;
                statusDiv.style.color = 'var(--success)';
            }
        }
    } catch (error) {
        // Silent failure - not a required field
        console.log('Could not auto-detect League path:', error);
    }
}

/**
 * Validate a League path
 * @param {string} path 
 */
async function validateLeaguePath(path) {
    const statusDiv = document.getElementById('setup-league-path-status');

    try {
        const result = await api.validateLeague(path);

        if (result && result.path) {
            if (statusDiv) {
                statusDiv.textContent = '✓ Valid League installation';
                statusDiv.style.color = 'var(--success)';
            }
        }
    } catch (error) {
        console.error('Failed to validate League path:', error);
        if (statusDiv) {
            statusDiv.textContent = '✗ Not a valid League installation';
            statusDiv.style.color = 'var(--error)';
        }
    }
}

/**
 * Handle completing the setup
 */
async function handleCompleteSetup() {
    const creatorNameInput = document.getElementById('setup-creator-name-input');
    const leaguePathInput = document.getElementById('setup-league-path-input');

    const creatorName = creatorNameInput?.value?.trim();
    const leaguePath = leaguePathInput?.value?.trim();

    // Validate creator name (required)
    if (!creatorName) {
        showToast('Please enter your creator name', 'error');
        creatorNameInput?.focus();
        return;
    }

    // Validate creator name format (alphanumeric, no spaces)
    if (!/^[a-zA-Z0-9_-]+$/.test(creatorName)) {
        showToast('Creator name can only contain letters, numbers, underscores, and hyphens', 'error');
        creatorNameInput?.focus();
        return;
    }

    // Validate League path if provided
    if (leaguePath) {
        try {
            await api.validateLeague(leaguePath);
        } catch (error) {
            showToast('The selected League path is invalid', 'warning');
            // Don't block - user can set this later
        }
    }

    // Save to state
    state.set({ creatorName, leaguePath });

    // Persist
    saveSettings();

    showToast(`Welcome, ${creatorName}! You're all set.`, 'success');
    closeModal();
}

/**
 * Flint - Export Modal Component
 * 
 * Allows users to configure and export mods in .fantome or .modpkg format
 */

import { h } from '../../lib/utils.js';
import { state, closeModal, setWorking, setReady, setError } from '../../lib/state.js';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { listen } from '@tauri-apps/api/event';

/**
 * Create the Export Modal component
 * @returns {HTMLElement}
 */
export function ExportModal() {
    const overlay = h('div', {
        className: 'modal-overlay',
        id: 'export-modal',
        onClick: (e) => { if (e.target === overlay) closeModal(); }
    });

    const modal = h('div', { className: 'modal modal--export' },
        h('div', { className: 'modal__header' },
            h('h2', { className: 'modal__title' }, 'Export Mod'),
            h('button', {
                className: 'modal__close',
                onClick: () => closeModal()
            }, '×')
        ),
        h('div', { className: 'modal__body' },
            // Format Selection
            h('div', { className: 'form-group' },
                h('label', { className: 'form-label' }, 'Export Format'),
                h('div', { className: 'radio-group', id: 'format-selection' },
                    createRadioButton('format', 'fantome', '.fantome (Legacy)', true),
                    createRadioButton('format', 'modpkg', '.modpkg (Modern)', false)
                )
            ),

            // Mod Name
            h('div', { className: 'form-group' },
                h('label', { className: 'form-label', for: 'export-name' }, 'Mod Name'),
                h('input', {
                    type: 'text',
                    id: 'export-name',
                    className: 'form-input',
                    placeholder: 'My Awesome Mod'
                })
            ),

            // Author
            h('div', { className: 'form-group' },
                h('label', { className: 'form-label', for: 'export-author' }, 'Author'),
                h('input', {
                    type: 'text',
                    id: 'export-author',
                    className: 'form-input',
                    placeholder: 'Your Name'
                })
            ),

            // Version
            h('div', { className: 'form-group' },
                h('label', { className: 'form-label', for: 'export-version' }, 'Version'),
                h('input', {
                    type: 'text',
                    id: 'export-version',
                    className: 'form-input',
                    placeholder: '1.0.0',
                    value: '1.0.0'
                })
            ),

            // Description
            h('div', { className: 'form-group' },
                h('label', { className: 'form-label', for: 'export-description' }, 'Description'),
                h('textarea', {
                    id: 'export-description',
                    className: 'form-input form-textarea',
                    rows: 3,
                    placeholder: 'A brief description of your mod...'
                })
            ),

            // Progress Section (hidden by default)
            h('div', { className: 'export-progress', id: 'export-progress', style: { display: 'none' } },
                h('div', { className: 'progress-bar' },
                    h('div', { className: 'progress-bar__fill', id: 'export-progress-fill' })
                ),
                h('p', { className: 'progress-text', id: 'export-progress-text' }, 'Preparing export...')
            )
        ),
        h('div', { className: 'modal__footer' },
            h('button', {
                className: 'btn btn--secondary',
                onClick: () => closeModal()
            }, 'Cancel'),
            h('button', {
                className: 'btn btn--primary',
                id: 'export-submit-btn',
                onClick: handleExport
            }, 'Export')
        )
    );

    overlay.appendChild(modal);

    // Subscribe to modal visibility
    state.subscribe('activeModal', (active) => {
        if (active === 'export') {
            overlay.classList.add('modal-overlay--visible');
            // Populate form with current project data
            setTimeout(() => populateForm(), 50);
        } else {
            overlay.classList.remove('modal-overlay--visible');
        }
    });

    return overlay;
}

/**
 * Create a radio button with label
 */
function createRadioButton(name, value, label, checked = false) {
    const id = `${name}-${value}`;
    return h('label', { className: 'radio-label', for: id },
        h('input', {
            type: 'radio',
            id,
            name,
            value,
            checked
        }),
        h('span', { className: 'radio-text' }, label)
    );
}

/**
 * Populate form with current project data
 */
function populateForm() {
    const project = state.get('currentProject');
    if (!project) return;

    const nameInput = document.getElementById('export-name');
    const versionInput = document.getElementById('export-version');
    const descInput = document.getElementById('export-description');

    if (nameInput) nameInput.value = project.display_name || project.name || '';
    if (versionInput) versionInput.value = project.version || '1.0.0';
    if (descInput) descInput.value = project.description || `Mod for ${project.champion} skin ${project.skin_id}`;
}

/**
 * Handle export button click
 */
async function handleExport() {
    const project = state.get('currentProject');
    const projectPath = state.get('currentProjectPath');

    if (!project || !projectPath) {
        setError('No project open');
        return;
    }

    // Get form values
    const format = document.querySelector('input[name="format"]:checked')?.value || 'fantome';
    const name = document.getElementById('export-name').value.trim() || project.name;
    const author = document.getElementById('export-author').value.trim() || 'Unknown';
    const version = document.getElementById('export-version').value.trim() || '1.0.0';
    const description = document.getElementById('export-description').value.trim() || '';

    // Get filename suggestion
    const filename = await invoke('get_fantome_filename', { name, version });

    // Show save dialog
    const outputPath = await save({
        defaultPath: filename,
        filters: format === 'fantome'
            ? [{ name: 'Fantome Mod', extensions: ['fantome'] }]
            : [{ name: 'Mod Package', extensions: ['modpkg'] }]
    });

    if (!outputPath) {
        return; // User cancelled
    }

    // Show progress
    const progressSection = document.getElementById('export-progress');
    const progressFill = document.getElementById('export-progress-fill');
    const progressText = document.getElementById('export-progress-text');
    const exportBtn = document.getElementById('export-btn');

    if (progressSection) progressSection.style.display = 'block';
    if (exportBtn) exportBtn.disabled = true;

    // Listen for progress events
    const unlisten = await listen('export-progress', (event) => {
        const { status, progress, message } = event.payload;
        if (progressFill) progressFill.style.width = `${(progress || 0) * 100}%`;
        if (progressText) progressText.textContent = message || status;
    });

    try {
        setWorking('Exporting mod...');

        if (format === 'fantome') {
            const result = await invoke('export_fantome', {
                projectPath,
                outputPath,
                champion: project.champion,
                metadata: { name, author, version, description },
                autoRepath: true
            });

            setReady(`Exported successfully: ${result.file_count} files`);
            showSuccessNotification(result);
        } else {
            // TODO: Implement modpkg export
            setError('Modpkg export not yet implemented');
        }

        closeModal();
    } catch (error) {
        console.error('[Flint] Export failed:', error);
        setError(`Export failed: ${error}`);
        if (progressText) progressText.textContent = `Error: ${error}`;
    } finally {
        unlisten();
        if (exportBtn) exportBtn.disabled = false;
    }
}

/**
 * Show success notification
 */
function showSuccessNotification(result) {
    // Create a toast notification
    const toast = h('div', { className: 'toast toast--success' },
        h('span', { className: 'toast__icon' }, '✓'),
        h('div', { className: 'toast__content' },
            h('strong', {}, 'Export Complete'),
            h('p', {}, `Created ${result.file_count} files (${formatBytes(result.total_size)})`)
        )
    );

    document.body.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        toast.classList.add('toast--fade');
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default ExportModal;

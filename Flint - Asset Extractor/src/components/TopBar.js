/**
 * Flint - Top Bar Component
 */

import { h } from '../lib/utils.js';
import { state, openModal } from '../lib/state.js';

/**
 * Flint flame logo SVG
 */
const FlintLogo = () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'topbar__logo');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.innerHTML = `
    <path d="M12 2C8.5 6 8 10 8 12c0 3.5 1.5 6 4 8 2.5-2 4-4.5 4-8 0-2-.5-6-4-10z" fill="currentColor"/>
    <path d="M12 5c-2 3-2.5 5.5-2.5 7 0 2 .8 3.5 2.5 5 1.7-1.5 2.5-3 2.5-5 0-1.5-.5-4-2.5-7z" fill="var(--bg-secondary)"/>
    <path d="M12 8c-1 1.5-1.5 3-1.5 4 0 1.2.5 2.2 1.5 3 1-.8 1.5-1.8 1.5-3 0-1-.5-2.5-1.5-4z" fill="currentColor"/>
  `;
    return svg;
};

/**
 * Create the TopBar component
 * @returns {HTMLElement}
 */
export function TopBar() {
    const container = h('header', { className: 'topbar' });

    // Brand section
    const brand = h('div', {
        className: 'topbar__brand',
        style: { cursor: 'pointer' },
        title: 'Close Project and Return to Home',
        onClick: closeProject
    },
        FlintLogo(),
        h('span', { className: 'topbar__title' }, 'Flint')
    );

    // Divider
    const divider = h('div', { className: 'topbar__divider' });

    // Project name
    const projectSection = h('div', { className: 'topbar__project' },
        h('span', { className: 'topbar__project-icon' }, '📁'),
        h('span', { className: 'topbar__project-name', id: 'project-name' }, 'No Project Open')
    );

    // Spacer
    const spacer = h('div', { className: 'topbar__spacer' });

    // Actions
    const actions = h('div', { className: 'topbar__actions' },
        // Configure button
        h('button', {
            className: 'btn btn--ghost btn--icon',
            title: 'Settings',
            onClick: () => openModal('settings')
        }, '⚙️'),

        // Export dropdown
        h('div', { className: 'dropdown', id: 'export-dropdown' },
            h('button', {
                className: 'btn btn--primary btn--dropdown',
                id: 'export-btn',
                onClick: toggleExportDropdown
            }, 'Export Mod'),
            h('div', { className: 'dropdown__menu' },
                h('button', { className: 'dropdown__item', onClick: () => exportAs('fantome') },
                    '📦', 'Export as .fantome'
                ),
                h('button', { className: 'dropdown__item', onClick: () => exportAs('modpkg') },
                    '📦', 'Export as .modpkg'
                ),
                h('div', { className: 'dropdown__divider' }),
                h('button', { className: 'dropdown__item' },
                    '⚙️', 'Export Settings...'
                )
            )
        )
    );

    container.append(brand, divider, projectSection, spacer, actions);

    // Get export dropdown reference
    const exportDropdown = actions.querySelector('#export-dropdown');

    // Initially hide export dropdown (no project open at start)
    exportDropdown.style.display = 'none';

    // Subscribe to state changes
    state.subscribe('currentProject', (project) => {
        const nameEl = container.querySelector('#project-name');
        if (project) {
            nameEl.textContent = `${project.champion} - ${project.name}`;
            nameEl.classList.remove('topbar__project-name--unsaved');
            exportDropdown.style.display = '';  // Show export button
        } else {
            nameEl.textContent = 'No Project Open';
            exportDropdown.style.display = 'none';  // Hide export button
        }
    });

    return container;
}

/**
 * Toggle export dropdown visibility
 */
function toggleExportDropdown(e) {
    e.stopPropagation();
    const dropdown = document.getElementById('export-dropdown');
    dropdown.classList.toggle('dropdown--open');

    // Close when clicking outside
    const closeDropdown = (e) => {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('dropdown--open');
            document.removeEventListener('click', closeDropdown);
        }
    };

    if (dropdown.classList.contains('dropdown--open')) {
        setTimeout(() => document.addEventListener('click', closeDropdown), 0);
    }
}

/**
 * Export project in specified format
 * @param {'fantome'|'modpkg'} format 
 */
function exportAs(format) {
    const dropdown = document.getElementById('export-dropdown');
    dropdown.classList.remove('dropdown--open');

    // Open export modal with the selected format
    openModal('export', { format });
}

/**
 * Close current project and return to welcome screen
 */
function closeProject() {
    // Check if a project is actually open
    if (!state.get('currentProject')) return;

    // TODO: Check for unsaved changes before closing

    state.set({
        currentProject: null,
        currentProjectPath: null,
        currentView: 'welcome',
        fileTree: {},
        selectedFile: null,
        expandedFolders: new Set()
    });
}

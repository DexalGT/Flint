/**
 * Flint - Center Panel Component
 */

import { h } from '../lib/utils.js';
import { state } from '../lib/state.js';
import { WelcomeScreen } from './WelcomeScreen.js';
import { PreviewPanel } from './PreviewPanel.js';

/**
 * Create the CenterPanel component
 * @returns {HTMLElement}
 */
export function CenterPanel() {
    const container = h('main', { className: 'center-panel', id: 'center-panel' });

    // Render initial view
    renderView(container, state.get('currentView'));

    // Subscribe to view changes
    state.subscribe('currentView', (view) => {
        renderView(container, view);
    });

    // Also subscribe to selectedFile changes to refresh preview/editor
    state.subscribe('selectedFile', () => {
        const currentView = state.get('currentView');
        if (currentView === 'preview' || currentView === 'editor') {
            renderView(container, currentView);
        }
    });

    return container;
}

/**
 * Render the appropriate view based on state
 * @param {HTMLElement} container 
 * @param {string} view 
 */
function renderView(container, view) {
    container.innerHTML = '';

    switch (view) {
        case 'welcome':
            container.appendChild(WelcomeScreen());
            break;

        case 'preview':
            container.appendChild(PreviewPanel());
            break;

        case 'editor':
            container.appendChild(createEditorPanel());
            break;

        case 'project':
            // After opening a project, show welcome with file tree visible
            container.appendChild(createProjectView());
            break;

        default:
            container.appendChild(WelcomeScreen());
    }
}

/**
 * Create editor panel - now delegates to PreviewPanel which handles BIN files
 * @returns {HTMLElement}
 */
function createEditorPanel() {
    // BIN Editor is now integrated into PreviewPanel
    // When a .bin file is selected, it will be displayed using the BinEditor component
    return PreviewPanel();
}

/**
 * Create project view (shown after opening a project)
 * @returns {HTMLElement}
 */
function createProjectView() {
    const project = state.get('currentProject');

    return h('div', { className: 'project-view', style: { padding: '24px' } },
        h('h2', { style: { marginBottom: '16px' } },
            project ? `${project.champion} - ${project.name}` : 'Project'
        ),
        h('p', { style: { color: 'var(--text-secondary)', marginBottom: '24px' } },
            'Select a file from the tree on the left to preview or edit it.'
        ),
        h('div', {
            style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px'
            }
        },
            createQuickActionCard('🖼️', 'Textures', 'View and replace textures'),
            createQuickActionCard('📄', 'BIN Files', 'Edit particle and data files'),
            createQuickActionCard('🔊', 'Audio', 'Preview and replace sounds'),
            createQuickActionCard('📦', 'Export', 'Build your mod package')
        )
    );
}

/**
 * Create a quick action card
 * @param {string} icon 
 * @param {string} title 
 * @param {string} description 
 * @returns {HTMLElement}
 */
function createQuickActionCard(icon, title, description) {
    return h('div', {
        className: 'quick-action-card',
        style: {
            backgroundColor: 'var(--bg-secondary)',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
        },
        onMouseEnter: (e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
            e.currentTarget.style.transform = 'translateY(-2px)';
        },
        onMouseLeave: (e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.transform = 'translateY(0)';
        }
    },
        h('div', { style: { fontSize: '32px', marginBottom: '12px' } }, icon),
        h('div', { style: { fontWeight: '600', marginBottom: '4px' } }, title),
        h('div', { style: { fontSize: '12px', color: 'var(--text-muted)' } }, description)
    );
}

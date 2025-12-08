/**
 * Flint - Welcome Screen Component
 */

import { h, formatRelativeTime } from '../lib/utils.js';
import { state, openModal } from '../lib/state.js';
import * as api from '../lib/api.js';

/**
 * Flint flame logo SVG (larger version for welcome screen)
 */
const FlintLogoLarge = () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'welcome__logo');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.innerHTML = `
    <path d="M12 2C8.5 6 8 10 8 12c0 3.5 1.5 6 4 8 2.5-2 4-4.5 4-8 0-2-.5-6-4-10z" fill="currentColor"/>
    <path d="M12 5c-2 3-2.5 5.5-2.5 7 0 2 .8 3.5 2.5 5 1.7-1.5 2.5-3 2.5-5 0-1.5-.5-4-2.5-7z" fill="var(--bg-primary)"/>
    <path d="M12 8c-1 1.5-1.5 3-1.5 4 0 1.2.5 2.2 1.5 3 1-.8 1.5-1.8 1.5-3 0-1-.5-2.5-1.5-4z" fill="currentColor"/>
  `;
    return svg;
};

/**
 * Create the WelcomeScreen component
 * @returns {HTMLElement}
 */
export function WelcomeScreen() {
    const container = h('div', { className: 'welcome' });

    // Logo and title
    container.append(
        FlintLogoLarge(),
        h('h1', { className: 'welcome__title' }, 'FLINT'),
        h('p', { className: 'welcome__subtitle' }, 'League of Legends Modding IDE')
    );

    // Action buttons
    const actions = h('div', { className: 'welcome__actions' },
        h('button', {
            className: 'btn btn--primary',
            onClick: () => openModal('newProject')
        }, '➕ Create New Project'),
        h('button', {
            className: 'btn btn--secondary',
            onClick: handleOpenProject
        }, '📂 Open Existing Project')
    );
    container.appendChild(actions);

    // Recent projects section
    const recentSection = h('div', { className: 'welcome__recent', id: 'recent-projects' });
    container.appendChild(recentSection);

    // Render initial recent projects
    renderRecentProjects(recentSection, state.get('recentProjects'));

    // Subscribe to changes
    state.subscribe('recentProjects', (projects) => {
        renderRecentProjects(recentSection, projects);
    });

    return container;
}

/**
 * Render the recent projects list
 * @param {HTMLElement} container 
 * @param {object[]} projects 
 */
function renderRecentProjects(container, projects) {
    container.innerHTML = '';

    if (!projects || projects.length === 0) {
        return;
    }

    container.appendChild(
        h('h3', { className: 'welcome__recent-title' }, 'Recent Projects')
    );

    for (const project of projects.slice(0, 5)) {
        const item = h('div', {
            className: 'welcome__recent-item',
            onClick: () => openRecentProject(project.path)
        },
            h('span', {}, '📁'),
            h('span', { className: 'welcome__recent-name' },
                `${project.champion} - ${project.name}`
            ),
            h('span', { className: 'welcome__recent-date' },
                formatRelativeTime(project.lastOpened)
            )
        );
        container.appendChild(item);
    }
}

/**
 * Handle opening an existing project
 */
async function handleOpenProject() {
    try {
        // Import Tauri dialog
        const { open } = await import('@tauri-apps/plugin-dialog');

        const selected = await open({
            title: 'Open Flint Project',
            filters: [{
                name: 'Flint Project',
                extensions: ['json']
            }],
            multiple: false
        });

        if (selected) {
            await openRecentProject(selected);
        }
    } catch (error) {
        console.error('Failed to open project:', error);
    }
}

/**
 * Open a project by path
 * @param {string} projectPath 
 */
async function openRecentProject(projectPath) {
    try {
        state.set({ status: 'working', statusMessage: 'Opening project...' });

        const project = await api.openProject(projectPath);

        state.set({
            currentProject: project,
            currentProjectPath: projectPath,
            currentView: 'project',
        });

        // Determine project directory (strip project.json if present)
        // This handles both directory paths and file paths
        let projectDir = projectPath;
        if (projectDir.endsWith('project.json')) {
            // Remove \project.json or /project.json
            projectDir = projectDir.replace(/[\\/]project\.json$/, '');
        }

        // Fetch file tree
        try {
            const files = await api.listProjectFiles(projectDir);
            state.set({ fileTree: files });
        } catch (filesError) {
            console.error('Failed to load project files:', filesError);
            // Non-fatal, tree will just be empty
        }

        state.set({
            status: 'ready',
            statusMessage: 'Ready'
        });

        // Add to recent projects
        const { addRecentProject } = await import('../lib/state.js');
        addRecentProject(project, projectPath);

    } catch (error) {
        console.error('Failed to open project:', error);
        state.set({
            status: 'error',
            statusMessage: error.getUserMessage?.() || 'Failed to open project'
        });
    }
}

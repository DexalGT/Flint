/**
 * Flint - File Tree Component
 */

import { h, debounce } from '../lib/utils.js';
import { getFileIcon } from '../lib/fileIcons.js';
import { state, openModal, setWorking, setReady, setError } from '../lib/state.js';
import * as api from '../lib/api.js';

/**
 * Create the FileTree component
 * @returns {HTMLElement}
 */
export function FileTree() {
    const container = h('div', { className: 'file-tree', id: 'file-tree' });

    // Subscribe to file tree changes
    state.subscribe('fileTree', (tree) => {
        renderTree(container, tree);
    });

    // Subscribe to selection changes
    state.subscribe('selectedFile', (path) => {
        updateSelection(container, path);
    });

    return container;
}

/**
 * Render the file tree
 * @param {HTMLElement} container 
 * @param {object} tree - Tree structure
 * @param {number} [depth=0] - Current depth
 */
function renderTree(container, tree, depth = 0) {
    container.innerHTML = '';

    if (!tree || Object.keys(tree).length === 0) {
        container.appendChild(
            h('div', { className: 'file-tree__empty', style: { padding: '16px', color: 'var(--text-muted)' } },
                'No files to display'
            )
        );
        return;
    }

    renderTreeItems(container, tree, depth);
}

/**
 * Render tree items recursively
 * @param {HTMLElement} parent 
 * @param {object} items 
 * @param {number} depth 
 */
function renderTreeItems(parent, items, depth) {
    const expandedFolders = state.get('expandedFolders') || new Set();

    // Sort: folders first, then files, alphabetically
    const sorted = Object.entries(items).sort(([aName, aData], [bName, bData]) => {
        const aIsFolder = aData.children !== undefined;
        const bIsFolder = bData.children !== undefined;
        if (aIsFolder !== bIsFolder) return bIsFolder - aIsFolder;
        return aName.localeCompare(bName);
    });

    for (const [name, data] of sorted) {
        const isFolder = data.children !== undefined;
        const path = data.path || name;
        const isExpanded = expandedFolders.has(path);
        const childCount = isFolder ? countChildren(data.children) : 0;

        const item = h('div', {
            className: 'file-tree__item',
            dataset: { path, isFolder: isFolder.toString() },
            style: { paddingLeft: `${8 + depth * 16}px` },
            onClick: (e) => handleItemClick(e, path, isFolder),
            onContextMenu: (e) => handleContextMenu(e, path, isFolder)
        });

        // Expander for folders
        if (isFolder) {
            const expander = h('span', {
                className: `file-tree__expander ${isExpanded ? 'file-tree__expander--expanded' : ''}`
            }, '▶');
            item.appendChild(expander);
        } else {
            item.appendChild(h('span', { className: 'file-tree__expander' }));
        }

        // Icon (SVG)
        const icon = h('span', { className: 'file-tree__icon' });
        icon.innerHTML = getFileIcon(name, isFolder, isExpanded);
        item.appendChild(icon);

        // Name
        const nameEl = h('span', { className: 'file-tree__name' }, name);
        item.appendChild(nameEl);

        // Count badge for folders
        if (isFolder && childCount > 0) {
            const count = h('span', { className: 'file-tree__count' }, `(${childCount})`);
            item.appendChild(count);
        }

        parent.appendChild(item);

        // Render children if expanded
        if (isFolder && isExpanded && data.children) {
            const childContainer = h('div', { className: 'file-tree__children' });
            renderTreeItems(childContainer, data.children, depth + 1);
            parent.appendChild(childContainer);
        }
    }
}

/**
 * Count total children in a folder
 * @param {object} children 
 * @returns {number}
 */
function countChildren(children) {
    if (!children) return 0;
    let count = 0;
    for (const data of Object.values(children)) {
        count++;
        if (data.children) {
            count += countChildren(data.children);
        }
    }
    return count;
}

/**
 * Handle item click
 * @param {MouseEvent} e 
 * @param {string} path 
 * @param {boolean} isFolder 
 */
function handleItemClick(e, path, isFolder) {
    e.stopPropagation();

    if (isFolder) {
        // Toggle folder expansion
        const expandedFolders = new Set(state.get('expandedFolders') || []);
        if (expandedFolders.has(path)) {
            expandedFolders.delete(path);
        } else {
            expandedFolders.add(path);
        }
        state.set('expandedFolders', expandedFolders);

        // Re-render tree
        const container = document.getElementById('file-tree');
        if (container) {
            renderTree(container, state.get('fileTree'));
        }
    } else {
        // Select file and switch to appropriate view
        const isBinFile = path.toLowerCase().endsWith('.bin');
        state.set({
            selectedFile: path,
            currentView: isBinFile ? 'editor' : 'preview'
        });
    }
}

/**
 * Update selection in the tree
 * @param {HTMLElement} container 
 * @param {string} selectedPath 
 */
function updateSelection(container, selectedPath) {
    // Remove existing selection
    container.querySelectorAll('.file-tree__item--selected').forEach(el => {
        el.classList.remove('file-tree__item--selected');
    });

    // Add selection to new item
    if (selectedPath) {
        const item = container.querySelector(`[data-path="${CSS.escape(selectedPath)}"]`);
        if (item) {
            item.classList.add('file-tree__item--selected');
        }
    }
}

/**
 * Handle context menu
 * @param {MouseEvent} e 
 * @param {string} path 
 * @param {boolean} isFolder 
 */
function handleContextMenu(e, path, isFolder) {
    e.preventDefault();
    e.stopPropagation();

    // Remove any existing context menu
    const existing = document.querySelector('.context-menu');
    if (existing) existing.remove();

    // Create context menu
    const menu = h('div', {
        className: 'context-menu',
        style: { left: `${e.clientX}px`, top: `${e.clientY}px` }
    });

    if (!isFolder) {
        menu.appendChild(h('button', {
            className: 'context-menu__item',
            onClick: () => { previewFile(path); menu.remove(); }
        }, 'Preview'));
        menu.appendChild(h('button', {
            className: 'context-menu__item',
            onClick: () => { openInEditor(path); menu.remove(); }
        }, 'Open in BIN Editor'));
        menu.appendChild(h('div', { className: 'context-menu__divider' }));
    }

    menu.appendChild(h('button', {
        className: 'context-menu__item',
        onClick: () => { copyPath(path); menu.remove(); }
    }, 'Copy Path'));

    menu.appendChild(h('button', {
        className: 'context-menu__item',
        onClick: () => { showInExplorer(path); menu.remove(); }
    }, 'Show in Explorer'));

    document.body.appendChild(menu);

    // Close on click outside
    const closeMenu = () => {
        menu.remove();
        document.removeEventListener('click', closeMenu);
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

/**
 * Preview a file
 * @param {string} path 
 */
function previewFile(path) {
    state.set({
        selectedFile: path,
        currentView: 'preview'
    });
}

/**
 * Open file in BIN editor
 * @param {string} path 
 */
function openInEditor(path) {
    state.set({
        selectedFile: path,
        currentView: 'editor'
    });
}

/**
 * Copy path to clipboard
 * @param {string} path 
 */
async function copyPath(path) {
    try {
        await navigator.clipboard.writeText(path);
    } catch (error) {
        console.error('Failed to copy path:', error);
    }
}

/**
 * Show file in system explorer
 * @param {string} path 
 */
async function showInExplorer(path) {
    try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('show_in_explorer', { path });
    } catch (error) {
        console.error('Failed to show in explorer:', error);
    }
}

/**
 * Create the Left Panel that switches between Projects view and File Tree
 * @returns {HTMLElement}
 */
export function LeftPanel() {
    const container = h('aside', { className: 'left-panel', id: 'left-panel' });

    // Function to render the appropriate content
    const renderContent = () => {
        container.innerHTML = '';

        const projectPath = state.get('currentProjectPath');

        if (projectPath) {
            // Project is open - show file tree with search
            const searchBox = h('div', { className: 'search-box' },
                h('input', {
                    type: 'text',
                    className: 'search-box__input',
                    placeholder: 'Search files...',
                    onInput: debounce((e) => filterTree(e.target.value), 200)
                })
            );
            container.append(searchBox, FileTree());
        } else {
            // No project - show projects panel
            container.appendChild(ProjectsPanel());
        }
    };

    // Initial render
    renderContent();

    // Re-render when project changes
    state.subscribe('currentProjectPath', renderContent);

    return container;
}

/**
 * Create the Projects Panel showing recent projects
 * @returns {HTMLElement}
 */
function ProjectsPanel() {
    const panel = h('div', { className: 'projects-panel' });

    // Header
    panel.appendChild(
        h('div', { className: 'projects-panel__header' },
            h('h3', { className: 'projects-panel__title' }, 'Your Mods'),
            h('button', {
                className: 'btn btn--ghost btn--small',
                onClick: () => openModal('newProject'),
                title: 'Create new mod'
            }, '+')
        )
    );

    // Projects list
    const projectsList = h('div', { className: 'projects-panel__list' });

    const recentProjects = state.get('recentProjects') || [];

    if (recentProjects.length === 0) {
        projectsList.appendChild(
            h('div', { className: 'projects-panel__empty' },
                h('p', {}, 'No mods yet'),
                h('p', { style: { color: 'var(--text-muted)', fontSize: '12px' } },
                    'Create a new mod or open an existing project'
                )
            )
        );
    } else {
        for (const project of recentProjects) {
            const item = h('div', {
                className: 'projects-panel__item',
                onClick: () => openProject(project.path)
            });

            // Project icon
            item.appendChild(h('span', { className: 'projects-panel__icon' }, '📁'));

            // Project info
            const info = h('div', { className: 'projects-panel__info' });
            info.appendChild(h('div', { className: 'projects-panel__name' }, project.name || 'Unnamed Mod'));

            if (project.champion) {
                info.appendChild(
                    h('div', { className: 'projects-panel__meta' }, project.champion)
                );
            }

            item.appendChild(info);
            projectsList.appendChild(item);
        }
    }

    panel.appendChild(projectsList);

    return panel;
}

/**
 * Open a project from the projects panel
 * @param {string} projectPath 
 */
async function openProject(projectPath) {
    try {
        setWorking('Opening project...');
        const project = await api.openProject(projectPath);

        state.set({
            currentProjectPath: projectPath,
            projectName: project.name,
            currentView: 'project'
        });

        setReady(`Opened ${project.name}`);
    } catch (error) {
        console.error('Failed to open project:', error);
        setError('Failed to open project');
    }
}

/**
 * Filter tree by search query
 * @param {string} query 
 */
function filterTree(query) {
    // TODO: Implement tree filtering
    console.log('Filter tree:', query);
}

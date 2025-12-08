/**
 * Flint - BIN Editor Component
 * Displays BIN file contents in Python-like text format for viewing/editing
 * or as a hierarchical property tree (toggled by view mode)
 */

import { h } from '../../lib/utils.js';
import * as api from '../../lib/api.js';
import { BinPropertyTree } from './BinPropertyTree.js';

// View mode constants
const VIEW_MODE_TREE = 'tree';
const VIEW_MODE_TEXT = 'text';

/**
 * Create a BIN editor component
 * @param {string} filePath - Absolute path to the .bin file
 * @returns {HTMLElement}
 */
export function BinEditor(filePath) {
    const container = h('div', { className: 'bin-editor' });

    // Store the current file path on the container for comparison
    container.dataset.filePath = filePath;
    container.dataset.viewMode = VIEW_MODE_TREE; // Default to tree view

    // Create toolbar with view toggle
    const toolbar = createToolbar(filePath, container);
    container.appendChild(toolbar);

    // Create content area with loading state
    const contentArea = h('div', { className: 'bin-editor__content' });
    const loadingEl = h('div', { className: 'bin-editor__loading' },
        h('div', { className: 'spinner' }),
        h('span', {}, 'Loading BIN file...')
    );
    contentArea.appendChild(loadingEl);
    container.appendChild(contentArea);

    // Load based on current view mode
    loadContent(filePath, contentArea, container);

    return container;
}

/**
 * Create the toolbar with view mode toggle
 */
function createToolbar(filePath, container) {
    const fileName = filePath.split(/[/\\]/).pop();

    // View mode toggle buttons
    const treeBtn = h('button', {
        className: 'bin-editor__view-btn bin-editor__view-btn--active',
        id: 'view-tree-btn',
        onclick: () => switchViewMode(container, VIEW_MODE_TREE),
        title: 'Property Tree View'
    }, '🌳 Tree');

    const textBtn = h('button', {
        className: 'bin-editor__view-btn',
        id: 'view-text-btn',
        onclick: () => switchViewMode(container, VIEW_MODE_TEXT),
        title: 'Text Editor View'
    }, '📝 Text');

    const viewToggle = h('div', { className: 'bin-editor__view-toggle' },
        treeBtn,
        textBtn
    );

    const saveBtn = h('button', {
        className: 'btn btn--sm btn--primary',
        id: 'bin-save-btn',
        onclick: () => saveBinContent(container),
        disabled: true,
        style: 'display: none;' // Hidden in tree mode initially
    }, '💾 Save');

    const copyBtn = h('button', {
        className: 'btn btn--sm btn--secondary',
        id: 'bin-copy-btn',
        onclick: () => copyContent(container),
        style: 'display: none;' // Hidden in tree mode initially
    }, '📋 Copy');

    const wordWrapBtn = h('button', {
        className: 'btn btn--sm btn--secondary',
        id: 'btn-word-wrap',
        onclick: (e) => toggleWordWrap(container, e.target),
        style: 'display: none;' // Hidden in tree mode initially
    }, 'Wrap');

    // Tree mode buttons
    const expandAllBtn = h('button', {
        className: 'btn btn--sm btn--secondary',
        id: 'btn-expand-all',
        onclick: () => expandAllNodes(container),
        title: 'Expand All'
    }, '⊞ Expand');

    const collapseAllBtn = h('button', {
        className: 'btn btn--sm btn--secondary',
        id: 'btn-collapse-all',
        onclick: () => collapseAllNodes(container),
        title: 'Collapse All'
    }, '⊟ Collapse');

    return h('div', { className: 'bin-editor__toolbar' },
        h('span', { className: 'bin-editor__filename' }, fileName),
        viewToggle,
        h('div', { className: 'bin-editor__toolbar-actions' },
            expandAllBtn,
            collapseAllBtn,
            saveBtn,
            wordWrapBtn,
            copyBtn
        )
    );
}

/**
 * Switch between tree and text view modes
 */
function switchViewMode(container, mode) {
    if (container.dataset.viewMode === mode) return;

    container.dataset.viewMode = mode;

    // Update toggle button states
    const treeBtn = container.querySelector('#view-tree-btn');
    const textBtn = container.querySelector('#view-text-btn');

    if (mode === VIEW_MODE_TREE) {
        treeBtn.classList.add('bin-editor__view-btn--active');
        textBtn.classList.remove('bin-editor__view-btn--active');
    } else {
        textBtn.classList.add('bin-editor__view-btn--active');
        treeBtn.classList.remove('bin-editor__view-btn--active');
    }

    // Show/hide appropriate toolbar buttons
    const saveBtn = container.querySelector('#bin-save-btn');
    const copyBtn = container.querySelector('#bin-copy-btn');
    const wordWrapBtn = container.querySelector('#btn-word-wrap');
    const expandAllBtn = container.querySelector('#btn-expand-all');
    const collapseAllBtn = container.querySelector('#btn-collapse-all');

    if (mode === VIEW_MODE_TREE) {
        saveBtn.style.display = 'none';
        copyBtn.style.display = 'none';
        wordWrapBtn.style.display = 'none';
        expandAllBtn.style.display = '';
        collapseAllBtn.style.display = '';
    } else {
        saveBtn.style.display = '';
        copyBtn.style.display = '';
        wordWrapBtn.style.display = '';
        expandAllBtn.style.display = 'none';
        collapseAllBtn.style.display = 'none';
    }

    // Reload content
    const contentArea = container.querySelector('.bin-editor__content');
    loadContent(container.dataset.filePath, contentArea, container);
}

/**
 * Load content based on current view mode
 */
function loadContent(filePath, contentArea, container) {
    const mode = container.dataset.viewMode;

    if (mode === VIEW_MODE_TREE) {
        loadTreeView(filePath, contentArea, container);
    } else {
        loadTextView(filePath, contentArea, container);
    }
}

/**
 * Load tree view
 */
function loadTreeView(filePath, contentArea, container) {
    contentArea.innerHTML = '';

    // Create the property tree
    const tree = BinPropertyTree(filePath, {
        onSelect: (node) => {
            console.log('[BinEditor] Selected node:', node);
            // Future: show details panel
        },
        searchEnabled: true
    });

    // Store reference for expand/collapse
    container._propertyTree = tree;

    contentArea.appendChild(tree);
}

/**
 * Load text view (original behavior)
 */
async function loadTextView(filePath, contentArea, container) {
    contentArea.innerHTML = '';
    contentArea.appendChild(h('div', { className: 'bin-editor__loading' },
        h('div', { className: 'spinner' }),
        h('span', {}, 'Loading BIN file...')
    ));

    try {
        // Use the caching API
        const textContent = await api.readOrConvertBin(filePath);

        contentArea.innerHTML = '';

        // Create text editor area
        const editorWrapper = h('div', { className: 'bin-editor__wrapper' });

        // Line numbers
        const lines = textContent.split('\n');
        const lineNumbers = h('div', { className: 'bin-editor__line-numbers' });
        for (let i = 1; i <= lines.length; i++) {
            lineNumbers.appendChild(h('div', { className: 'bin-editor__line-num' }, String(i)));
        }
        editorWrapper.appendChild(lineNumbers);

        // Code content - editable textarea
        const codeArea = h('textarea', {
            className: 'bin-editor__code',
            spellcheck: false,
            id: 'bin-code-area'
        });
        // Set value as property (not attribute) for textarea
        codeArea.value = textContent;

        // Store original content for dirty checking
        container.dataset.originalContent = textContent;

        // Track changes to enable save button
        codeArea.addEventListener('input', () => {
            const saveBtn = container.querySelector('#bin-save-btn');
            const isDirty = codeArea.value !== container.dataset.originalContent;
            if (saveBtn) {
                saveBtn.disabled = !isDirty;
                saveBtn.classList.toggle('btn--warning', isDirty);
            }
        });

        // Sync scroll between line numbers and code
        codeArea.addEventListener('scroll', () => {
            lineNumbers.scrollTop = codeArea.scrollTop;
        });

        editorWrapper.appendChild(codeArea);
        contentArea.appendChild(editorWrapper);

        // Info bar
        const infoBar = h('div', { className: 'bin-editor__info' },
            h('span', {}, `${lines.length} lines`),
            h('span', {}, `${textContent.length.toLocaleString()} characters`)
        );
        contentArea.appendChild(infoBar);

    } catch (error) {
        console.error('[BinEditor] Load error:', error);
        contentArea.innerHTML = '';
        contentArea.appendChild(h('div', { className: 'bin-editor__error' },
            h('span', { className: 'error-icon' }, '⚠️'),
            h('span', {}, error.message || 'Failed to load BIN file')
        ));
    }
}

/**
 * Expand all tree nodes
 */
function expandAllNodes(container) {
    if (container._propertyTree && container._propertyTree.expandAll) {
        container._propertyTree.expandAll();
    }
}

/**
 * Collapse all tree nodes
 */
function collapseAllNodes(container) {
    if (container._propertyTree && container._propertyTree.collapseAll) {
        container._propertyTree.collapseAll();
    }
}

/**
 * Save BIN content (text mode only)
 */
async function saveBinContent(container) {
    const codeArea = container.querySelector('#bin-code-area');
    const saveBtn = container.querySelector('#bin-save-btn');
    const binPath = container.dataset.filePath;

    if (!codeArea || !binPath) return;

    const content = codeArea.value;

    // Update button to show saving state
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = '💾 Saving...';
    }

    try {
        await api.saveRitobinToBin(binPath, content);

        // Update original content to match saved content
        container.dataset.originalContent = content;

        // Update button state
        if (saveBtn) {
            saveBtn.textContent = '💾 Saved!';
            saveBtn.classList.remove('btn--warning');
            setTimeout(() => {
                saveBtn.textContent = '💾 Save';
            }, 2000);
        }

        console.log('[BinEditor] Saved successfully:', binPath);

    } catch (error) {
        console.error('[BinEditor] Save error:', error);
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 Save Failed';
            saveBtn.classList.add('btn--error');
            setTimeout(() => {
                saveBtn.textContent = '💾 Save';
                saveBtn.classList.remove('btn--error');
                saveBtn.disabled = false;
            }, 3000);
        }
        alert(`Failed to save: ${error.message || error}`);
    }
}

/**
 * Copy content to clipboard
 */
async function copyContent(container) {
    const codeArea = container.querySelector('#bin-code-area');
    if (codeArea) {
        try {
            await navigator.clipboard.writeText(codeArea.value);
            console.log('[BinEditor] Content copied to clipboard');
        } catch (err) {
            console.error('[BinEditor] Copy failed:', err);
        }
    }
}

/**
 * Toggle word wrap
 */
function toggleWordWrap(container, button) {
    const codeArea = container.querySelector('#bin-code-area');
    if (codeArea) {
        const isWrapped = codeArea.style.whiteSpace === 'pre-wrap';
        codeArea.style.whiteSpace = isWrapped ? 'pre' : 'pre-wrap';
        codeArea.style.wordBreak = isWrapped ? 'normal' : 'break-word';
        button.classList.toggle('btn--primary', !isWrapped);
        button.classList.toggle('btn--secondary', isWrapped);
    }
}

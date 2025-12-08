/**
 * Flint - Text Preview Component
 * Displays text files with optional syntax highlighting
 */

import { h } from '../../lib/utils.js';
import * as api from '../../lib/api.js';

/**
 * Create a text preview component
 * @param {string} filePath - Absolute path to the text file
 * @returns {HTMLElement}
 */
export function TextPreview(filePath) {
    const container = h('div', { className: 'text-preview' });

    // Loading state
    const loadingEl = h('div', { className: 'text-preview__loading' },
        h('div', { className: 'spinner' }),
        h('span', {}, 'Loading file...')
    );
    container.appendChild(loadingEl);

    // Load text content
    loadText(filePath, container, loadingEl);

    return container;
}

/**
 * Load and render text content
 */
async function loadText(filePath, container, loadingEl) {
    try {
        const content = await api.readTextFile(filePath);

        loadingEl.remove();

        // Determine language for syntax highlighting hints
        const extension = filePath.split('.').pop().toLowerCase();
        const language = getLanguage(extension);

        // Create toolbar
        const lines = content.split('\n');
        const toolbar = h('div', { className: 'text-preview__toolbar' },
            h('span', {}, `${lines.length} lines`),
            h('span', { className: 'text-preview__lang' }, language)
        );

        // Create line numbers and content
        const lineNumbers = h('div', { className: 'text-preview__line-numbers' });
        const codeContent = h('pre', { className: 'text-preview__code' });

        // Limit to first 2000 lines for performance
        const displayLines = lines.slice(0, 2000);

        displayLines.forEach((line, idx) => {
            lineNumbers.appendChild(h('div', { className: 'text-preview__line-num' }, String(idx + 1)));
        });

        // Create code element with syntax class
        const code = h('code', { className: `language-${extension}` }, displayLines.join('\n'));
        codeContent.appendChild(code);

        // Scrollable content wrapper
        const contentWrapper = h('div', { className: 'text-preview__content' },
            lineNumbers,
            codeContent
        );

        // Sync scroll between line numbers and content
        codeContent.addEventListener('scroll', () => {
            lineNumbers.scrollTop = codeContent.scrollTop;
        });

        // Add truncation notice if needed
        if (lines.length > 2000) {
            const notice = h('div', { className: 'text-preview__truncated' },
                `... ${lines.length - 2000} more lines (showing first 2000)`
            );
            container.append(toolbar, contentWrapper, notice);
        } else {
            container.append(toolbar, contentWrapper);
        }

    } catch (error) {
        console.error('[TextPreview] Load error:', error);
        loadingEl.innerHTML = '';
        loadingEl.appendChild(h('span', { className: 'error' }, `⚠️ ${error.message || 'Failed to load file'}`));
    }
}

/**
 * Get display language name from extension
 */
function getLanguage(extension) {
    const languages = {
        'py': 'Python',
        'json': 'JSON',
        'txt': 'Plain Text',
        'xml': 'XML',
        'html': 'HTML',
        'css': 'CSS',
        'js': 'JavaScript',
        'lua': 'Lua',
        'cfg': 'Config',
        'ini': 'INI',
        'md': 'Markdown'
    };
    return languages[extension] || extension.toUpperCase();
}

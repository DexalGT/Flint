/**
 * Flint - Hex Viewer Component
 * Displays binary files in hex + ASCII format
 */

import { h } from '../../lib/utils.js';
import * as api from '../../lib/api.js';

// Constants
const BYTES_PER_ROW = 16;
const CHUNK_SIZE = 1024; // Load 1KB chunks for virtual scrolling

/**
 * Create a hex viewer component
 * @param {string} filePath - Absolute path to the file
 * @returns {HTMLElement}
 */
export function HexViewer(filePath) {
    const container = h('div', { className: 'hex-viewer' });

    // State
    let fileData = null;
    let scrollTop = 0;

    // Loading state
    const loadingEl = h('div', { className: 'hex-viewer__loading' },
        h('div', { className: 'spinner' }),
        h('span', {}, 'Loading file...')
    );
    container.appendChild(loadingEl);

    // Load file data
    loadFile(filePath, container, loadingEl);

    return container;
}

/**
 * Load file and render hex view
 */
async function loadFile(filePath, container, loadingEl) {
    try {
        const bytes = await api.readFileBytes(filePath);

        loadingEl.remove();

        // Create header
        const header = h('div', { className: 'hex-viewer__header' },
            h('span', { className: 'hex-viewer__offset-col' }, 'Offset'),
            h('span', { className: 'hex-viewer__hex-col' }, 'Hex'),
            h('span', { className: 'hex-viewer__ascii-col' }, 'ASCII')
        );

        // Create copy button
        const copyBtn = h('button', {
            className: 'btn btn--secondary hex-viewer__copy',
            onclick: () => copyHexToClipboard(bytes)
        }, '📋 Copy');

        // Create toolbar
        const toolbar = h('div', { className: 'hex-viewer__toolbar' },
            h('span', {}, `${bytes.length.toLocaleString()} bytes`),
            copyBtn
        );

        // Create scrollable content area
        const content = h('div', { className: 'hex-viewer__content' });

        // Render hex rows (limit to first 4KB for performance)
        const displayBytes = bytes.slice(0, 4096);
        const rows = Math.ceil(displayBytes.length / BYTES_PER_ROW);

        for (let i = 0; i < rows; i++) {
            const offset = i * BYTES_PER_ROW;
            const rowBytes = displayBytes.slice(offset, offset + BYTES_PER_ROW);
            content.appendChild(createHexRow(offset, rowBytes));
        }

        // Add truncation notice if needed
        if (bytes.length > 4096) {
            content.appendChild(h('div', { className: 'hex-viewer__truncated' },
                `... ${(bytes.length - 4096).toLocaleString()} more bytes (showing first 4KB)`
            ));
        }

        container.append(toolbar, header, content);

        // Store data on container for potential copy
        container.fileData = bytes;

    } catch (error) {
        console.error('[HexViewer] Load error:', error);
        loadingEl.innerHTML = '';
        loadingEl.appendChild(h('span', { className: 'error' }, `⚠️ ${error.message || 'Failed to load file'}`));
    }
}

/**
 * Create a single hex row
 */
function createHexRow(offset, bytes) {
    // Offset column (8 hex chars)
    const offsetStr = offset.toString(16).toUpperCase().padStart(8, '0');

    // Hex column (16 bytes x 2 chars + spaces)
    let hexStr = '';
    let asciiStr = '';

    for (let i = 0; i < BYTES_PER_ROW; i++) {
        if (i < bytes.length) {
            const byte = bytes[i];
            hexStr += byte.toString(16).toUpperCase().padStart(2, '0') + ' ';
            // ASCII: printable chars or dot
            asciiStr += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
        } else {
            hexStr += '   ';
            asciiStr += ' ';
        }

        // Add extra space after 8 bytes for readability
        if (i === 7) {
            hexStr += ' ';
        }
    }

    return h('div', { className: 'hex-viewer__row' },
        h('span', { className: 'hex-viewer__offset' }, offsetStr),
        h('span', { className: 'hex-viewer__hex' }, hexStr),
        h('span', { className: 'hex-viewer__ascii' }, asciiStr)
    );
}

/**
 * Copy hex dump to clipboard
 */
async function copyHexToClipboard(bytes) {
    const lines = [];
    const rows = Math.ceil(bytes.length / BYTES_PER_ROW);

    for (let i = 0; i < rows; i++) {
        const offset = i * BYTES_PER_ROW;
        const rowBytes = bytes.slice(offset, offset + BYTES_PER_ROW);

        const offsetStr = offset.toString(16).toUpperCase().padStart(8, '0');
        let hexStr = '';
        let asciiStr = '';

        for (let j = 0; j < BYTES_PER_ROW; j++) {
            if (j < rowBytes.length) {
                const byte = rowBytes[j];
                hexStr += byte.toString(16).toUpperCase().padStart(2, '0') + ' ';
                asciiStr += (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.';
            } else {
                hexStr += '   ';
                asciiStr += ' ';
            }
            if (j === 7) hexStr += ' ';
        }

        lines.push(`${offsetStr}  ${hexStr} |${asciiStr}|`);
    }

    try {
        await navigator.clipboard.writeText(lines.join('\n'));
        console.log('[HexViewer] Copied to clipboard');
    } catch (err) {
        console.error('[HexViewer] Copy failed:', err);
    }
}

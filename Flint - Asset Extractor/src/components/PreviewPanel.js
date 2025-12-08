/**
 * Flint - Preview Panel Component
 * Main preview container with toolbar and content routing
 */

import { h } from '../lib/utils.js';
import { state } from '../lib/state.js';
import * as api from '../lib/api.js';
import { ImagePreview } from './preview/ImagePreview.js';
import { HexViewer } from './preview/HexViewer.js';
import { TextPreview } from './preview/TextPreview.js';
import { BinEditor } from './preview/BinEditor.js';

/**
 * Create the preview panel component
 * @returns {HTMLElement}
 */
export function PreviewPanel() {
    const container = h('div', { className: 'preview-panel' });

    // Get the selected file
    const selectedFile = state.get('selectedFile');
    const projectPath = state.get('currentProjectPath');

    if (!selectedFile || !projectPath) {
        container.appendChild(createEmptyState());
        return container;
    }

    // Build full file path
    const filePath = `${projectPath}/${selectedFile}`;

    // Create toolbar
    const toolbar = createToolbar(filePath);
    container.appendChild(toolbar);

    // Create content area
    const contentArea = h('div', { className: 'preview-panel__content' });
    container.appendChild(contentArea);

    // Create info bar
    const infoBar = h('div', { className: 'preview-panel__info-bar' },
        h('span', { className: 'preview-panel__info-loading' }, 'Loading file info...')
    );
    container.appendChild(infoBar);

    // Load file info and render preview
    loadAndRender(filePath, contentArea, infoBar, toolbar);

    return container;
}

/**
 * Create empty state when no file selected
 */
function createEmptyState() {
    return h('div', { className: 'preview-panel__empty' },
        h('div', { className: 'preview-panel__empty-icon' }, '📄'),
        h('div', { className: 'preview-panel__empty-text' }, 'Select a file to preview')
    );
}

/**
 * Create toolbar with zoom controls
 */
function createToolbar(filePath) {
    const fileName = filePath.split('\\').pop();

    const toolbar = h('div', { className: 'preview-panel__toolbar' },
        // Zoom controls (will be enabled for images)
        h('div', { className: 'preview-panel__zoom-controls', id: 'zoom-controls', style: { visibility: 'hidden' } },
            h('button', { className: 'btn btn--sm', id: 'zoom-fit', onclick: () => emitZoom('fit') }, 'Fit'),
            h('button', { className: 'btn btn--sm', id: 'zoom-100', onclick: () => emitZoom('100') }, '100%'),
            h('button', { className: 'btn btn--sm', id: 'zoom-200', onclick: () => emitZoom('200') }, '200%')
        ),
        // File name
        h('span', { className: 'preview-panel__filename' }, fileName)
    );

    return toolbar;
}

/**
 * Emit zoom command to the image preview
 */
function emitZoom(level) {
    const imagePreview = document.querySelector('.image-preview');
    if (imagePreview) {
        if (level === 'fit' && imagePreview.zoomFit) imagePreview.zoomFit();
        if (level === '100' && imagePreview.zoom100) imagePreview.zoom100();
        if (level === '200' && imagePreview.zoom200) imagePreview.zoom200();
    }
}

/**
 * Load file info and render appropriate preview
 */
async function loadAndRender(filePath, contentArea, infoBar, toolbar) {
    try {
        // Get file info
        const fileInfo = await api.readFileInfo(filePath);

        // Update info bar
        updateInfoBar(infoBar, fileInfo);

        // Render based on file type
        const preview = createPreviewForType(filePath, fileInfo);
        contentArea.innerHTML = '';
        contentArea.appendChild(preview);

        // Show zoom controls for images
        if (fileInfo.file_type.startsWith('image/')) {
            const zoomControls = toolbar.querySelector('#zoom-controls');
            if (zoomControls) {
                zoomControls.style.visibility = 'visible';
            }
        }

    } catch (error) {
        console.error('[PreviewPanel] Error:', error);
        contentArea.innerHTML = '';
        contentArea.appendChild(h('div', { className: 'preview-panel__error' },
            h('span', { className: 'error-icon' }, '⚠️'),
            h('span', {}, error.message || 'Failed to load file')
        ));
        infoBar.innerHTML = '';
    }
}

/**
 * Update info bar with file metadata
 */
function updateInfoBar(infoBar, fileInfo) {
    infoBar.innerHTML = '';

    // File type
    const typeLabel = getTypeLabel(fileInfo.file_type);
    infoBar.appendChild(h('span', { className: 'preview-panel__info-item' },
        h('span', { className: 'preview-panel__info-label' }, 'Type: '),
        typeLabel
    ));

    // Dimensions (for images)
    if (fileInfo.dimensions) {
        infoBar.appendChild(h('span', { className: 'preview-panel__info-item' },
            h('span', { className: 'preview-panel__info-label' }, 'Size: '),
            `${fileInfo.dimensions[0]}×${fileInfo.dimensions[1]}`
        ));
    }

    // File size
    const sizeStr = formatFileSize(fileInfo.size);
    infoBar.appendChild(h('span', { className: 'preview-panel__info-item' },
        h('span', { className: 'preview-panel__info-label' }, 'Size: '),
        sizeStr
    ));
}

/**
 * Get human-readable type label
 */
function getTypeLabel(fileType) {
    const labels = {
        'image/dds': 'DDS Texture',
        'image/tex': 'TEX Texture',
        'image/png': 'PNG Image',
        'image/jpeg': 'JPEG Image',
        'application/x-bin': 'BIN Property File',
        'text/x-python': 'Python Script',
        'application/json': 'JSON',
        'text/plain': 'Plain Text',
        'audio': 'Audio',
        'model': '3D Model',
        'application/octet-stream': 'Binary File'
    };
    return labels[fileType] || fileType;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Create the appropriate preview component for the file type
 */
function createPreviewForType(filePath, fileInfo) {
    const { file_type, extension } = fileInfo;

    // Images
    if (file_type.startsWith('image/')) {
        return ImagePreview(filePath);
    }

    // BIN files - use the BIN editor
    if (extension === 'bin' || file_type === 'application/x-bin') {
        return BinEditor(filePath);
    }

    // Text files
    if (file_type.startsWith('text/') || extension === 'json' || extension === 'py') {
        return TextPreview(filePath);
    }

    // Everything else gets hex viewer
    return HexViewer(filePath);
}

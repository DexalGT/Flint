/**
 * Flint - Image Preview Component
 * Displays DDS and other image files with pan/zoom controls
 */

import { h } from '../../lib/utils.js';
import * as api from '../../lib/api.js';
import { getCachedImage, cacheImage } from '../../lib/state.js';

/**
 * Create an image preview component
 * @param {string} filePath - Absolute path to the image file
 * @returns {HTMLElement}
 */
export function ImagePreview(filePath) {
    const container = h('div', { className: 'image-preview' });

    // State
    let scale = 1;
    let translateX = 0;
    let translateY = 0;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;

    // Loading state
    const loadingEl = h('div', { className: 'image-preview__loading' },
        h('div', { className: 'spinner' }),
        h('span', {}, 'Loading image...')
    );
    container.appendChild(loadingEl);

    // Load the image
    loadImage(filePath, container, loadingEl, (imgContainer, imageData) => {
        // Store reference to update transform
        const updateTransform = () => {
            imgContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        };

        // Mouse wheel zoom
        container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newScale = Math.min(10, Math.max(0.1, scale * delta));

            // Zoom towards cursor position
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            translateX = x - (x - translateX) * (newScale / scale);
            translateY = y - (y - translateY) * (newScale / scale);
            scale = newScale;

            updateTransform();
        });

        // Pan with mouse drag
        container.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                isDragging = true;
                dragStartX = e.clientX - translateX;
                dragStartY = e.clientY - translateY;
                container.style.cursor = 'grabbing';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                translateX = e.clientX - dragStartX;
                translateY = e.clientY - dragStartY;
                updateTransform();
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                container.style.cursor = 'grab';
            }
        });

        // Expose control methods
        container.zoomFit = () => {
            const containerRect = container.getBoundingClientRect();
            const scaleX = containerRect.width / imageData.width;
            const scaleY = containerRect.height / imageData.height;
            scale = Math.min(scaleX, scaleY, 1) * 0.9;
            translateX = (containerRect.width - imageData.width * scale) / 2;
            translateY = (containerRect.height - imageData.height * scale) / 2;
            updateTransform();
        };

        container.zoom100 = () => {
            scale = 1;
            const containerRect = container.getBoundingClientRect();
            translateX = (containerRect.width - imageData.width) / 2;
            translateY = (containerRect.height - imageData.height) / 2;
            updateTransform();
        };

        container.zoom200 = () => {
            scale = 2;
            const containerRect = container.getBoundingClientRect();
            translateX = (containerRect.width - imageData.width * 2) / 2;
            translateY = (containerRect.height - imageData.height * 2) / 2;
            updateTransform();
        };

        // Initial fit
        setTimeout(() => container.zoomFit(), 10);
    });

    return container;
}

/**
 * Load image from file path (with cache support)
 */
async function loadImage(filePath, container, loadingEl, onLoaded) {
    try {
        const extension = filePath.split('.').pop().toLowerCase();

        let imageData;

        // Check cache first for DDS and TEX files (require backend decoding)
        if (extension === 'dds' || extension === 'tex') {
            imageData = getCachedImage(filePath);
            if (!imageData) {
                // Decode through backend (handles both DDS and TEX) and cache result
                imageData = await api.decodeDdsToPng(filePath);
                cacheImage(filePath, imageData);
            }
        } else {
            // For PNG/JPG, read directly as base64
            const bytes = await api.readFileBytes(filePath);
            const base64 = btoa(String.fromCharCode(...bytes));
            imageData = {
                data: base64,
                width: 0,
                height: 0,
                format: extension.toUpperCase()
            };
        }

        // Create image element
        const img = document.createElement('img');
        img.src = `data:image/png;base64,${imageData.data}`;
        img.className = 'image-preview__image';
        img.draggable = false;

        img.onload = () => {
            // Update dimensions if not set
            if (!imageData.width) imageData.width = img.naturalWidth;
            if (!imageData.height) imageData.height = img.naturalHeight;

            // Remove loading state
            loadingEl.remove();

            // Create image container with checkerboard background
            const imgContainer = h('div', { className: 'image-preview__container' }, img);
            container.appendChild(imgContainer);
            container.style.cursor = 'grab';

            // Store image data on container
            container.imageData = imageData;

            onLoaded(imgContainer, imageData);
        };

        img.onerror = () => {
            loadingEl.innerHTML = '';
            loadingEl.appendChild(h('span', { className: 'error' }, '⚠️ Failed to load image'));
        };

    } catch (error) {
        console.error('[ImagePreview] Load error:', error);
        loadingEl.innerHTML = '';
        loadingEl.appendChild(h('span', { className: 'error' }, `⚠️ ${error.message || 'Failed to load image'}`));
    }
}

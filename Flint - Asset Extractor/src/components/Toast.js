/**
 * Flint - Toast Notification Component
 * Non-blocking notifications for errors, warnings, and info messages
 */

import { h } from '../lib/utils.js';
import { state, dismissToast } from '../lib/state.js';

/**
 * Create the toast container that holds all active toasts
 * @returns {HTMLElement}
 */
export function ToastContainer() {
    const container = h('div', { className: 'toast-container', id: 'toast-container' });

    // Subscribe to toast changes
    state.subscribe('toasts', (toasts) => {
        renderToasts(container, toasts);
    });

    // Initial render
    renderToasts(container, state.get('toasts'));

    return container;
}

/**
 * Render toasts into container
 * @param {HTMLElement} container 
 * @param {Array} toasts 
 */
function renderToasts(container, toasts) {
    container.innerHTML = '';

    for (const toast of toasts) {
        container.appendChild(createToastElement(toast));
    }
}

/**
 * Create a single toast element
 * @param {object} toast 
 * @returns {HTMLElement}
 */
function createToastElement(toast) {
    const icons = {
        info: '💡',
        success: '✓',
        warning: '⚠',
        error: '✕',
    };

    const toastEl = h('div', {
        className: `toast toast-${toast.type}`,
        'data-toast-id': toast.id,
    });

    // Icon
    const icon = h('span', { className: 'toast-icon' }, icons[toast.type] || '•');

    // Content
    const content = h('div', { className: 'toast-content' });
    const message = h('div', { className: 'toast-message' }, toast.message);
    content.appendChild(message);

    // Suggestion if available
    if (toast.suggestion) {
        const suggestion = h('div', { className: 'toast-suggestion' }, toast.suggestion);
        content.appendChild(suggestion);
    }

    // Dismiss button
    const dismiss = h('button', {
        className: 'toast-dismiss',
        onclick: () => dismissToast(toast.id),
        'aria-label': 'Dismiss',
    }, '×');

    toastEl.append(icon, content, dismiss);

    // Animate in
    requestAnimationFrame(() => {
        toastEl.classList.add('toast-visible');
    });

    return toastEl;
}

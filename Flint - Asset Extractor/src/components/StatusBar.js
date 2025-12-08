/**
 * Flint - Status Bar Component
 */

import { h, formatNumber } from '../lib/utils.js';
import { state } from '../lib/state.js';

/**
 * Create the StatusBar component
 * @returns {HTMLElement}
 */
export function StatusBar() {
    const container = h('footer', { className: 'statusbar' });

    // Left section - status
    const left = h('div', { className: 'statusbar__left' },
        h('span', { className: 'statusbar__indicator statusbar__indicator--ready', id: 'status-indicator' }),
        h('span', { id: 'status-message' }, 'Ready')
    );

    // Right section - hash count
    const right = h('div', { className: 'statusbar__right' },
        h('span', { id: 'hash-count' }, 'Hashes: Loading...')
    );

    container.append(left, right);

    // Subscribe to state changes
    state.subscribe('status', (status) => {
        updateStatusIndicator(container, status);
    });

    state.subscribe('statusMessage', (message) => {
        const el = container.querySelector('#status-message');
        if (el) el.textContent = message;
    });

    state.subscribe('hashCount', (count) => {
        updateHashCount(container, count);
    });

    state.subscribe('hashesLoaded', (loaded) => {
        if (!loaded) {
            const el = container.querySelector('#hash-count');
            if (el) el.textContent = 'Hashes: Not Loaded';
        }
    });

    return container;
}

/**
 * Update the status indicator
 * @param {HTMLElement} container 
 * @param {'ready'|'working'|'error'} status 
 */
function updateStatusIndicator(container, status) {
    const indicator = container.querySelector('#status-indicator');
    if (!indicator) return;

    indicator.classList.remove(
        'statusbar__indicator--ready',
        'statusbar__indicator--working',
        'statusbar__indicator--error'
    );
    indicator.classList.add(`statusbar__indicator--${status}`);
}

/**
 * Update the hash count display
 * @param {HTMLElement} container 
 * @param {number} count 
 */
function updateHashCount(container, count) {
    const el = container.querySelector('#hash-count');
    if (!el) return;

    if (count >= 1000000) {
        el.textContent = `Hashes: ${(count / 1000000).toFixed(1)}M entries`;
    } else if (count >= 1000) {
        el.textContent = `Hashes: ${(count / 1000).toFixed(1)}K entries`;
    } else {
        el.textContent = `Hashes: ${formatNumber(count)} entries`;
    }
}

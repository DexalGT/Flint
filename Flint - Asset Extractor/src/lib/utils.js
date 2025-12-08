/**
 * Flint - Utility Functions
 */

// =============================================================================
// DOM Utilities
// =============================================================================

/**
 * Create an element with attributes and children
 * @param {string} tag - Tag name
 * @param {object} [attrs] - Attributes and properties
 * @param {...(Node|string)} children - Child nodes or text
 * @returns {HTMLElement}
 */
export function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);

    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'className') {
            el.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(el.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            el.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key === 'dataset') {
            Object.assign(el.dataset, value);
        } else {
            el.setAttribute(key, value);
        }
    }

    for (const child of children) {
        if (child == null) continue;
        if (typeof child === 'string' || typeof child === 'number') {
            el.appendChild(document.createTextNode(String(child)));
        } else if (child instanceof Node) {
            el.appendChild(child);
        } else if (Array.isArray(child)) {
            child.forEach(c => c && el.appendChild(c instanceof Node ? c : document.createTextNode(String(c))));
        }
    }

    return el;
}

/**
 * Query selector shorthand
 * @param {string} selector 
 * @param {Element} [parent=document]
 * @returns {Element|null}
 */
export function $(selector, parent = document) {
    return parent.querySelector(selector);
}

/**
 * Query selector all shorthand
 * @param {string} selector 
 * @param {Element} [parent=document]
 * @returns {Element[]}
 */
export function $$(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
}

/**
 * Clear all children from an element
 * @param {Element} el 
 */
export function clearChildren(el) {
    while (el.firstChild) {
        el.removeChild(el.firstChild);
    }
}

// =============================================================================
// File Type Icons
// =============================================================================

/**
 * Get file icon based on extension
 * @param {string} name - File or folder name
 * @param {boolean} isFolder - Whether it's a folder
 * @param {boolean} isExpanded - Whether folder is expanded
 * @returns {string} Icon character
 */
export function getFileIcon(name, isFolder, isExpanded = false) {
    if (isFolder) {
        // Use different icons for expanded/collapsed folders
        return isExpanded ? '📂' : '📁';
    }

    // Get file extension
    const ext = name.split('.').pop()?.toLowerCase();

    // Icon mapping by extension
    const iconMap = {
        // Documents
        'md': '📄',
        'txt': '📄',
        'pdf': '📕',

        // Code files
        'js': '📜',
        'jsx': '⚛',
        'ts': '📘',
        'tsx': '⚛',
        'json': '{}',
        'html': '🌐',
        'css': '🎨',
        'scss': '🎨',

        // Images
        'png': '🖼',
        'jpg': '🖼',
        'jpeg': '🖼',
        'gif': '🖼',
        'svg': '🎨',
        'dds': '🖼',
        'tga': '🖼',

        // League of Legends specific
        'bin': '⚙',
        'skn': '👤',
        'skl': '🦴',
        'anm': '🎬',
        'scb': '🎮',
        'sco': '🎮',
        'wad': '📦',

        // Config
        'ini': '⚙',
        'cfg': '⚙',
        'config': '⚙',
        'gitignore': '🚫',

        // Other
        'zip': '📦',
        'rar': '📦',
        '7z': '📦',
    };

    return iconMap[ext] || '📄';
}

// =============================================================================
// Formatting Utilities
// =============================================================================

/**
 * Format bytes to human readable size
 * @param {number} bytes 
 * @returns {string}
 */
export function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format a number with locale separators
 * @param {number} num 
 * @returns {string}
 */
export function formatNumber(num) {
    if (num == null || isNaN(num)) return '0';
    return num.toLocaleString();
}

/**
 * Format relative time (e.g., "2 days ago")
 * @param {string|Date} date 
 * @returns {string}
 */
export function formatRelativeTime(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);

    if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
}

/**
 * Truncate path for display, keeping filename visible
 * @param {string} path 
 * @param {number} [maxLength=40]
 * @returns {string}
 */
export function truncatePath(path, maxLength = 40) {
    if (path.length <= maxLength) return path;

    const parts = path.split(/[/\\]/);
    const filename = parts.pop() || '';

    if (filename.length >= maxLength - 3) {
        return '...' + filename.slice(-(maxLength - 3));
    }

    const remaining = maxLength - filename.length - 4; // 4 for "/..."
    const prefix = parts.slice(0, 2).join('/');

    if (prefix.length <= remaining) {
        return prefix + '/.../' + filename;
    }

    return '.../' + filename;
}

// =============================================================================
// Async Utilities
// =============================================================================

/**
 * Debounce a function
 * @param {function} fn 
 * @param {number} wait 
 * @returns {function}
 */
export function debounce(fn, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(this, args), wait);
    };
}

/**
 * Throttle a function
 * @param {function} fn 
 * @param {number} limit 
 * @returns {function}
 */
export function throttle(fn, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Sleep for a number of milliseconds
 * @param {number} ms 
 * @returns {Promise<void>}
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// Keyboard Shortcuts
// =============================================================================

const shortcuts = new Map();

/**
 * Register a keyboard shortcut
 * @param {string} key - Key combo (e.g., "Ctrl+S", "Escape")
 * @param {function} handler - Handler function
 * @returns {function} Unregister function
 */
export function registerShortcut(key, handler) {
    shortcuts.set(key.toLowerCase(), handler);
    return () => shortcuts.delete(key.toLowerCase());
}

/**
 * Initialize keyboard shortcut listener
 */
export function initShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Guard against undefined key (can happen with some input methods)
        if (!e.key) return;

        const parts = [];
        if (e.ctrlKey || e.metaKey) parts.push('ctrl');
        if (e.shiftKey) parts.push('shift');
        if (e.altKey) parts.push('alt');
        parts.push(e.key.toLowerCase());

        const combo = parts.join('+');
        const handler = shortcuts.get(combo);

        if (handler) {
            e.preventDefault();
            handler(e);
        }
    });
}

// =============================================================================
// Toast Notifications
// =============================================================================

let toastContainer = null;

/**
 * Show a toast notification
 * @param {string} message 
 * @param {'success'|'warning'|'error'} [type='success']
 * @param {number} [duration=5000]
 */
export function showToast(message, type = 'success', duration = 5000) {
    if (!toastContainer) {
        toastContainer = h('div', { className: 'toast-container' });
        document.body.appendChild(toastContainer);
    }

    const toast = h('div', { className: `toast toast--${type}` }, message);
    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

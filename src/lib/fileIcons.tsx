/**
 * Flint - File Icons (VS Code Seti-Style - Minimal & Clean)
 * Simplified, compact SVG icons matching VS Code's aesthetic
 */

// =============================================================================
// SVG Icon Definitions - Clean, minimal style
// =============================================================================

export const icons = {
    // -------------------------------------------------------------------------
    // Chevron/Expander Icons (Used instead of folder icons for cleaner look)
    // -------------------------------------------------------------------------
    chevronRight: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 4l4 4-4 4" stroke="#848484" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,

    chevronDown: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 6l4 4 4-4" stroke="#848484" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,

    // -------------------------------------------------------------------------
    // Folder Icons - Minimal style
    // -------------------------------------------------------------------------
    folder: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 4c0-.6.4-1 1-1h3.6l1.4 1H13c.6 0 1 .4 1 1v7c0 .6-.4 1-1 1H3c-.6 0-1-.4-1-1V4z" fill="#90a4ae"/>
    </svg>`,

    folderOpen: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 4c0-.6.4-1 1-1h3.6l1.4 1H13c.6 0 1 .4 1 1v1H4c-.8 0-1.5.5-1.8 1.2L1 12V4c0-.6.4-1 1-1z" fill="#90a4ae" opacity="0.7"/>
        <path d="M3 8c.3-.6.9-1 1.5-1H14l-2 6H3l-1-5z" fill="#90a4ae"/>
    </svg>`,

    // -------------------------------------------------------------------------
    // Default File Icon
    // -------------------------------------------------------------------------
    file: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 2h5l4 4v8c0 .6-.4 1-1 1H4c-.6 0-1-.4-1-1V3c0-.6.4-1 1-1z" fill="#6a737d"/>
        <path d="M9 2v4h4" fill="#4f565e"/>
    </svg>`,

    // -------------------------------------------------------------------------
    // JavaScript / TypeScript / React
    // -------------------------------------------------------------------------
    javascript: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="14" height="14" rx="2" fill="#f7df1e"/>
        <path d="M8.4 10.8c0 .8-.5 1.2-1.2 1.2-.6 0-1-.3-1.1-.8l.8-.5c.1.2.2.4.4.4s.3-.1.3-.4V7h.9v3.8zm2.1 1.2c-.8 0-1.3-.4-1.6-.9l.8-.4c.2.3.4.5.8.5s.4-.1.4-.3c0-.5-1.9-.3-1.9-1.6 0-.7.6-1.2 1.4-1.2.6 0 1.1.3 1.4.8l-.8.4c-.1-.2-.3-.4-.6-.4-.2 0-.4.1-.4.3 0 .5 1.9.2 1.9 1.6.1.7-.5 1.2-1.4 1.2z" fill="#000"/>
    </svg>`,

    typescript: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="1" width="14" height="14" rx="2" fill="#3178c6"/>
        <path d="M5 8h3v.7H6.5v3.3h-.9V8.7H5V8zm3.5.1c0-.1 0-.1 0 0l.9-.1c.1.2.2.4.4.5.2.1.4.2.7.2.3 0 .5-.1.6-.2.1-.1.2-.2.2-.3s0-.2-.1-.2c-.1-.1-.2-.2-.4-.2l-.6-.2c-.5-.1-.9-.3-1.1-.5-.2-.2-.4-.5-.4-.9 0-.4.2-.8.5-1 .3-.2.8-.4 1.3-.4.5 0 1 .1 1.2.4.3.2.5.5.5 1h-1c0-.2-.1-.3-.2-.4-.1-.1-.3-.2-.6-.2-.2 0-.4.1-.5.2-.1.1-.2.2-.2.3s0 .2.1.2c.1.1.2.1.4.2l.6.2c.5.1.9.3 1.1.5.2.2.4.5.4.9 0 .5-.2.8-.5 1.1-.3.2-.8.4-1.4.4-.6 0-1-.1-1.4-.4-.2-.3-.5-.6-.5-1z" fill="#fff"/>
    </svg>`,

    react: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="1.2" fill="#61dafb"/>
        <ellipse cx="8" cy="8" rx="4.5" ry="1.8" stroke="#61dafb" stroke-width="0.7" fill="none"/>
        <ellipse cx="8" cy="8" rx="4.5" ry="1.8" stroke="#61dafb" stroke-width="0.7" fill="none" transform="rotate(60 8 8)"/>
        <ellipse cx="8" cy="8" rx="4.5" ry="1.8" stroke="#61dafb" stroke-width="0.7" fill="none" transform="rotate(-60 8 8)"/>
    </svg>`,

    // -------------------------------------------------------------------------
    // Data & Config Files
    // -------------------------------------------------------------------------
    json: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 4c-.8 0-1.5.3-1.5 1.2V6c0 .6-.2.9-.5 1l.5.2c.3.1.5.4.5 1v.8c0 .9.7 1.2 1.5 1.2m6-6c.8 0 1.5.3 1.5 1.2V6c0 .6.2.9.5 1l-.5.2c-.3.1-.5.4-.5 1v.8c0 .9-.7 1.2-1.5 1.2" stroke="#cbcb41" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`,

    markdown: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="1" y="3" width="14" height="10" rx="1" stroke="#519aba" stroke-width="1" fill="none"/>
        <path d="M3 9V6l1.5 2L6 6v3m2-3h1.5L11 9l1.5-3H14" stroke="#519aba" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,

    config: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="2" stroke="#6d8086" stroke-width="1.2"/>
        <path d="M8 3v1.5m0 7V13m-5-5h1.5m7 0H13m-1.5-3.5l-1 1m-5 5l-1 1m7 0l-1-1m-5-5l-1-1" stroke="#6d8086" stroke-width="1" stroke-linecap="round"/>
    </svg>`,

    // -------------------------------------------------------------------------
    // Image Files
    // -------------------------------------------------------------------------
    image: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="12" height="12" rx="1" stroke="#a074c4" stroke-width="1"/>
        <circle cx="5.5" cy="5.5" r="1" fill="#a074c4"/>
        <path d="M2 11l3-3 2 2 3-4 4 5H2z" fill="#a074c4" opacity="0.7"/>
    </svg>`,

    texture: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="5" height="5" fill="#26a69a" opacity="0.4"/>
        <rect x="9" y="2" width="5" height="5" fill="#26a69a"/>
        <rect x="2" y="9" width="5" height="5" fill="#26a69a"/>
        <rect x="9" y="9" width="5" height="5" fill="#26a69a" opacity="0.4"/>
    </svg>`,

    // -------------------------------------------------------------------------
    // League of Legends Specific
    // -------------------------------------------------------------------------
    bin: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="5" stroke="#e67e22" stroke-width="1.2"/>
        <circle cx="8" cy="8" r="2" fill="#e67e22"/>
        <path d="M8 3v2m0 6v2m-5-5h2m6 0h2" stroke="#e67e22" stroke-width="1" stroke-linecap="round"/>
    </svg>`,

    model: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 2L2 5v6l6 3 6-3V5L8 2z" stroke="#ab47bc" stroke-width="1" fill="none"/>
        <path d="M2 5l6 3 6-3M8 8v6" stroke="#ab47bc" stroke-width="1"/>
    </svg>`,

    skeleton: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="3.5" r="1.5" fill="#78909c"/>
        <path d="M8 5v4m-3-2h6m-5 3l-1 3m5-3l1 3" stroke="#78909c" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`,

    animation: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="12" height="12" rx="1" stroke="#ef5350" stroke-width="1"/>
        <path d="M6 5v6l5-3-5-3z" fill="#ef5350"/>
    </svg>`,

    wad: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="3" width="12" height="10" rx="1" stroke="#8d6e63" stroke-width="1"/>
        <path d="M4 6h8m-8 2h8m-8 2h6" stroke="#8d6e63" stroke-width="0.8"/>
    </svg>`,

    // -------------------------------------------------------------------------
    // Web/Code Files
    // -------------------------------------------------------------------------
    html: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 2l1 11 4 2 4-2 1-11H3z" fill="#e44d26"/>
        <path d="M8 4v8l2.5-1 .5-6H5.5l.2 2h2.8l-.2 2.5L8 10" stroke="#fff" stroke-width="0.6"/>
    </svg>`,

    css: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 2l1 11 4 2 4-2 1-11H3z" fill="#42a5f5"/>
        <path d="M8 4v8l2.5-1 .5-6H5.5l.1 2h2.9l-.2 2.5L8 10" stroke="#fff" stroke-width="0.6"/>
    </svg>`,

    text: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 2h5l4 4v8c0 .6-.4 1-1 1H4c-.6 0-1-.4-1-1V3c0-.6.4-1 1-1z" stroke="#90a4ae" stroke-width="1" fill="none"/>
        <path d="M5 7h6m-6 2h6m-6 2h4" stroke="#90a4ae" stroke-width="0.8"/>
    </svg>`,

    rust: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="5" stroke="#dea584" stroke-width="1.2"/>
        <circle cx="8" cy="8" r="2" fill="#dea584"/>
        <path d="M8 2v1m0 10v1m-6-6h1m10 0h1m-2-4l-.7.7m-6.6 6.6l-.7.7m8 0l-.7-.7m-6.6-6.6l-.7-.7" stroke="#dea584" stroke-width="0.8" stroke-linecap="round"/>
    </svg>`,

    python: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M7.8 2c-2 0-1.8.9-1.8.9v1H8.3v.3H5s-1.6-.2-1.6 2.3S5 9 5 9h.8V7.8c0-1.4 1.3-1.4 1.3-1.4h2.3c1.3 0 1.3-1.3 1.3-1.3V3.4S10.8 2 7.8 2zm-1.2.8a.4.4 0 110 .8.4.4 0 010-.8z" fill="#3776ab"/>
        <path d="M8.2 14c2 0 1.8-.9 1.8-.9v-1H7.7v-.3H11s1.6.2 1.6-2.3S11 7 11 7h-.8v1.2c0 1.4-1.3 1.4-1.3 1.4H6.6c-1.3 0-1.3 1.3-1.3 1.3v1.7s-.1 1.4 2.9 1.4zm1.2-.8a.4.4 0 110-.8.4.4 0 010 .8z" fill="#ffd43b"/>
    </svg>`,

    // -------------------------------------------------------------------------
    // UI Icons (for buttons, actions)
    // -------------------------------------------------------------------------
    plus: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,

    info: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="5.5" stroke="#60a5fa" stroke-width="1"/>
        <path d="M8 7v4m0-6v.5" stroke="#60a5fa" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,

    success: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="5.5" stroke="#34d399" stroke-width="1"/>
        <path d="M5.5 8l2 2 3-3.5" stroke="#34d399" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,

    warning: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 2l6 10H2L8 2z" stroke="#fbbf24" stroke-width="1" fill="none"/>
        <path d="M8 6v3m0 2v.5" stroke="#fbbf24" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,

    error: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="5.5" stroke="#f87171" stroke-width="1"/>
        <path d="M5.5 5.5l5 5m0-5l-5 5" stroke="#f87171" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,

    document: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 2h5l4 4v8c0 .6-.4 1-1 1H4c-.6 0-1-.4-1-1V3c0-.6.4-1 1-1z" fill="#90a4ae"/>
        <path d="M9 2v4h4" fill="#6a737d"/>
        <path d="M5 8h6m-6 2h6m-6 2h4" stroke="#fff" stroke-width="0.8"/>
    </svg>`,

    settings: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="8" r="1.5" stroke="currentColor" stroke-width="1"/>
        <path d="M8 2v1.5m0 9V14m-6-6h1.5m9 0H14m-1.8-4.2l-1 1m-6.4 6.4l-1 1m8.4 0l-1-1m-6.4-6.4l-1-1" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
    </svg>`,

    search: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="7" cy="7" r="4" stroke="currentColor" stroke-width="1.2"/>
        <path d="M10 10l3.5 3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`,

    package: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" stroke="currentColor" stroke-width="1"/>
        <path d="M2 5l6 3 6-3M8 8v6" stroke="currentColor" stroke-width="1"/>
    </svg>`,

    folderOpen2: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 4c0-.6.4-1 1-1h3l1.5 1.5H13c.6 0 1 .4 1 1V6H4c-.8 0-1.5.5-1.8 1.2L1 11V4z" stroke="currentColor" stroke-width="1"/>
        <path d="M2 8c0-.6.4-1 1-1h10l-1.5 6H3.5L2 8z" stroke="currentColor" stroke-width="1"/>
    </svg>`,

    save: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 14H3c-.6 0-1-.4-1-1V3c0-.6.4-1 1-1h8l3 3v9c0 .6-.4 1-1 1z" stroke="currentColor" stroke-width="1"/>
        <path d="M5 2v3h5V2m-5 12v-4h6v4" stroke="currentColor" stroke-width="1"/>
    </svg>`,

    check: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,

    picture: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" stroke-width="1"/>
        <circle cx="5.5" cy="5.5" r="1" stroke="currentColor"/>
        <path d="M2 11l3-3 2 2 3-4 4 4" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,

    export: `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 2v7M5 6l3 3 3-3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M2 11v2h12v-2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`,
};

// =============================================================================
// Extension to Icon Type Mapping
// =============================================================================

const extensionMap: Record<string, keyof typeof icons> = {
    // JavaScript / TypeScript
    'js': 'javascript',
    'mjs': 'javascript',
    'cjs': 'javascript',
    'jsx': 'react',
    'ts': 'typescript',
    'tsx': 'react',

    // Data files
    'json': 'json',
    'md': 'markdown',
    'markdown': 'markdown',

    // Config files
    'ini': 'config',
    'cfg': 'config',
    'config': 'config',
    'toml': 'config',
    'yaml': 'config',
    'yml': 'config',
    'env': 'config',

    // Web files
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'css',
    'less': 'css',

    // Images
    'png': 'image',
    'jpg': 'image',
    'jpeg': 'image',
    'gif': 'image',
    'svg': 'image',
    'webp': 'image',
    'bmp': 'image',
    'ico': 'image',

    // Textures (League-specific)
    'dds': 'texture',
    'tex': 'texture',
    'tga': 'texture',

    // League of Legends specific
    'bin': 'bin',
    'skn': 'model',
    'skl': 'skeleton',
    'anm': 'animation',
    'scb': 'model',
    'sco': 'model',
    'wad': 'wad',

    // Text files
    'txt': 'text',
    'log': 'text',

    // Programming
    'py': 'python',
    'pyw': 'python',
    'rs': 'rust',

    // Archives
    'zip': 'wad',
    'rar': 'wad',
    '7z': 'wad',
};

// =============================================================================
// Exported Functions
// =============================================================================

/**
 * Get file icon SVG based on extension
 */
export function getFileIcon(name: string, isFolder: boolean, isExpanded = false): string {
    if (isFolder) {
        return isExpanded ? icons.folderOpen : icons.folder;
    }

    // Defensive check for undefined/null name
    if (!name) {
        return icons.file;
    }

    const ext = name.split('.').pop()?.toLowerCase() || '';
    const iconType = extensionMap[ext];
    return iconType ? icons[iconType] : icons.file;
}

/**
 * Get expander/chevron icon
 */
export function getExpanderIcon(isExpanded: boolean): string {
    return isExpanded ? icons.chevronDown : icons.chevronRight;
}

/**
 * Get specific icon by name
 */
export function getIcon(name: keyof typeof icons): string {
    return icons[name] || icons.file;
}

/**
 * Get toast notification icon
 */
export function getToastIcon(type: 'info' | 'success' | 'warning' | 'error'): string {
    return icons[type] || icons.info;
}

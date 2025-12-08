/**
 * File type icon mapping with VS Code-style SVG icons
 */

const icons = {
    // Folders
    folder: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M14.5 3H7.71l-.85-.85L6.51 2h-5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-10a.5.5 0 0 0-.5-.5Z" fill="#C09553"/>
    </svg>`,

    folderOpen: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1.5 14h13l.48-9H7.52L6.5 4h-5l-.08.61a1 1 0 0 0-.42.4L1.5 14Z" fill="#C09553"/>
        <path d="M14.5 3H7.71l-.86-.85L6.51 2h-5a.5.5 0 0 0-.5.5v1h14V3.5a.5.5 0 0 0-.51-.5Z" fill="#C09553" opacity="0.7"/>
    </svg>`,

    // Default file
    file: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 1.5A1.5 1.5 0 0 1 3.5 0h6.086a1.5 1.5 0 0 1 1.06.44l2.914 2.914a1.5 1.5 0 0 1 .44 1.06V14.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 14.5v-13Z" fill="#6E7681"/>
        <path d="M9.5 0v3.5a1 1 0 0 0 1 1H14" fill="#4C5159"/>
    </svg>`,

    // JavaScript
    javascript: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="16" height="16" rx="2" fill="#F0DB4F"/>
        <path d="M4.5 11.5c0 .8.6 1.3 1.4 1.3.7 0 1.1-.3 1.3-.9h.9c-.2.9-.9 1.5-2.2 1.5-1.4 0-2.3-.8-2.3-2.1V6.5h.9v4.8c0 .1 0 .2.1.2Zm4.8.1c0 1-.6 1.7-1.8 1.7s-1.8-.7-2-1.4l.8-.4c.1.4.5.8 1.2.8.6 0 1-.3 1-.9v-5h.8v5.2Z" fill="#323330"/>
    </svg>`,

    // JSON
    json: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="16" height="16" rx="2" fill="#F9C74F"/>
        <path d="M5 5h1v6H5V5Zm5 0h1v6h-1V5ZM7.5 7h1v2h-1V7Z" fill="#2B2B2B"/>
    </svg>`,

    // Markdown
    markdown: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="16" height="16" rx="2" fill="#4A4A4A"/>
        <path d="M3 5h1.5l1.2 1.8L7 5h1.5v6H7V7.5L5.7 9.5 4.5 7.5V11H3V5Zm7 6V9l1.5-1.5L13 9v2h-3Z" fill="#FFF"/>
    </svg>`,

    // Image files
    image: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="16" height="16" rx="2" fill="#5DADE2"/>
        <circle cx="5.5" cy="5.5" r="1.5" fill="#FFF" opacity="0.9"/>
        <path d="M2 11l3-3 2 2 3-3 3 3v2H2z" fill="#FFF" opacity="0.9"/>
    </svg>`,

    // Binary/Config
    binary: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="16" height="16" rx="2" fill="#E67E22"/>
        <path d="M4 5h1v6H4V5Zm3 0h2v1H7v1h1.5v1H7v2h2v1H7V5Zm4 0h1v6h-1V5Z" fill="#FFF"/>
    </svg>`,

    // Text
    text: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="16" height="16" rx="2" fill="#95A5A6"/>
        <path d="M4 5h8v1H8.5v5h-1V6H4V5Z" fill="#2C3E50"/>
    </svg>`,

    // Config
    config: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="16" height="16" rx="2" fill="#7F8C8D"/>
        <circle cx="8" cy="8" r="2" fill="#FFF"/>
        <circle cx="8" cy="4" r="1" fill="#FFF" opacity="0.5"/>
        <circle cx="8" cy="12" r="1" fill="#FFF" opacity="0.5"/>
        <circle cx="4" cy="8" r="1" fill="#FFF" opacity="0.5"/>
        <circle cx="12" cy="8" r="1" fill="#FFF" opacity="0.5"/>
    </svg>`,
};

// Extension mapping
const extensionMap = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'javascript',
    'tsx': 'javascript',
    'mjs': 'javascript',
    'cjs': 'javascript',

    'json': 'json',
    'md': 'markdown',
    'markdown': 'markdown',

    'png': 'image',
    'jpg': 'image',
    'jpeg': 'image',
    'gif': 'image',
    'svg': 'image',
    'webp': 'image',
    'dds': 'image',
    'tga': 'image',
    'bmp': 'image',

    'bin': 'binary',
    'skn': 'binary',
    'skl': 'binary',
    'anm': 'binary',
    'scb': 'binary',
    'sco': 'binary',
    'wad': 'binary',

    'txt': 'text',
    'log': 'text',
    'ini': 'config',
    'cfg': 'config',
    'toml': 'config',
    'yaml': 'config',
    'yml': 'config',
};

/**
 * Get file icon SVG based on extension
 * @param {string} name - File or folder name
 * @param {boolean} isFolder - Whether it's a folder
 * @param {boolean} isExpanded - Whether folder is expanded
 * @returns {string} SVG icon markup
 */
export function getFileIcon(name, isFolder, isExpanded = false) {
    if (isFolder) {
        return isExpanded ? icons.folderOpen : icons.folder;
    }

    const ext = name.split('.').pop()?.toLowerCase();
    const iconType = extensionMap[ext] || 'file';
    return icons[iconType] || icons.file;
}

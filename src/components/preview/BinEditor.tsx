/**
 * Flint - BIN Editor Component (Monaco Editor)
 * 
 * A full-featured code editor for viewing and editing Ritobin (.bin) files
 * using Monaco Editor with custom syntax highlighting.
 * 
 * Features:
 * - Custom Ritobin language with semantic tokenization
 * - Matching dark theme with bracket pair colorization
 * - Built-in search, replace, and code folding
 * - Dirty state tracking and save functionality
 * - Asset preview on hover (textures, meshes)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Editor, { OnMount, BeforeMount, Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useAppState } from '../../lib/state';
import * as api from '../../lib/api';
import { getIcon } from '../../lib/fileIcons';
import {
    RITOBIN_LANGUAGE_ID,
    RITOBIN_THEME_ID,
    registerRitobinLanguage,
    registerRitobinTheme
} from '../../lib/ritobinLanguage';
import { AssetPreviewTooltip } from './AssetPreviewTooltip';

/** Delay in milliseconds before showing the asset preview tooltip */
const HOVER_DELAY_MS = 3000;

/** Asset file extensions that can be previewed */
const PREVIEWABLE_EXTENSIONS = ['tex', 'dds', 'scb', 'sco', 'skn'];

/**
 * Check if a string value looks like a previewable asset path
 */
function isPreviewableAssetPath(value: string): boolean {
    if (!value) return false;
    const ext = value.toLowerCase().split('.').pop() || '';
    return PREVIEWABLE_EXTENSIONS.includes(ext);
}

/**
 * Extract string value from a line at a given column position
 * Returns the string content if cursor is inside a quoted string
 */
function extractStringAtPosition(line: string, column: number): string | null {
    // Find all quoted strings in the line
    const stringPattern = /"([^"\\]*(\\.[^"\\]*)*)"/g;
    let match;

    while ((match = stringPattern.exec(line)) !== null) {
        const startCol = match.index + 1; // 1-indexed
        const endCol = match.index + match[0].length;

        if (column >= startCol && column <= endCol) {
            // Return the content without quotes
            return match[1];
        }
    }

    return null;
}

interface BinEditorProps {
    filePath: string;
}

export const BinEditor: React.FC<BinEditorProps> = ({ filePath }) => {
    const { showToast, setWorking, setReady } = useAppState();
    const [content, setContent] = useState<string>('');
    const [originalContent, setOriginalContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lineCount, setLineCount] = useState(0);

    // Reference to the Monaco editor instance
    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

    // Asset preview tooltip state
    const [previewAsset, setPreviewAsset] = useState<string | null>(null);
    const [previewPosition, setPreviewPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const [showPreview, setShowPreview] = useState(false);
    const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastHoveredAssetRef = useRef<string | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);

    // Derive dirty state from content comparison
    const isDirty = content !== originalContent;

    // Get base path for resolving asset paths
    const basePath = filePath.split(/[/\\]/).slice(0, -1).join('\\');

    /**
     * Configure Monaco before it mounts - register language and theme.
     * This runs before the editor is created, ensuring the language is available.
     */
    const handleEditorWillMount: BeforeMount = (monaco: Monaco) => {
        registerRitobinLanguage(monaco);
        registerRitobinTheme(monaco);
    };

    /**
     * Store editor reference when mounted for potential future use
     * (e.g., programmatic cursor positioning, formatting, etc.)
     */
    const handleEditorDidMount: OnMount = (editor, _monaco) => {
        editorRef.current = editor;

        // Update line count when content changes
        const model = editor.getModel();
        if (model) {
            setLineCount(model.getLineCount());
            model.onDidChangeContent(() => {
                setLineCount(model.getLineCount());
            });
        }
    };

    /**
     * Handle content changes from the editor
     */
    const handleEditorChange = useCallback((value: string | undefined) => {
        setContent(value || '');
    }, []);

    /**
     * Load BIN file content on mount or when filePath changes
     */
    useEffect(() => {
        const loadBin = async () => {
            setLoading(true);
            setError(null);

            try {
                const text = await api.readOrConvertBin(filePath);
                setContent(text);
                setOriginalContent(text);
                setLineCount(text.split('\n').length);
            } catch (err) {
                console.error('[BinEditor] Error:', err);
                setError((err as Error).message || 'Failed to load BIN file');
            } finally {
                setLoading(false);
            }
        };

        loadBin();
    }, [filePath]);

    /**
     * Save the current content back to the BIN file
     */
    const handleSave = useCallback(async () => {
        try {
            setWorking('Saving BIN file...');
            await api.saveRitobinToBin(filePath, content);
            setOriginalContent(content); // Reset dirty state
            setReady('Saved');
            showToast('success', 'BIN file saved successfully');
        } catch (err) {
            console.error('[BinEditor] Save error:', err);
            const flintError = err as api.FlintError;
            showToast('error', flintError.getUserMessage?.() || 'Failed to save');
        }
    }, [filePath, content, setWorking, setReady, showToast]);

    /**
     * Clear hover timer on cleanup
     */
    useEffect(() => {
        return () => {
            if (hoverTimerRef.current) {
                clearTimeout(hoverTimerRef.current);
            }
        };
    }, []);

    /**
     * Handle mouse movement over editor to detect asset paths
     */
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!editorRef.current) return;

        const editor = editorRef.current;
        const target = e.target as HTMLElement;

        // Only process if we're over the editor content area
        if (!target.closest('.monaco-editor')) return;

        // Get editor container bounds
        const editorDom = editor.getDomNode();
        if (!editorDom) return;

        // Convert screen position to text position
        const pos = editor.getTargetAtClientPoint(e.clientX, e.clientY);
        if (!pos || !pos.position) {
            // Clear timer if we move off text
            if (hoverTimerRef.current) {
                clearTimeout(hoverTimerRef.current);
                hoverTimerRef.current = null;
            }
            return;
        }

        const model = editor.getModel();
        if (!model) return;

        const lineContent = model.getLineContent(pos.position.lineNumber);
        const stringValue = extractStringAtPosition(lineContent, pos.position.column);

        // Update position for tooltip
        setPreviewPosition({ x: e.clientX, y: e.clientY });

        // Check if we're hovering over a previewable asset
        if (stringValue && isPreviewableAssetPath(stringValue)) {
            // If it's a different asset, reset the timer
            if (stringValue !== lastHoveredAssetRef.current) {
                lastHoveredAssetRef.current = stringValue;
                setShowPreview(false);

                // Clear existing timer
                if (hoverTimerRef.current) {
                    clearTimeout(hoverTimerRef.current);
                }

                // Start new timer for 3-second delay
                hoverTimerRef.current = setTimeout(() => {
                    setPreviewAsset(stringValue);
                    setShowPreview(true);
                }, HOVER_DELAY_MS);
            }
        } else {
            // Not over a previewable asset, clear everything
            if (hoverTimerRef.current) {
                clearTimeout(hoverTimerRef.current);
                hoverTimerRef.current = null;
            }
            lastHoveredAssetRef.current = null;
            setShowPreview(false);
        }
    }, []);

    /**
     * Handle mouse leaving the editor area
     */
    const handleMouseLeave = useCallback(() => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
        lastHoveredAssetRef.current = null;
        setShowPreview(false);
    }, []);

    /**
     * Handle click to cancel preview
     */
    const handleClick = useCallback(() => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
        setShowPreview(false);
    }, []);

    // Extract filename for display in toolbar
    const fileName = filePath.split('\\').pop() || filePath.split('/').pop() || 'file.bin';

    // Loading state
    if (loading) {
        return (
            <div className="bin-editor__loading">
                <div className="spinner spinner--lg" />
                <span>Loading BIN file...</span>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="bin-editor__error">
                <span dangerouslySetInnerHTML={{ __html: getIcon('warning') }} />
                <span>{error}</span>
            </div>
        );
    }

    return (
        <div className="bin-editor">
            {/* Toolbar with filename, stats, and save button */}
            <div className="bin-editor__toolbar">
                <span className="bin-editor__filename">
                    {fileName}{isDirty ? ' •' : ''}
                    <span className="bin-editor__stats">
                        {lineCount.toLocaleString()} lines
                    </span>
                </span>
                <div className="bin-editor__toolbar-actions">
                    <button
                        className="btn btn--primary btn--sm"
                        onClick={handleSave}
                        disabled={!isDirty}
                    >
                        Save
                    </button>
                </div>
            </div>

            {/* Monaco Editor with hover detection */}
            <div
                className="bin-editor__content"
                ref={containerRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onClick={handleClick}
            >
                <Editor
                    height="100%"
                    language={RITOBIN_LANGUAGE_ID}
                    theme={RITOBIN_THEME_ID}
                    value={content}
                    onChange={handleEditorChange}
                    beforeMount={handleEditorWillMount}
                    onMount={handleEditorDidMount}
                    options={{
                        // Font settings
                        fontFamily: 'var(--font-mono), "Cascadia Code", "Fira Code", Consolas, "Courier New", monospace',
                        fontSize: 13,
                        lineHeight: 20,

                        // Line numbers
                        lineNumbers: 'on',
                        lineNumbersMinChars: 5,

                        // === PERFORMANCE OPTIMIZATIONS FOR LARGE FILES ===

                        // Disable minimap - saves significant memory and CPU
                        minimap: { enabled: false },

                        // Disable folding - expensive for large files
                        folding: false,

                        // Disable bracket pair colorization - expensive
                        bracketPairColorization: { enabled: false },
                        matchBrackets: 'never',

                        // Limit tokenization to reasonable line length
                        maxTokenizationLineLength: 5000,

                        // Stop rendering very long lines
                        stopRenderingLineAfter: 10000,

                        // Faster scrolling
                        scrollBeyondLastLine: false,
                        smoothScrolling: false,
                        fastScrollSensitivity: 5,

                        // Simpler cursor
                        cursorBlinking: 'solid',
                        cursorSmoothCaretAnimation: 'off',
                        cursorStyle: 'line',

                        // Disable expensive rendering options
                        renderWhitespace: 'none',
                        renderControlCharacters: false,
                        renderLineHighlight: 'none',
                        renderValidationDecorations: 'off',
                        occurrencesHighlight: 'off',
                        selectionHighlight: false,

                        // Disable guides
                        guides: {
                            indentation: false,
                            bracketPairs: false,
                            highlightActiveBracketPair: false,
                            highlightActiveIndentation: false
                        },

                        // Simpler scrollbar
                        scrollbar: {
                            vertical: 'auto',
                            horizontal: 'auto',
                            verticalScrollbarSize: 12,
                            horizontalScrollbarSize: 12,
                            useShadows: false
                        },

                        // === END PERFORMANCE OPTIMIZATIONS ===

                        // Editing basics
                        tabSize: 4,
                        insertSpaces: true,
                        autoIndent: 'none',
                        formatOnPaste: false,
                        formatOnType: false,
                        wordWrap: 'off',

                        // Disable all intellisense/suggestion features
                        quickSuggestions: false,
                        suggestOnTriggerCharacters: false,
                        acceptSuggestionOnEnter: 'off',
                        parameterHints: { enabled: false },
                        wordBasedSuggestions: 'off',

                        // Disable other expensive features
                        hover: { enabled: false },
                        links: false,
                        colorDecorators: false,
                        codeLens: false,
                        inlineSuggest: { enabled: false },
                        contextmenu: false,

                        // Disable accessibility features for performance
                        accessibilitySupport: 'off'
                    }}
                    loading={
                        <div className="bin-editor__loading">
                            <div className="spinner spinner--lg" />
                            <span>Initializing editor...</span>
                        </div>
                    }
                />
            </div>

            {/* Asset Preview Tooltip */}
            {previewAsset && (
                <AssetPreviewTooltip
                    assetPath={previewAsset}
                    basePath={basePath}
                    position={previewPosition}
                    visible={showPreview}
                />
            )}
        </div>
    );
};

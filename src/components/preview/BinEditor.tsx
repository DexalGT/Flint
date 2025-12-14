/**
 * Flint - BIN Editor Component (Virtualized)
 * Features: Virtualized rendering for large files, syntax highlighting only for visible lines
 * Memory optimized: Only renders visible lines + overscan buffer
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAppState } from '../../lib/state';
import * as api from '../../lib/api';
import { getIcon } from '../../lib/fileIcons';

interface BinEditorProps {
    filePath: string;
}

// Line height in pixels - matches CSS .bin-editor__row
const LINE_HEIGHT = 20;

/**
 * Applies syntax highlighting to a single line of ritobin text format
 * Returns HTML string with span elements for different token types
 */
function highlightLine(line: string, bracketDepth: number): { html: string; newDepth: number } {
    const escapeHtml = (str: string) =>
        str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

    const openBrackets = new Set(['{', '[', '(']);
    const closeBrackets = new Set(['}', ']', ')']);

    // Handle comments (lines starting with # or //)
    if (/^\s*(#|\/\/)/.test(line)) {
        return {
            html: `<span class="ritobin-comment">${escapeHtml(line)}</span>`,
            newDepth: bracketDepth
        };
    }

    // Tokenize the line to handle strings properly
    const tokens: { type: string; value: string }[] = [];
    let remaining = line;

    while (remaining.length > 0) {
        // Match double-quoted string
        let match = remaining.match(/^"([^"\\]|\\.)*"/);
        if (match) {
            tokens.push({ type: 'string', value: match[0] });
            remaining = remaining.slice(match[0].length);
            continue;
        }

        // Match word (identifier, keyword, number, etc.)
        match = remaining.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
        if (match) {
            tokens.push({ type: 'word', value: match[0] });
            remaining = remaining.slice(match[0].length);
            continue;
        }

        // Match hex number (0x...) - split into prefix and digits
        match = remaining.match(/^0x([0-9a-fA-F]+)/i);
        if (match) {
            tokens.push({ type: 'hash-prefix', value: '0x' });
            tokens.push({ type: 'hash-value', value: match[1] });
            remaining = remaining.slice(match[0].length);
            continue;
        }

        // Match number (including negative and floats)
        match = remaining.match(/^-?\d+\.?\d*f?/);
        if (match) {
            tokens.push({ type: 'number', value: match[0] });
            remaining = remaining.slice(match[0].length);
            continue;
        }

        // Match brackets separately for colorization
        if (openBrackets.has(remaining[0]) || closeBrackets.has(remaining[0])) {
            tokens.push({ type: 'bracket', value: remaining[0] });
            remaining = remaining.slice(1);
            continue;
        }

        // Match operators
        if ('=+-*/<>!&|:,'.includes(remaining[0])) {
            tokens.push({ type: 'operator', value: remaining[0] });
            remaining = remaining.slice(1);
            continue;
        }

        // Match any other single character
        tokens.push({ type: 'plain', value: remaining[0] });
        remaining = remaining.slice(1);
    }

    // Build result from tokens
    const typeKeywords = new Set([
        'type', 'embed', 'pointer', 'link', 'option', 'list', 'map', 'hash',
        'flag', 'struct', 'u8', 'u16', 'u32', 'u64', 'i8', 'i16', 'i32', 'i64',
        'f32', 'f64', 'bool', 'string', 'vec2', 'vec3', 'vec4', 'mtx44', 'rgba', 'path'
    ]);

    const boolKeywords = new Set(['true', 'false']);

    let result = '';
    let currentDepth = bracketDepth;

    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        const escaped = escapeHtml(token.value);

        switch (token.type) {
            case 'string':
                result += `<span class="ritobin-string">${escaped}</span>`;
                break;
            case 'hash-prefix':
                result += `<span class="ritobin-hash-prefix">${escaped}</span>`;
                break;
            case 'hash-value':
                result += `<span class="ritobin-hash-value">${escaped}</span>`;
                break;
            case 'operator':
                result += `<span class="ritobin-operator">${escaped}</span>`;
                break;
            case 'number':
                result += `<span class="ritobin-number">${escaped}</span>`;
                break;
            case 'bracket': {
                // For closing brackets, decrement before coloring so pairs match
                if (closeBrackets.has(token.value)) {
                    currentDepth = Math.max(0, currentDepth - 1);
                }
                // Cycle through 6 bracket colors
                const colorIndex = currentDepth % 6;
                result += `<span class="ritobin-bracket-${colorIndex}">${escaped}</span>`;
                // For opening brackets, increment after coloring
                if (openBrackets.has(token.value)) {
                    currentDepth++;
                }
                break;
            }
            case 'word': {
                const lower = token.value.toLowerCase();
                // Check if followed by : or = (property name)
                const nextNonSpace = tokens.slice(i + 1).find(t => t.type !== 'plain' || t.value.trim());
                const isProperty = nextNonSpace && (nextNonSpace.value === ':' || nextNonSpace.value === '=');

                if (boolKeywords.has(lower)) {
                    result += `<span class="ritobin-bool">${escaped}</span>`;
                } else if (typeKeywords.has(lower)) {
                    result += `<span class="ritobin-type">${escaped}</span>`;
                } else if (isProperty) {
                    result += `<span class="ritobin-property">${escaped}</span>`;
                } else if (/^[A-Z]/.test(token.value)) {
                    // PascalCase - likely a type/class name
                    result += `<span class="ritobin-keyword">${escaped}</span>`;
                } else {
                    result += escaped;
                }
                break;
            }
            default:
                result += escaped;
        }
    }

    return { html: result, newDepth: currentDepth };
}

/**
 * Pre-compute bracket depth at the start of each line for correct colorization
 */
function computeBracketDepths(lines: string[]): number[] {
    const depths: number[] = [0]; // Depth before line 0
    const openBrackets = new Set(['{', '[', '(']);
    const closeBrackets = new Set(['}', ']', ')']);

    let currentDepth = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip updating depth calculation for comment lines
        if (!/^\s*(#|\/\/)/.test(line)) {
            // Count brackets in this line
            for (const char of line) {
                // Skip characters inside strings
                if (openBrackets.has(char)) {
                    currentDepth++;
                } else if (closeBrackets.has(char)) {
                    currentDepth = Math.max(0, currentDepth - 1);
                }
            }
        }

        depths.push(currentDepth);
    }

    return depths;
}

export const BinEditor: React.FC<BinEditorProps> = ({ filePath }) => {
    const { showToast, setWorking, setReady } = useAppState();
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);

    // Virtualization state
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRAFRef = useRef<number | null>(null);

    // Split content into lines for virtualization
    const lines = useMemo(() => content.split('\n'), [content]);
    const lineCount = lines.length;

    // Pre-compute bracket depths for all lines (needed for proper syntax highlighting)
    const bracketDepths = useMemo(() => computeBracketDepths(lines), [lines]);

    // Calculate total scrollable height
    const totalHeight = lineCount * LINE_HEIGHT;

    // Calculate visible range with overscan
    const visibleRange = useMemo(() => {
        // If container height not yet measured, show a reasonable default
        const effectiveHeight = containerHeight > 0 ? containerHeight : 800;
        const visibleLineCount = Math.ceil(effectiveHeight / LINE_HEIGHT);
        const overscan = visibleLineCount; // 1 screen above + 1 below = 2x visible

        const startLine = Math.max(0, Math.floor(scrollTop / LINE_HEIGHT) - overscan);
        const endLine = Math.min(lineCount - 1, Math.ceil((scrollTop + effectiveHeight) / LINE_HEIGHT) + overscan);

        return { startLine, endLine: Math.max(startLine, endLine) };
    }, [scrollTop, containerHeight, lineCount]);

    // Generate highlighted content only for visible lines
    const visibleLines = useMemo(() => {
        const result: { index: number; html: string }[] = [];

        for (let i = visibleRange.startLine; i <= visibleRange.endLine; i++) {
            const line = lines[i];
            if (line !== undefined) {
                const startDepth = bracketDepths[i];
                const { html } = highlightLine(line, startDepth);
                result.push({ index: i, html });
            }
        }

        return result;
    }, [lines, visibleRange, bracketDepths]);

    useEffect(() => {
        const loadBin = async () => {
            setLoading(true);
            setError(null);

            try {
                const text = await api.readOrConvertBin(filePath);
                setContent(text);
                setIsDirty(false);
            } catch (err) {
                console.error('[BinEditor] Error:', err);
                setError((err as Error).message || 'Failed to load BIN file');
            } finally {
                setLoading(false);
            }
        };

        loadBin();
    }, [filePath]);

    // Measure container height on mount and resize
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateHeight = () => {
            setContainerHeight(container.clientHeight);
        };

        updateHeight();

        const resizeObserver = new ResizeObserver(updateHeight);
        resizeObserver.observe(container);

        return () => {
            resizeObserver.disconnect();
            if (scrollRAFRef.current) {
                cancelAnimationFrame(scrollRAFRef.current);
            }
        };
    }, []);

    // Handle scroll with requestAnimationFrame for performance
    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const target = e.target as HTMLDivElement;

        if (scrollRAFRef.current) {
            cancelAnimationFrame(scrollRAFRef.current);
        }

        scrollRAFRef.current = requestAnimationFrame(() => {
            setScrollTop(target.scrollTop);
        });
    }, []);

    const handleSave = useCallback(async () => {
        try {
            setWorking('Saving BIN file...');
            await api.saveRitobinToBin(filePath, content);
            setIsDirty(false);
            setReady('Saved');
            showToast('success', 'BIN file saved successfully');
        } catch (err) {
            console.error('[BinEditor] Save error:', err);
            const flintError = err as api.FlintError;
            showToast('error', flintError.getUserMessage?.() || 'Failed to save');
        }
    }, [filePath, content, setWorking, setReady, showToast]);

    const fileName = filePath.split('\\').pop() || filePath.split('/').pop() || 'file.bin';

    if (loading) {
        return (
            <div className="bin-editor__loading">
                <div className="spinner spinner--lg" />
                <span>Loading BIN file...</span>
            </div>
        );
    }

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
            <div
                className="bin-editor__content bin-editor__virtualized-container"
                ref={containerRef}
                onScroll={handleScroll}
            >
                <div
                    className="bin-editor__virtualized-spacer"
                    style={{
                        height: `${totalHeight}px`,
                        position: 'relative'
                    }}
                >
                    {/* Render only visible lines with absolute positioning */}
                    {visibleLines.map(({ index, html }) => (
                        <div
                            key={index}
                            className="bin-editor__row"
                            style={{
                                position: 'absolute',
                                top: index * LINE_HEIGHT,
                                left: 0,
                                right: 0,
                                height: LINE_HEIGHT
                            }}
                        >
                            <div className="bin-editor__line-num">
                                {index + 1}
                            </div>
                            <div
                                className="bin-editor__line-content"
                                dangerouslySetInnerHTML={{ __html: html || '&nbsp;' }}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

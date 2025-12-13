/**
 * Flint - BIN Editor Component
 * Features: Synchronized line numbers that scroll with content, syntax highlighting
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAppState } from '../../lib/state';
import * as api from '../../lib/api';
import { getIcon } from '../../lib/fileIcons';

interface BinEditorProps {
    filePath: string;
}

/**
 * Applies syntax highlighting to ritobin text format
 * Returns HTML string with span elements for different token types
 * Includes bracket pair colorization with cycling colors
 */
function highlightRitobin(text: string): string {
    const escapeHtml = (str: string) =>
        str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

    // Track bracket depth across all lines for proper colorization
    let bracketDepth = 0;
    const openBrackets = new Set(['{', '[', '(']);
    const closeBrackets = new Set(['}', ']', ')']);

    const lines = text.split('\n');
    const highlightedLines = lines.map(line => {
        // Handle comments (lines starting with # or //)
        if (/^\s*(#|\/\/)/.test(line)) {
            return `<span class="ritobin-comment">${escapeHtml(line)}</span>`;
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
                        bracketDepth = Math.max(0, bracketDepth - 1);
                    }
                    // Cycle through 6 bracket colors
                    const colorIndex = bracketDepth % 6;
                    result += `<span class="ritobin-bracket-${colorIndex}">${escaped}</span>`;
                    // For opening brackets, increment after coloring
                    if (openBrackets.has(token.value)) {
                        bracketDepth++;
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

        return result;
    });

    return highlightedLines.join('\n');
}

export const BinEditor: React.FC<BinEditorProps> = ({ filePath }) => {
    const { showToast, setWorking, setReady } = useAppState();
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [lineCount, setLineCount] = useState(0);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const lineNumbersRef = useRef<HTMLDivElement>(null);
    const highlightRef = useRef<HTMLPreElement>(null);

    // Memoize the highlighted content to avoid re-computing on every render
    const highlightedContent = useMemo(() => highlightRitobin(content), [content]);

    useEffect(() => {
        const loadBin = async () => {
            setLoading(true);
            setError(null);

            try {
                const text = await api.readOrConvertBin(filePath);
                setContent(text);
                setLineCount(text.split('\n').length);
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

    // Sync scroll between textarea, line numbers, and highlight overlay
    const handleScroll = useCallback(() => {
        if (textareaRef.current) {
            if (lineNumbersRef.current) {
                lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
            }
            if (highlightRef.current) {
                highlightRef.current.scrollTop = textareaRef.current.scrollTop;
                highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
            }
        }
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

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);
        setIsDirty(true);
        setLineCount(e.target.value.split('\n').length);
    }, []);

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
            <div className="bin-editor__content">
                <div className="bin-editor__wrapper">
                    <div
                        className="bin-editor__line-numbers"
                        ref={lineNumbersRef}
                    >
                        {Array.from({ length: lineCount }, (_, i) => (
                            <div key={i} className="bin-editor__line-num">{i + 1}</div>
                        ))}
                    </div>
                    <div className="bin-editor__code-wrapper">
                        {/* Syntax-highlighted overlay (read-only display) */}
                        <pre
                            ref={highlightRef}
                            className="bin-editor__highlight"
                            aria-hidden="true"
                            dangerouslySetInnerHTML={{ __html: highlightedContent + '\n' }}
                        />
                        {/* Transparent textarea for editing */}
                        <textarea
                            ref={textareaRef}
                            className="bin-editor__code bin-editor__code--transparent"
                            value={content}
                            onChange={handleChange}
                            onScroll={handleScroll}
                            spellCheck={false}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

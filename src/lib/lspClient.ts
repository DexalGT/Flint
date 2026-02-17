/**
 * Ritobin LSP Client
 *
 * Spawns ritobin-lsp as a Tauri sidecar and communicates over stdio using the
 * LSP JSON-RPC protocol (Content-Length framing). No extra npm packages needed.
 *
 * The binary must be placed at:
 *   src-tauri/binaries/ritobin-lsp-x86_64-pc-windows-msvc.exe
 *
 * Features provided when connected:
 *   - Inline diagnostics (parse errors, type mismatches)
 *   - Completion items
 *   - Hover info
 */

import { Command, type Child } from '@tauri-apps/plugin-shell';
import type { Monaco } from '@monaco-editor/react';
import type { editor, IDisposable, languages } from 'monaco-editor';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LspStatus = 'off' | 'starting' | 'ready' | 'error';

interface JsonRpcRequest {
    jsonrpc: '2.0';
    id: number;
    method: string;
    params: unknown;
}

interface JsonRpcNotification {
    jsonrpc: '2.0';
    method: string;
    params: unknown;
}

interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: number;
    result?: unknown;
    error?: { code: number; message: string; data?: unknown };
}

type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse;

interface LspRange {
    start: { line: number; character: number };
    end: { line: number; character: number };
}

interface LspDiagnostic {
    range: LspRange;
    severity?: 1 | 2 | 3 | 4;
    message: string;
    source?: string;
}

interface LspPublishDiagnosticsParams {
    uri: string;
    diagnostics: LspDiagnostic[];
}

// ─── Client ───────────────────────────────────────────────────────────────────

export class BinLspClient {
    private child: Child | null = null;
    private buffer = '';
    private nextId = 1;
    private pending = new Map<number, { resolve: (r: unknown) => void; reject: (e: unknown) => void }>();
    private disposables: IDisposable[] = [];
    private docVersion = 0;
    private hoverWasDisabled = false;

    private _status: LspStatus = 'off';
    private readonly onStatus: (s: LspStatus) => void;

    constructor(onStatus: (s: LspStatus) => void) {
        this.onStatus = onStatus;
    }

    get status(): LspStatus { return this._status; }

    private setStatus(s: LspStatus) {
        this._status = s;
        this.onStatus(s);
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    async start(
        monaco: Monaco,
        editorInstance: editor.IStandaloneCodeEditor,
    ) {
        this.setStatus('starting');

        const model = editorInstance.getModel();
        if (!model) { this.setStatus('error'); return; }

        // Spawn the sidecar ──────────────────────────────────────────────────
        let child: Child;
        try {
            const cmd = Command.sidecar('binaries/ritobin-lsp');
            cmd.stdout.on('data', (chunk: string) => this.onChunk(chunk, monaco));
            cmd.stderr.on('data', (line: string) => console.debug('[ritobin-lsp]', line));
            cmd.on('close', () => {
                if (this._status === 'ready') this.setStatus('off');
            });
            child = await cmd.spawn();
            this.child = child;
        } catch {
            // Binary not installed — silently stay 'off'
            this.setStatus('off');
            return;
        }

        // LSP handshake ──────────────────────────────────────────────────────
        try {
            await this.request('initialize', {
                processId: null,
                rootUri: null,
                capabilities: {
                    textDocument: {
                        synchronization: { dynamicRegistration: false },
                        publishDiagnostics: { relatedInformation: false },
                        completion: { completionItem: { snippetSupport: false } },
                        hover: { contentFormat: ['plaintext', 'markdown'] },
                    },
                },
                trace: 'off',
            });
            this.notify('initialized', {});
        } catch (e) {
            console.error('[BinLsp] Handshake failed:', e);
            this.setStatus('error');
            return;
        }

        // Open document ──────────────────────────────────────────────────────
        const docUri = model.uri.toString();
        this.docVersion = 1;
        this.notify('textDocument/didOpen', {
            textDocument: {
                uri: docUri,
                languageId: 'ritobin',
                version: this.docVersion,
                text: model.getValue(),
            },
        });

        this.setStatus('ready');

        // Sync content changes ───────────────────────────────────────────────
        const changeDisp = model.onDidChangeContent(() => {
            this.docVersion++;
            this.notify('textDocument/didChange', {
                textDocument: { uri: docUri, version: this.docVersion },
                contentChanges: [{ text: model.getValue() }],
            });
        });
        this.disposables.push(changeDisp);

        // Completion provider ────────────────────────────────────────────────
        const completionDisp = monaco.languages.registerCompletionItemProvider('ritobin', {
            provideCompletionItems: async (m: editor.ITextModel, pos: { lineNumber: number; column: number }) => {
                if (m.uri.toString() !== docUri) return { suggestions: [] };
                try {
                    const result = await this.request('textDocument/completion', {
                        textDocument: { uri: docUri },
                        position: { line: pos.lineNumber - 1, character: pos.column - 1 },
                    }) as { items?: LspCompletionItem[] } | LspCompletionItem[] | null;
                    const raw = Array.isArray(result) ? result : ((result as { items?: LspCompletionItem[] })?.items ?? []);
                    return { suggestions: raw.map(item => this.toMonacoCompletion(item, monaco, pos)) };
                } catch {
                    return { suggestions: [] };
                }
            },
        });
        this.disposables.push(completionDisp);

        // Hover provider ─────────────────────────────────────────────────────
        const currentOptions = editorInstance.getOptions();
        this.hoverWasDisabled = !currentOptions.get(monaco.editor.EditorOption.hover).enabled;
        if (this.hoverWasDisabled) {
            editorInstance.updateOptions({ hover: { enabled: true } });
        }

        const hoverDisp = monaco.languages.registerHoverProvider('ritobin', {
            provideHover: async (m: editor.ITextModel, pos: { lineNumber: number; column: number }) => {
                if (m.uri.toString() !== docUri) return null;
                try {
                    const result = await this.request('textDocument/hover', {
                        textDocument: { uri: docUri },
                        position: { line: pos.lineNumber - 1, character: pos.column - 1 },
                    }) as LspHoverResult | null;
                    if (!result?.contents) return null;
                    const contents = Array.isArray(result.contents) ? result.contents : [result.contents];
                    return { contents: contents.map(c => ({ value: typeof c === 'string' ? c : c.value })) };
                } catch {
                    return null;
                }
            },
        });
        this.disposables.push(hoverDisp);
    }

    dispose(editorInstance?: editor.IStandaloneCodeEditor, model?: editor.ITextModel) {
        if (model && this._status === 'ready') {
            this.notify('textDocument/didClose', { textDocument: { uri: model.uri.toString() } });
        }

        if (this.hoverWasDisabled && editorInstance) {
            editorInstance.updateOptions({ hover: { enabled: false } });
            this.hoverWasDisabled = false;
        }

        for (const d of this.disposables) d.dispose();
        this.disposables = [];
        this.pending.clear();
        this.child?.kill().catch(() => {});
        this.child = null;
        this.buffer = '';
        this.setStatus('off');
    }

    // ─── Internals ────────────────────────────────────────────────────────────

    private onChunk(chunk: string, monaco: Monaco) {
        this.buffer += chunk;
        while (true) {
            const sep = this.buffer.indexOf('\r\n\r\n');
            if (sep === -1) break;
            const header = this.buffer.slice(0, sep);
            const match = header.match(/Content-Length:\s*(\d+)/i);
            if (!match) { this.buffer = this.buffer.slice(sep + 4); continue; }
            const len = parseInt(match[1], 10);
            const bodyStart = sep + 4;
            if (this.buffer.length < bodyStart + len) break;
            const body = this.buffer.slice(bodyStart, bodyStart + len);
            this.buffer = this.buffer.slice(bodyStart + len);
            try { this.dispatch(JSON.parse(body) as JsonRpcMessage, monaco); } catch { /* corrupt */ }
        }
    }

    private dispatch(msg: JsonRpcMessage, monaco: Monaco) {
        // Response to a pending request
        if ('id' in msg && 'result' in msg || 'id' in msg && 'error' in msg) {
            const resp = msg as JsonRpcResponse;
            const p = this.pending.get(resp.id);
            if (p) {
                this.pending.delete(resp.id);
                resp.error ? p.reject(resp.error) : p.resolve(resp.result);
            }
            return;
        }

        // Server notification
        const notif = msg as JsonRpcNotification;
        if (notif.method === 'textDocument/publishDiagnostics') {
            const { uri, diagnostics } = notif.params as LspPublishDiagnosticsParams;
            const m = monaco.editor.getModel(monaco.Uri.parse(uri));
            if (m) {
                monaco.editor.setModelMarkers(m, 'ritobin-lsp',
                    diagnostics.slice(0, 50).map(d => ({
                        severity: this.toMonacoSeverity(monaco, d.severity),
                        startLineNumber: d.range.start.line + 1,
                        startColumn: d.range.start.character + 1,
                        endLineNumber: d.range.end.line + 1,
                        endColumn: d.range.end.character + 1,
                        message: d.message,
                        source: 'ritobin-lsp',
                    })),
                );
            }
        }
    }

    private request(method: string, params: unknown): Promise<unknown> {
        return new Promise((resolve, reject) => {
            const id = this.nextId++;
            this.pending.set(id, { resolve, reject });
            this.send({ jsonrpc: '2.0', id, method, params });
            // 8 s timeout so the editor doesn't stall
            setTimeout(() => {
                if (this.pending.has(id)) {
                    this.pending.delete(id);
                    reject(new Error(`LSP: ${method} timed out`));
                }
            }, 8000);
        });
    }

    private notify(method: string, params: unknown) {
        this.send({ jsonrpc: '2.0', method, params } as JsonRpcNotification);
    }

    private async send(msg: JsonRpcMessage) {
        if (!this.child) return;
        const body = JSON.stringify(msg);
        const frame = `Content-Length: ${new TextEncoder().encode(body).length}\r\n\r\n${body}`;
        try {
            await this.child.write(frame);
        } catch (e) {
            console.warn('[BinLsp] Write failed:', e);
        }
    }

    private toMonacoSeverity(monaco: Monaco, s?: number) {
        switch (s) {
            case 1: return monaco.MarkerSeverity.Error;
            case 2: return monaco.MarkerSeverity.Warning;
            case 3: return monaco.MarkerSeverity.Info;
            default: return monaco.MarkerSeverity.Hint;
        }
    }

    private toMonacoCompletion(
        item: LspCompletionItem,
        _monaco: Monaco,
        pos: { lineNumber: number; column: number },
    ): languages.CompletionItem {
        return {
            label: item.label,
            kind: (item.kind ?? 1) as languages.CompletionItemKind,
            detail: item.detail ?? undefined,
            documentation: item.documentation ? { value: item.documentation } : undefined,
            insertText: item.insertText ?? item.label,
            range: {
                startLineNumber: pos.lineNumber,
                startColumn: pos.column,
                endLineNumber: pos.lineNumber,
                endColumn: pos.column,
            },
        };
    }
}

// ─── Aux LSP types ────────────────────────────────────────────────────────────

interface LspCompletionItem {
    label: string;
    kind?: number;
    detail?: string;
    documentation?: string;
    insertText?: string;
}

interface LspHoverResult {
    contents: string | { value: string } | (string | { value: string })[];
}

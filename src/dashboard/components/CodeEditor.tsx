import { useEffect, useRef, useState, useCallback } from 'react'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter } from '@codemirror/view'
import { defaultKeymap } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { useEditorStore } from '../../stores/editorStore'
import type { EditorLanguage } from '../../stores/editorStore'
import { useTerminalStore } from '../../stores/terminalStore'
import { agentGutter, setHasTouches } from './editor/agentGutter'
import { useFileTouches } from '../hooks/useFileTouches'
import { AgentTouchPopover } from './AgentTouchPopover'
import { useLspClient } from '../hooks/useLspClient'

// ── Language compartment — allows swapping language extension dynamically ─────
function getLanguageExtension(language: EditorLanguage) {
  switch (language) {
    case 'javascript':
      return javascript({ typescript: true, jsx: true })
    case 'json':
      return json()
    case 'markdown':
      return markdown()
    default:
      return []
  }
}

/** Returns true for file extensions that benefit from TS LSP. */
function isLspFile(path: string | null): boolean {
  if (!path) return false
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  return ['ts', 'tsx', 'js', 'jsx'].includes(ext)
}

// ── LspStatusPill ─────────────────────────────────────────────────────────────
// Small inline pill indicating TypeScript intelligence status.

function LspStatusPill({ status, visible }: { status: 'connecting' | 'ready' | 'error'; visible: boolean }) {
  if (!visible) return null

  // Each status gets BOTH a glyph (shape-encoded for color-blind users) and
  // distinct label text. Color is decorative, not the primary signal.
  const glyph =
    status === 'ready' ? '●'
    : status === 'connecting' ? '○'
    : '×'

  const label =
    status === 'ready' ? 'TS: ready'
    : status === 'connecting' ? 'TS: connecting'
    : 'TS: unavailable'

  const color =
    status === 'ready' ? '#4ec94e'
    : status === 'connecting' ? '#bbb'
    : '#e06c75'

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`TypeScript language server: ${status}`}
      style={{
        position: 'absolute',
        top: 6,
        right: 8,
        zIndex: 10,
        padding: '2px 8px',
        borderRadius: 10,
        background: 'rgba(0,0,0,0.45)',
        color,
        fontSize: '11px',
        fontFamily: '"SF Mono", Menlo, Monaco, monospace',
        letterSpacing: '0.02em',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <span aria-hidden="true" style={{ marginRight: 4 }}>{glyph}</span>
      {label}
    </div>
  )
}

// ── CodeEditor ─────────────────────────────────────────────────────────────────
// CodeMirror 6 editor with IDE-3 agent gutter annotations and IDE-4 LSP support.

export function CodeEditor() {
  const activeFilePath = useEditorStore((s) => s.activeFilePath)
  const openFiles = useEditorStore((s) => s.openFiles)
  const updateContent = useEditorStore((s) => s.updateContent)
  const activeFile = openFiles.find((f) => f.path === activeFilePath) ?? null

  // Workspace root for the LSP server — use the active terminal's cwd.
  // If no terminal is active, fall back to: directory of the active file, then
  // process home dir hint, then '/'. Never pass an empty string to the LSP —
  // it confuses path resolution and is the most common cause of broken
  // intelligence on the first open.
  const terminalCwd = useTerminalStore((s) => {
    const activeId = s.activeTabId
    if (!activeId) return null
    return s.tabs.find((t) => t.id === activeId)?.cwd ?? null
  })
  const activeFileDir = activeFilePath
    ? activeFilePath.split('/').slice(0, -1).join('/') || '/'
    : null
  const workspaceRoot = terminalCwd ?? activeFileDir ?? '/'

  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const languageCompartment = useRef(new Compartment())
  const lspCompartment = useRef(new Compartment())

  // Ref to always point at the current path/callback without recreating the view
  const activePathRef = useRef<string | null>(activeFilePath)
  const updateContentRef = useRef(updateContent)

  // Keep refs in sync
  activePathRef.current = activeFilePath
  updateContentRef.current = updateContent

  // ── Agent gutter popover state ──────────────────────────────────────────────
  const [popoverAnchor, setPopoverAnchor] = useState<HTMLElement | null>(null)
  const popoverOpen = popoverAnchor !== null

  const filename = activeFilePath
    ? (activeFilePath.split('/').pop() ?? activeFilePath)
    : ''

  const handleOpenPopover = useCallback((anchor: HTMLElement) => {
    setPopoverAnchor(anchor)
  }, [])

  const handleClosePopover = useCallback(() => {
    if (popoverAnchor) {
      try { popoverAnchor.focus() } catch { /* ignore */ }
    }
    setPopoverAnchor(null)
  }, [popoverAnchor])

  // ── Fetch agent touches for current file ───────────────────────────────────
  const { touches } = useFileTouches(activeFilePath)

  // ── IDE-4: LSP client ──────────────────────────────────────────────────────
  const { extension: lspExtension, status: lspStatus } = useLspClient(workspaceRoot)

  // ── Sync touch data into CodeMirror state field ────────────────────────────
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: setHasTouches.of(touches.length > 0),
    })
  }, [touches])

  // ── Create EditorView on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const onChange = EditorView.updateListener.of((update) => {
      if (!update.docChanged) return
      const path = activePathRef.current
      if (!path) return
      updateContentRef.current(path, update.state.doc.toString())
    })

    const view = new EditorView({
      state: EditorState.create({
        doc: '',
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          // IDE-3: agent gutter — dot at line 1 when file has agent touches
          ...agentGutter(handleOpenPopover, filename),
          languageCompartment.current.of([]),
          // IDE-4: LSP compartment — reconfigured when LSP becomes ready/unavailable
          lspCompartment.current.of([]),
          oneDark,
          keymap.of(defaultKeymap),
          onChange,
          EditorView.theme({
            '&': { height: '100%' },
            '.cm-scroller': { overflow: 'auto', fontFamily: '"SF Mono", Menlo, Monaco, monospace', fontSize: '13px' },
            '.cm-agent-gutter': { width: '16px' },
          }),
        ],
      }),
      parent: containerRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Update editor content and language when active file changes ─────────────
  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    if (!activeFile) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: '' },
        effects: languageCompartment.current.reconfigure([]),
      })
      return
    }

    const currentDoc = view.state.doc.toString()
    if (currentDoc !== activeFile.content) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: activeFile.content },
        effects: languageCompartment.current.reconfigure(
          getLanguageExtension(activeFile.language),
        ),
      })
    } else {
      view.dispatch({
        effects: languageCompartment.current.reconfigure(
          getLanguageExtension(activeFile.language),
        ),
      })
    }
  }, [activeFile])

  // ── Reconfigure LSP compartment when status or active file changes ──────────
  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const shouldAttach = lspStatus === 'ready' && lspExtension !== null && isLspFile(activeFilePath)
    view.dispatch({
      effects: lspCompartment.current.reconfigure(shouldAttach ? lspExtension : []),
    })
  }, [lspStatus, lspExtension, activeFilePath])

  // Show the LSP pill only when the active file is a TS/JS file
  const showLspPill = isLspFile(activeFilePath)

  // NOTE: we ALWAYS render the CodeMirror container, even when no file is
  // active. Earlier versions early-returned a placeholder div in this case,
  // which meant `containerRef.current` was null when the mount effect ran —
  // and because the effect has `[]` deps it never re-ran after a file was
  // opened, so CodeMirror never instantiated. The placeholder is now an
  // overlay on top of the always-mounted container.
  return (
    <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div
        ref={containerRef}
        role="region"
        aria-label={activeFile
          ? `Editor — ${filename} (editable)`
          : 'Editor — no file open'}
        data-testid="code-editor"
        style={{
          flex: 1,
          overflow: 'hidden',
          background: '#282c34',
        }}
      />

      {/* Empty-state overlay — sits on top of the always-mounted editor */}
      {!activeFile && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--cast-center-bg)',
            color: 'var(--text-muted)',
            fontSize: '0.875rem',
            pointerEvents: 'none',
          }}
        >
          Open a file from the project tree to view it here.
        </div>
      )}

      {/* IDE-4: TypeScript LSP status pill */}
      <LspStatusPill status={lspStatus} visible={showLspPill} />

      {/* Agent touch popover */}
      {popoverOpen && activeFile && (
        <AgentTouchPopover
          touches={touches}
          anchorEl={popoverAnchor}
          filename={filename}
          onClose={handleClosePopover}
        />
      )}
    </div>
  )
}

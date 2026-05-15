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
import { agentGutter, setHasTouches } from './editor/agentGutter'
import { useFileTouches } from '../hooks/useFileTouches'
import { AgentTouchPopover } from './AgentTouchPopover'

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

// ── CodeEditor ─────────────────────────────────────────────────────────────────
// CodeMirror 6 editor with IDE-3 agent gutter annotations.

export function CodeEditor() {
  const activeFilePath = useEditorStore((s) => s.activeFilePath)
  const openFiles = useEditorStore((s) => s.openFiles)
  const updateContent = useEditorStore((s) => s.updateContent)
  const activeFile = openFiles.find((f) => f.path === activeFilePath) ?? null

  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const languageCompartment = useRef(new Compartment())

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
    // Return focus to the gutter button before unmounting the popover so
    // keyboard users land back on the trigger.
    if (popoverAnchor) {
      try { popoverAnchor.focus() } catch { /* ignore */ }
    }
    setPopoverAnchor(null)
  }, [popoverAnchor])

  // ── Fetch agent touches for current file ───────────────────────────────────
  const { touches } = useFileTouches(activeFilePath)

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

  if (!activeFile) {
    return (
      <div
        role="region"
        aria-label="Editor — no file open"
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--cast-center-bg)',
          color: 'var(--text-muted)',
          fontSize: '0.875rem',
        }}
      >
        Open a file from the project tree to view it here.
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div
        ref={containerRef}
        role="region"
        aria-label={`Editor — ${filename} (editable)`}
        data-testid="code-editor"
        style={{
          flex: 1,
          overflow: 'hidden',
          background: '#282c34',
        }}
      />

      {/* Agent touch popover */}
      {popoverOpen && (
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

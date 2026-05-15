import { useEffect, useRef } from 'react'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter } from '@codemirror/view'
import { defaultKeymap } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { useEditorStore } from '../../stores/editorStore'
import type { EditorLanguage } from '../../stores/editorStore'

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
// CodeMirror 6 read-only viewer. Replaces editor state when the active file
// changes. Language extension is picked by file extension (via editorStore).
// Theme: oneDark for now (theme integration is post-MVP).

export function CodeEditor() {
  const activeFilePath = useEditorStore((s) => s.activeFilePath)
  const openFiles = useEditorStore((s) => s.openFiles)
  const activeFile = openFiles.find((f) => f.path === activeFilePath) ?? null

  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const languageCompartment = useRef(new Compartment())

  // ── Create EditorView on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const view = new EditorView({
      state: EditorState.create({
        doc: '',
        extensions: [
          EditorState.readOnly.of(true),
          lineNumbers(),
          highlightActiveLineGutter(),
          languageCompartment.current.of([]),
          oneDark,
          keymap.of(defaultKeymap),
          EditorView.theme({
            '&': { height: '100%' },
            '.cm-scroller': { overflow: 'auto', fontFamily: '"SF Mono", Menlo, Monaco, monospace', fontSize: '13px' },
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
  }, [])

  // ── Update editor content and language when active file changes ─────────────
  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    if (!activeFile) {
      // No file open — clear editor
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: '' },
        effects: languageCompartment.current.reconfigure([]),
      })
      return
    }

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: activeFile.content },
      effects: languageCompartment.current.reconfigure(
        getLanguageExtension(activeFile.language),
      ),
    })
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
    <div
      ref={containerRef}
      role="region"
      aria-label={`Editor — ${activeFile.path.split('/').pop() ?? activeFile.path}`}
      data-testid="code-editor"
      style={{
        flex: 1,
        overflow: 'hidden',
        background: '#282c34', // oneDark background
      }}
    />
  )
}

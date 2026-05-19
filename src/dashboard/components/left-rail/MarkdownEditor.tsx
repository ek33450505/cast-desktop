/**
 * MarkdownEditor — CodeMirror 6 editor with markdown syntax highlighting.
 *
 * Features:
 * - Dawn/dusk theme support (dawn uses CSS token vars; dusk uses oneDark)
 * - Cmd+S / Ctrl+S triggers onSave callback
 * - Line wrapping, undo/redo history
 *
 * Limitation (v1 TODO): appearance theme is baked at construction time.
 * The editor will keep its initial theme until the modal is closed and reopened.
 * A proper fix requires a StateEffect + Compartment to hot-swap the theme extension.
 */

import { useCallback, useEffect, useRef } from 'react'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { defaultKeymap, historyKeymap, history } from '@codemirror/commands'
import { oneDark } from '@codemirror/theme-one-dark'
import { useAppearance } from '../../../hooks/useAppearance'

interface MarkdownEditorProps {
  initialContent: string
  onChange: (content: string) => void
  onSave: (content: string) => void
}

// Dawn (light) theme — minimal override using CSS design tokens
const dawnTheme = EditorView.theme({
  '&': { background: 'var(--system-elevated)', color: 'var(--content-primary)', height: '100%' },
  '.cm-scroller': { fontFamily: 'var(--font-mono, ui-monospace)', fontSize: '0.8125rem', lineHeight: '1.6' },
  '.cm-content': { caretColor: 'var(--accent)', padding: '1rem' },
  '.cm-cursor': { borderLeftColor: 'var(--accent)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { background: 'var(--selection-bg, rgba(0,0,0,0.12))' },
  '.cm-line': { padding: '0 4px' },
})

// Dusk (dark) theme — layout overrides on top of oneDark
const duskTheme = EditorView.theme({
  '&': { background: 'var(--system-elevated)', height: '100%' },
  '.cm-scroller': { fontFamily: 'var(--font-mono, ui-monospace)', fontSize: '0.8125rem', lineHeight: '1.6' },
  '.cm-content': { caretColor: 'var(--accent)', padding: '1rem' },
  '.cm-line': { padding: '0 4px' },
})

export function MarkdownEditor({ initialContent, onChange, onSave }: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const { appearance } = useAppearance()

  // Stable save callback — updated via ref so the keymap closure never goes stale
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const handleSave = useCallback(() => {
    if (viewRef.current) {
      onSaveRef.current(viewRef.current.state.doc.toString())
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const saveKeymap = keymap.of([
      { key: 'Mod-s', run: () => { handleSave(); return true } },
    ])

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        history(),
        markdown(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        saveKeymap,
        appearance === 'dusk' ? [oneDark, duskTheme] : dawnTheme,
        EditorView.lineWrapping,
        placeholder('Start writing…'),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChange(update.state.doc.toString())
          }
        }),
      ],
    })

    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Only create once — appearance-change theme swap is a v1 TODO (see file comment)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-auto"
      aria-label="Markdown editor"
    />
  )
}

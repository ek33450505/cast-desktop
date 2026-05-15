import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CodeEditor } from './CodeEditor'
import { useEditorStore } from '../../stores/editorStore'

// CodeMirror creates canvas / DOM that jsdom can't fully support.
// Stub the EditorView to avoid canvas errors while still testing
// that CodeEditor renders the correct container and states.
vi.mock('@codemirror/view', async (importOriginal) => {
  const original = await importOriginal<typeof import('@codemirror/view')>()

  class MockEditorView {
    constructor({ parent }: { parent?: HTMLElement }) {
      if (parent) {
        parent.setAttribute('data-cm-mounted', 'true')
      }
    }
    dispatch() {}
    destroy() {}
    get state() {
      return { doc: { length: 0 } }
    }
    static theme() { return [] }
    static baseTheme() { return [] }
    static updateListener = { of: () => [] }
    static domEventHandlers = { of: () => [] }
    static contentAttributes = { of: () => [] }
    static editorAttributes = { of: () => [] }
    static lineWrapping = []
  }

  return {
    ...original,
    EditorView: MockEditorView,
  }
})

beforeEach(() => {
  useEditorStore.setState({ openFiles: [], activeFilePath: null, bottomDockExpanded: false })
})

describe('CodeEditor', () => {
  it('shows empty state when no file is open', () => {
    render(<CodeEditor />)
    expect(screen.getByText(/open a file/i)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: /no file open/i })).toBeInTheDocument()
  })

  it('mounts editor container when a file is open', () => {
    useEditorStore.setState({
      openFiles: [{ path: '/foo/bar.ts', content: 'const x = 1', language: 'javascript' }],
      activeFilePath: '/foo/bar.ts',
    })
    render(<CodeEditor />)
    const editor = screen.getByTestId('code-editor')
    expect(editor).toBeInTheDocument()
    expect(editor).toHaveAttribute('data-cm-mounted', 'true')
  })

  it('has correct aria-label when file is open', () => {
    useEditorStore.setState({
      openFiles: [{ path: '/foo/readme.md', content: '# Hello', language: 'markdown' }],
      activeFilePath: '/foo/readme.md',
    })
    render(<CodeEditor />)
    expect(screen.getByRole('region', { name: /editor — readme\.md/i })).toBeInTheDocument()
  })

  it('does not throw when switching between files', () => {
    useEditorStore.setState({
      openFiles: [
        { path: '/foo/a.ts', content: 'a', language: 'javascript' },
        { path: '/foo/b.json', content: '{}', language: 'json' },
      ],
      activeFilePath: '/foo/a.ts',
    })
    const { rerender } = render(<CodeEditor />)
    useEditorStore.setState({ activeFilePath: '/foo/b.json' })
    expect(() => rerender(<CodeEditor />)).not.toThrow()
  })
})

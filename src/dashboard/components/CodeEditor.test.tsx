import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { CodeEditor } from './CodeEditor'
import { useEditorStore } from '../../stores/editorStore'

// CodeMirror creates canvas / DOM that jsdom can't fully support.
// Stub the EditorView to avoid canvas errors while still testing
// that CodeEditor renders the correct container and states.
let capturedUpdateListener: ((update: { docChanged: boolean; state: { doc: { toString: () => string } } }) => void) | null = null

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
      return { doc: { length: 0, toString: () => '' } }
    }
    static theme() { return [] }
    static baseTheme() { return [] }
    static updateListener = {
      of: (cb: (update: { docChanged: boolean; state: { doc: { toString: () => string } } }) => void) => {
        capturedUpdateListener = cb
        return []
      },
    }
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
  capturedUpdateListener = null
  useEditorStore.setState({
    openFiles: [],
    activeFilePath: null,
    bottomDockExpanded: false,
    dirty: new Set<string>(),
    originalContent: new Map<string, string>(),
  })
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

  it('has correct aria-label that includes (editable) when file is open', () => {
    useEditorStore.setState({
      openFiles: [{ path: '/foo/readme.md', content: '# Hello', language: 'markdown' }],
      activeFilePath: '/foo/readme.md',
    })
    render(<CodeEditor />)
    expect(screen.getByRole('region', { name: /editor — readme\.md.*editable/i })).toBeInTheDocument()
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

  it('onChange fires updateContent when doc changes', () => {
    useEditorStore.setState({
      openFiles: [{ path: '/foo/a.ts', content: 'original', language: 'javascript' }],
      activeFilePath: '/foo/a.ts',
      originalContent: new Map([['/foo/a.ts', 'original']]),
    })
    render(<CodeEditor />)

    // Simulate a CodeMirror document change via the captured listener
    act(() => {
      capturedUpdateListener?.({
        docChanged: true,
        state: { doc: { toString: () => 'edited content' } },
      })
    })

    // Content should be updated and dirty flag set
    const s = useEditorStore.getState()
    const file = s.openFiles.find((f) => f.path === '/foo/a.ts')
    expect(file?.content).toBe('edited content')
    expect(s.dirty.has('/foo/a.ts')).toBe(true)
  })

  it('onChange does not call updateContent when docChanged is false', () => {
    useEditorStore.setState({
      openFiles: [{ path: '/foo/a.ts', content: 'original', language: 'javascript' }],
      activeFilePath: '/foo/a.ts',
      originalContent: new Map([['/foo/a.ts', 'original']]),
    })
    render(<CodeEditor />)

    act(() => {
      capturedUpdateListener?.({
        docChanged: false,
        state: { doc: { toString: () => 'unchanged' } },
      })
    })

    // dirty should not be set
    expect(useEditorStore.getState().dirty.has('/foo/a.ts')).toBe(false)
  })
})

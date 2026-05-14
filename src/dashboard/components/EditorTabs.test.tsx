import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditorTabs } from './EditorTabs'
import { useEditorStore } from '../../stores/editorStore'

// react-hotkeys-hook is difficult to test in jsdom — stub it to avoid
// side-effect registration issues without breaking component rendering.
vi.mock('react-hotkeys-hook', () => ({
  useHotkeys: vi.fn(),
}))

beforeEach(() => {
  useEditorStore.setState({ openFiles: [], activeFilePath: null, bottomDockExpanded: false })
})

describe('EditorTabs', () => {
  it('renders nothing when no files are open', () => {
    const { container } = render(<EditorTabs />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a tab for each open file', () => {
    useEditorStore.setState({
      openFiles: [
        { path: '/foo/a.ts', content: 'a', language: 'javascript' },
        { path: '/foo/b.json', content: 'b', language: 'json' },
      ],
      activeFilePath: '/foo/a.ts',
    })
    render(<EditorTabs />)
    expect(screen.getByText('a.ts')).toBeInTheDocument()
    expect(screen.getByText('b.json')).toBeInTheDocument()
  })

  it('marks active tab with aria-selected=true', () => {
    useEditorStore.setState({
      openFiles: [
        { path: '/foo/a.ts', content: 'a', language: 'javascript' },
        { path: '/foo/b.ts', content: 'b', language: 'javascript' },
      ],
      activeFilePath: '/foo/a.ts',
    })
    render(<EditorTabs />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    expect(tabs[1]).toHaveAttribute('aria-selected', 'false')
  })

  it('calls setActive when a tab is clicked', async () => {
    useEditorStore.setState({
      openFiles: [
        { path: '/foo/a.ts', content: 'a', language: 'javascript' },
        { path: '/foo/b.ts', content: 'b', language: 'javascript' },
      ],
      activeFilePath: '/foo/a.ts',
    })
    render(<EditorTabs />)
    const bTab = screen.getByRole('tab', { name: /b\.ts/i })
    fireEvent.click(bTab)
    expect(useEditorStore.getState().activeFilePath).toBe('/foo/b.ts')
  })

  it('close button calls closeFile', async () => {
    useEditorStore.setState({
      openFiles: [
        { path: '/foo/a.ts', content: 'a', language: 'javascript' },
      ],
      activeFilePath: '/foo/a.ts',
    })
    render(<EditorTabs />)
    const closeBtn = screen.getByRole('button', { name: /close a\.ts/i })
    fireEvent.click(closeBtn)
    expect(useEditorStore.getState().openFiles).toHaveLength(0)
  })

  it('renders close buttons with proper aria-labels', () => {
    useEditorStore.setState({
      openFiles: [
        { path: '/foo/readme.md', content: '', language: 'markdown' },
      ],
      activeFilePath: '/foo/readme.md',
    })
    render(<EditorTabs />)
    expect(screen.getByRole('button', { name: 'Close readme.md' })).toBeInTheDocument()
  })

  it('renders tablist with aria-label', () => {
    useEditorStore.setState({
      openFiles: [{ path: '/foo/a.ts', content: 'a', language: 'javascript' }],
      activeFilePath: '/foo/a.ts',
    })
    render(<EditorTabs />)
    expect(screen.getByRole('tablist', { name: 'Editor tabs' })).toBeInTheDocument()
  })
})

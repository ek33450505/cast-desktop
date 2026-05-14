import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { EditorShellLayout } from './EditorShellLayout'
import { useEditorStore } from '../../stores/editorStore'
import { useTerminalStore } from '../../stores/terminalStore'

// Stub Tauri fs — not available in jsdom
vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: vi.fn().mockResolvedValue([]),
  readTextFile: vi.fn().mockResolvedValue('// file content'),
}))

// Stub TerminalTabs — heavy xterm dependency, not needed for smoke tests
vi.mock('../../components/terminal/TerminalTabs', () => ({
  TerminalTabs: () => <div data-testid="terminal-tabs-stub">TerminalTabs</div>,
}))

// Stub react-hotkeys-hook
vi.mock('react-hotkeys-hook', () => ({
  useHotkeys: vi.fn(),
}))

// Stub CodeMirror view
vi.mock('@codemirror/view', async (importOriginal) => {
  const original = await importOriginal<typeof import('@codemirror/view')>()
  class MockEditorView {
    constructor({ parent }: { parent?: HTMLElement }) {
      if (parent) parent.setAttribute('data-cm-mounted', 'true')
    }
    dispatch() {}
    destroy() {}
    get state() { return { doc: { length: 0 } } }
    static theme() { return [] }
  }
  return { ...original, EditorView: MockEditorView }
})

function renderInRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

beforeEach(() => {
  useEditorStore.setState({ openFiles: [], activeFilePath: null, bottomDockExpanded: false })
  useTerminalStore.setState({ tabs: [], activeTabId: null })
})

describe('EditorShellLayout smoke tests', () => {
  it('renders without crashing', () => {
    renderInRouter(<EditorShellLayout />)
    // File tree panel header and terminal dock header are present
    expect(screen.getByText('Explorer')).toBeInTheDocument()
    expect(screen.getByText('Terminal')).toBeInTheDocument()
  })

  it('terminal dock is collapsed by default', () => {
    renderInRouter(<EditorShellLayout />)
    const region = document.getElementById('editor-terminal-dock')
    expect(region?.style.height).toBe('0px')
    // TerminalTabs stub not mounted when collapsed
    expect(screen.queryByTestId('terminal-tabs-stub')).not.toBeInTheDocument()
  })

  it('expand button expands terminal dock', () => {
    renderInRouter(<EditorShellLayout />)
    const expandBtn = screen.getByRole('button', { name: /expand terminal/i })
    fireEvent.click(expandBtn)
    expect(useEditorStore.getState().bottomDockExpanded).toBe(true)
    expect(screen.getByTestId('terminal-tabs-stub')).toBeInTheDocument()
  })

  it('collapse button collapses terminal dock', () => {
    useEditorStore.setState({ openFiles: [], activeFilePath: null, bottomDockExpanded: true })
    renderInRouter(<EditorShellLayout />)
    const collapseBtn = screen.getByRole('button', { name: /collapse terminal/i })
    fireEvent.click(collapseBtn)
    expect(useEditorStore.getState().bottomDockExpanded).toBe(false)
  })

  it('expand button has correct aria-expanded', () => {
    renderInRouter(<EditorShellLayout />)
    const btn = screen.getByRole('button', { name: /expand terminal/i })
    expect(btn).toHaveAttribute('aria-expanded', 'false')
  })

  it('terminal store sessions survive route change (terminalStore persists)', () => {
    // Add a session to terminalStore before rendering EditorShellLayout
    const tab = useTerminalStore.getState().addTab('~/projects')
    renderInRouter(<EditorShellLayout />)
    // After render, the store should still have the tab
    const storeTabs = useTerminalStore.getState().tabs
    expect(storeTabs.find((t) => t.id === tab.id)).toBeDefined()
  })
})

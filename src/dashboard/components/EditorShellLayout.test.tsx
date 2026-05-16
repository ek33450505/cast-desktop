import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { EditorShellLayout } from './EditorShellLayout'
import { useEditorStore } from '../../stores/editorStore'
import { useTerminalStore } from '../../stores/terminalStore'
import { NAV_ITEMS } from '../lib/navItems'

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

// Stub CodeEditor wholesale — shell smoke tests don't need a real CodeMirror.
// (We previously only mocked @codemirror/view partially, but the always-mount
// path in CodeEditor uses several more static facets — stubbing the component
// is simpler and more correct than trying to keep a CodeMirror mock in sync.)
vi.mock('./CodeEditor', () => ({
  CodeEditor: () => <div data-testid="code-editor-stub">CodeEditor</div>,
}))

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

describe('EditorShellLayout — nav menu', () => {
  it('Menu button renders with accessible name "Open navigation menu"', () => {
    renderInRouter(<EditorShellLayout />)
    expect(screen.getByRole('button', { name: 'Open navigation menu' })).toBeInTheDocument()
  })

  it('Menu button has aria-haspopup="menu" and aria-expanded="false" initially', () => {
    renderInRouter(<EditorShellLayout />)
    const btn = screen.getByRole('button', { name: 'Open navigation menu' })
    expect(btn).toHaveAttribute('aria-haspopup', 'menu')
    expect(btn).toHaveAttribute('aria-expanded', 'false')
  })

  it('clicking Menu button opens popover containing all NAV_ITEMS', () => {
    renderInRouter(<EditorShellLayout />)
    const btn = screen.getByRole('button', { name: 'Open navigation menu' })
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    const menu = screen.getByRole('menu')
    expect(menu).toBeInTheDocument()
    for (const item of NAV_ITEMS) {
      expect(screen.getByRole('menuitem', { name: item.label })).toBeInTheDocument()
    }
  })

  it('clicking a NavLink closes the popover', () => {
    renderInRouter(<EditorShellLayout />)
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    const sessionsItem = screen.getByRole('menuitem', { name: 'Sessions' })
    fireEvent.click(sessionsItem)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('pressing Escape closes the popover', () => {
    renderInRouter(<EditorShellLayout />)
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('clicking outside the nav menu wrapper closes the popover', () => {
    renderInRouter(<EditorShellLayout />)
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation menu' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})

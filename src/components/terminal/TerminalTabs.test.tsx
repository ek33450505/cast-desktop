import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TerminalTabs } from './TerminalTabs'
import { useTerminalStore } from '../../stores/terminalStore'

// Mock TerminalPane — jsdom can't run xterm
vi.mock('./TerminalPane', () => ({
  TerminalPane: ({ tabId }: { tabId: string }) => (
    <div data-testid="terminal-pane" data-tab-id={tabId} />
  ),
}))

// Mock framer-motion's useReducedMotion
vi.mock('framer-motion', () => ({
  useReducedMotion: vi.fn(() => false),
}))

beforeEach(() => {
  // Reset store to clean state before each test
  useTerminalStore.setState({ tabs: [], activeTabId: null })
  vi.clearAllMocks()
})

describe('TerminalTabs', () => {
  it('auto-bootstraps one tab on mount when tabs is empty', () => {
    render(<TerminalTabs />)
    const { tabs } = useTerminalStore.getState()
    expect(tabs.length).toBe(1)
  })

  it('renders the active tab title in the tab strip', () => {
    useTerminalStore.getState().addTab('~')
    render(<TerminalTabs />)
    // title derived from cwd '~' → last segment of '~'.split('/').filter(Boolean) → '~'
    // Actually in the store: cwd='~', title = '~'.split('/').filter(Boolean).pop() ?? 'Terminal 1'
    // '~'.split('/') = ['~'], filter(Boolean) = ['~'], pop() = '~'
    expect(screen.getByText('~')).toBeTruthy()
  })

  it('renders a TerminalPane for the active tab', () => {
    const tab = useTerminalStore.getState().addTab('~')
    render(<TerminalTabs />)
    const pane = screen.getByTestId('terminal-pane')
    expect(pane.getAttribute('data-tab-id')).toBe(tab.id)
  })

  it('clicking + adds a new tab (store grows from 1 → 2)', () => {
    useTerminalStore.getState().addTab('~')
    render(<TerminalTabs />)

    const addBtn = screen.getByRole('button', { name: 'New terminal tab' })
    fireEvent.click(addBtn)

    expect(useTerminalStore.getState().tabs.length).toBe(2)
  })

  it('clicking × on a tab without ptyId removes it without confirm', () => {
    const tab = useTerminalStore.getState().addTab('~')
    // ensure ptyId is null (default)
    expect(tab.ptyId).toBeNull()

    const confirmSpy = vi.spyOn(window, 'confirm')
    render(<TerminalTabs />)

    const closeBtn = screen.getByRole('button', { name: `Close ${tab.title}` })
    fireEvent.click(closeBtn)

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(useTerminalStore.getState().tabs.length).toBe(0)
  })

  it('clicking × on a tab WITH ptyId removes it without calling window.confirm', () => {
    const tab = useTerminalStore.getState().addTab('~')
    useTerminalStore.getState().setTabPtyId(tab.id, 'pty-123')

    const confirmSpy = vi.spyOn(window, 'confirm')
    render(<TerminalTabs />)

    const closeBtn = screen.getByRole('button', { name: `Close ${tab.title}` })
    fireEvent.click(closeBtn)

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(useTerminalStore.getState().tabs.length).toBe(0)
  })

  it('tablist has role=tablist with correct aria-label', () => {
    useTerminalStore.getState().addTab('~')
    render(<TerminalTabs />)
    const tablist = screen.getByRole('tablist')
    expect(tablist.getAttribute('aria-label')).toBe('Terminal tabs')
  })

  it('each tab has role=tab with aria-selected', () => {
    const tab1 = useTerminalStore.getState().addTab('~')
    useTerminalStore.getState().addTab('/tmp')
    // tab1 is active (addTab sets activeTabId to newly added tab; last added is active)
    // Actually addTab always sets activeTabId to the new tab — so /tmp is active
    render(<TerminalTabs />)

    const tabs = screen.getAllByRole('tab')
    expect(tabs.length).toBe(2)

    // The tab with aria-selected=true should be the last added (/tmp)
    const selectedTab = tabs.find((t) => t.getAttribute('aria-selected') === 'true')
    expect(selectedTab).toBeTruthy()
    // The tab with aria-selected=false should be ~
    const unselectedTab = tabs.find((t) => t.getAttribute('aria-selected') === 'false')
    expect(unselectedTab).toBeTruthy()
  })

  it('clicking a tab body calls setActiveTab', () => {
    const tab1 = useTerminalStore.getState().addTab('~')
    const tab2 = useTerminalStore.getState().addTab('/tmp')
    // tab2 is currently active
    expect(useTerminalStore.getState().activeTabId).toBe(tab2.id)

    render(<TerminalTabs />)

    // Click on the tab1 row element (role=tab, has the title text)
    const tabEls = screen.getAllByRole('tab')
    // tab1 is at index 0 (added first)
    fireEvent.click(tabEls[0])

    expect(useTerminalStore.getState().activeTabId).toBe(tab1.id)
  })

  it('moves focus to the new active tab button after closing the active tab via ×', async () => {
    // Set up two tabs: tab1 (added first), tab2 (active — added last)
    const tab1 = useTerminalStore.getState().addTab('~')
    const tab2 = useTerminalStore.getState().addTab('/tmp')
    expect(useTerminalStore.getState().activeTabId).toBe(tab2.id)

    const user = userEvent.setup()
    render(<TerminalTabs />)

    // Focus the close button on the active tab (tab2) so focus is inside tablist
    const closeBtn = screen.getByRole('button', { name: `Close ${tab2.title}` })
    closeBtn.focus()
    expect(document.activeElement).toBe(closeBtn)

    // Click close — triggers handleCloseTab with focus inside tablist
    await user.click(closeBtn)

    // After close, store should select tab1 (last remaining)
    expect(useTerminalStore.getState().activeTabId).toBe(tab1.id)
    expect(useTerminalStore.getState().tabs.length).toBe(1)

    // rAF fires synchronously in jsdom so focus should have moved to tab1's tab element
    await waitFor(() => {
      const tab1El = document.querySelector<HTMLElement>(`[data-tab-id="${tab1.id}"]`)
      expect(document.activeElement).toBe(tab1El)
    })
  })

  it('shows empty state with "No terminal sessions" when no tabs', async () => {
    // Patch addTab to be a no-op so bootstrap doesn't escape the empty state
    const originalAddTab = useTerminalStore.getState().addTab
    const mockAddTab = vi.fn(() => ({} as ReturnType<typeof originalAddTab>))
    useTerminalStore.setState({
      tabs: [],
      activeTabId: null,
      addTab: mockAddTab,
    })

    const { act } = await import('react')
    let rendered: ReturnType<typeof render>
    await act(async () => {
      rendered = render(<TerminalTabs />)
    })

    expect(screen.getByText('No terminal sessions')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New terminal tab' })).toBeTruthy()

    // Restore
    useTerminalStore.setState({ addTab: originalAddTab })
    rendered!.unmount()
  })
})

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

// Mock framer-motion — TerminalTabs uses AnimatePresence, motion, and useReducedMotion
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: 'div',
    span: 'span',
    ul: 'ul',
    li: 'li',
  },
  useReducedMotion: vi.fn(() => false),
}))

// Default mock: unbound (no session)
const mockUsePaneBinding = vi.fn(() => ({
  bound: false,
  sessionId: null,
  projectPath: null,
  endedAt: null,
}))

vi.mock('../../hooks/usePaneBinding', () => ({
  usePaneBinding: (paneId: string) => mockUsePaneBinding(paneId),
}))

beforeEach(() => {
  // Reset store to clean state before each test
  useTerminalStore.setState({ tabs: [], activeTabId: null })
  vi.clearAllMocks()
  // Restore default unbound behavior after clearAllMocks resets the implementation
  mockUsePaneBinding.mockReturnValue({ bound: false, sessionId: null, projectPath: null, endedAt: null })
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

  describe('TabLabel — bound state', () => {
    it('shows fallback title when unbound', () => {
      useTerminalStore.getState().addTab('~')
      mockUsePaneBinding.mockReturnValue({ bound: false, sessionId: null, projectPath: null, endedAt: null })
      render(<TerminalTabs />)
      expect(screen.getByText('~')).toBeTruthy()
    })

    it('shows projectPath basename and short sessionId when bound', () => {
      useTerminalStore.getState().addTab('~')
      mockUsePaneBinding.mockReturnValue({
        bound: true,
        sessionId: 'abcdef123456',
        projectPath: '/Users/ed/Projects/my-app',
        endedAt: null,
      })
      render(<TerminalTabs />)
      expect(screen.getByText('my-app · abcdef')).toBeTruthy()
    })

    it('falls back to tab title when bound but sessionId is null', () => {
      useTerminalStore.getState().addTab('~')
      mockUsePaneBinding.mockReturnValue({
        bound: true,
        sessionId: null,
        projectPath: '/Users/ed/Projects/my-app',
        endedAt: null,
      })
      render(<TerminalTabs />)
      expect(screen.getByText('~')).toBeTruthy()
    })

    it('falls back to tab title when bound but projectPath is null', () => {
      useTerminalStore.getState().addTab('~')
      mockUsePaneBinding.mockReturnValue({
        bound: true,
        sessionId: 'abcdef123456',
        projectPath: null,
        endedAt: null,
      })
      render(<TerminalTabs />)
      expect(screen.getByText('~')).toBeTruthy()
    })

    it('shows user-renamed title even when bound to a session', () => {
      const tab = useTerminalStore.getState().addTab('~')
      useTerminalStore.getState().updateTabTitle(tab.id, 'research')
      mockUsePaneBinding.mockReturnValue({
        bound: true,
        sessionId: 'abcdef123456',
        projectPath: '/Users/ed/Projects/my-app',
        endedAt: null,
      })
      render(<TerminalTabs />)
      // User rename takes priority over bound session label
      expect(screen.getByText('research')).toBeTruthy()
      expect(screen.queryByText('my-app · abcdef')).toBeNull()
    })
  })

  describe('rename UX — double-click', () => {
    it('double-click on tab puts it into rename mode (shows input)', () => {
      const tab = useTerminalStore.getState().addTab('~')
      render(<TerminalTabs />)

      const tabEl = document.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"]`)
      expect(tabEl).toBeTruthy()
      fireEvent.dblClick(tabEl!)

      const input = screen.getByRole('textbox', { name: 'Rename tab' })
      expect(input).toBeTruthy()
      expect((input as HTMLInputElement).value).toBe('~')
    })

    it('Enter commits the rename and updates the store', async () => {
      const tab = useTerminalStore.getState().addTab('~')
      render(<TerminalTabs />)

      const tabEl = document.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"]`)
      fireEvent.dblClick(tabEl!)

      const input = screen.getByRole('textbox', { name: 'Rename tab' })
      fireEvent.change(input, { target: { value: 'watch' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        const updated = useTerminalStore.getState().tabs.find((t) => t.id === tab.id)
        expect(updated?.title).toBe('watch')
        expect(updated?.userRenamed).toBe(true)
      })
      // Input should be gone
      expect(screen.queryByRole('textbox', { name: 'Rename tab' })).toBeNull()
    })

    it('Escape cancels rename without updating the store', async () => {
      const tab = useTerminalStore.getState().addTab('~')
      render(<TerminalTabs />)

      const tabEl = document.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"]`)
      fireEvent.dblClick(tabEl!)

      const input = screen.getByRole('textbox', { name: 'Rename tab' })
      fireEvent.change(input, { target: { value: 'scratch' } })
      fireEvent.keyDown(input, { key: 'Escape' })

      await waitFor(() => {
        expect(screen.queryByRole('textbox', { name: 'Rename tab' })).toBeNull()
      })
      const notUpdated = useTerminalStore.getState().tabs.find((t) => t.id === tab.id)
      expect(notUpdated?.title).toBe('~')
      expect(notUpdated?.userRenamed).toBe(false)
    })

    it('blur commits the rename (same as Enter)', async () => {
      const tab = useTerminalStore.getState().addTab('~')
      render(<TerminalTabs />)

      const tabEl = document.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"]`)
      fireEvent.dblClick(tabEl!)

      const input = screen.getByRole('textbox', { name: 'Rename tab' })
      fireEvent.change(input, { target: { value: 'blurred-name' } })
      fireEvent.blur(input)

      await waitFor(() => {
        const updated = useTerminalStore.getState().tabs.find((t) => t.id === tab.id)
        expect(updated?.title).toBe('blurred-name')
        expect(updated?.userRenamed).toBe(true)
      })
    })

    it('empty rename is ignored (title stays unchanged)', async () => {
      const tab = useTerminalStore.getState().addTab('~')
      render(<TerminalTabs />)

      const tabEl = document.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"]`)
      fireEvent.dblClick(tabEl!)

      const input = screen.getByRole('textbox', { name: 'Rename tab' })
      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      await waitFor(() => {
        expect(screen.queryByRole('textbox', { name: 'Rename tab' })).toBeNull()
      })
      const notUpdated = useTerminalStore.getState().tabs.find((t) => t.id === tab.id)
      expect(notUpdated?.title).toBe('~')
    })
  })

  describe('rename UX — context menu', () => {
    it('right-click shows context menu with Rename item', () => {
      const tab = useTerminalStore.getState().addTab('~')
      render(<TerminalTabs />)

      const tabEl = document.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"]`)
      fireEvent.contextMenu(tabEl!)

      expect(screen.getByRole('menu')).toBeTruthy()
      expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeTruthy()
    })

    it('clicking Rename in context menu enters rename mode', async () => {
      const tab = useTerminalStore.getState().addTab('~')
      render(<TerminalTabs />)

      const tabEl = document.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"]`)
      fireEvent.contextMenu(tabEl!)

      const renameItem = screen.getByRole('menuitem', { name: 'Rename' })
      fireEvent.click(renameItem)

      await waitFor(() => {
        expect(screen.getByRole('textbox', { name: 'Rename tab' })).toBeTruthy()
      })
    })

    it('Escape closes context menu without entering rename', () => {
      const tab = useTerminalStore.getState().addTab('~')
      render(<TerminalTabs />)

      const tabEl = document.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"]`)
      fireEvent.contextMenu(tabEl!)
      expect(screen.getByRole('menu')).toBeTruthy()

      const menu = screen.getByRole('menu')
      fireEvent.keyDown(menu, { key: 'Escape' })

      expect(screen.queryByRole('menu')).toBeNull()
      expect(screen.queryByRole('textbox', { name: 'Rename tab' })).toBeNull()
    })
  })

  describe('a11y — aria-label on tab button', () => {
    it('tab button aria-label reflects the resolved title (cwd basename)', () => {
      useTerminalStore.getState().addTab('/Users/ed/Projects/cast-desktop')
      render(<TerminalTabs />)

      const tabEls = screen.getAllByRole('tab')
      // The tab button aria-label should be 'cast-desktop' (basename of cwd)
      const tabEl = tabEls[0]
      expect(tabEl.getAttribute('aria-label')).toBe('cast-desktop')
    })

    it('tab button aria-label uses user-renamed title', () => {
      const tab = useTerminalStore.getState().addTab('~')
      useTerminalStore.getState().updateTabTitle(tab.id, 'my-label')
      render(<TerminalTabs />)

      const tabEls = screen.getAllByRole('tab')
      expect(tabEls[0].getAttribute('aria-label')).toBe('my-label')
    })

    it('rename input has aria-label="Rename tab"', () => {
      const tab = useTerminalStore.getState().addTab('~')
      render(<TerminalTabs />)

      const tabEl = document.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"]`)
      fireEvent.dblClick(tabEl!)

      const input = screen.getByLabelText('Rename tab')
      expect(input).toBeTruthy()
    })
  })

  describe('tab coloring — Wave 6', () => {
    it('... button is present in the DOM with aria-label="Tab options"', () => {
      useTerminalStore.getState().addTab('~')
      render(<TerminalTabs />)
      const moreBtn = screen.getByRole('button', { name: 'Tab options' })
      expect(moreBtn).toBeTruthy()
    })

    it('clicking ... button opens context menu', () => {
      useTerminalStore.getState().addTab('~')
      render(<TerminalTabs />)
      const moreBtn = screen.getByRole('button', { name: 'Tab options' })
      fireEvent.click(moreBtn)
      expect(screen.getByRole('menu')).toBeTruthy()
    })

    it('pressing Enter on ... button opens context menu', () => {
      useTerminalStore.getState().addTab('~')
      render(<TerminalTabs />)
      const moreBtn = screen.getByRole('button', { name: 'Tab options' })
      fireEvent.keyDown(moreBtn, { key: 'Enter' })
      expect(screen.getByRole('menu')).toBeTruthy()
    })

    it('context menu shows color swatches with correct aria-labels', () => {
      const tab = useTerminalStore.getState().addTab('~')
      render(<TerminalTabs />)
      const tabEl = document.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"]`)
      fireEvent.contextMenu(tabEl!)

      expect(screen.getByRole('menuitemradio', { name: 'Set tab color: None' })).toBeTruthy()
      expect(screen.getByRole('menuitemradio', { name: 'Set tab color: Steel' })).toBeTruthy()
      expect(screen.getByRole('menuitemradio', { name: 'Set tab color: Teal' })).toBeTruthy()
      expect(screen.getByRole('menuitemradio', { name: 'Set tab color: Violet' })).toBeTruthy()
    })

    it('clicking Steel swatch calls setTabColor with "chart-2"', () => {
      const tab = useTerminalStore.getState().addTab('~')
      render(<TerminalTabs />)
      const tabEl = document.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"]`)
      fireEvent.contextMenu(tabEl!)

      const steelSwatch = screen.getByRole('menuitemradio', { name: 'Set tab color: Steel' })
      fireEvent.click(steelSwatch)

      const updated = useTerminalStore.getState().tabs.find((t) => t.id === tab.id)
      expect(updated?.color).toBe('chart-2')
    })

    it('clicking Teal swatch sets color to "chart-3"', () => {
      const tab = useTerminalStore.getState().addTab('~')
      render(<TerminalTabs />)
      const tabEl = document.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"]`)
      fireEvent.contextMenu(tabEl!)

      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Set tab color: Teal' }))
      expect(useTerminalStore.getState().tabs.find((t) => t.id === tab.id)?.color).toBe('chart-3')
    })

    it('clicking Violet swatch sets color to "chart-4"', () => {
      const tab = useTerminalStore.getState().addTab('~')
      render(<TerminalTabs />)
      const tabEl = document.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"]`)
      fireEvent.contextMenu(tabEl!)

      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Set tab color: Violet' }))
      expect(useTerminalStore.getState().tabs.find((t) => t.id === tab.id)?.color).toBe('chart-4')
    })

    it('clicking None swatch clears color to undefined', () => {
      const tab = useTerminalStore.getState().addTab('~')
      useTerminalStore.getState().setTabColor(tab.id, 'chart-2')
      render(<TerminalTabs />)
      const tabEl = document.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"]`)
      fireEvent.contextMenu(tabEl!)

      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Set tab color: None' }))
      expect(useTerminalStore.getState().tabs.find((t) => t.id === tab.id)?.color).toBeUndefined()
    })

    it('tab with color renders left-border style containing the token variable', () => {
      const tab = useTerminalStore.getState().addTab('~')
      useTerminalStore.getState().setTabColor(tab.id, 'chart-2')
      render(<TerminalTabs />)
      const tabEl = document.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"]`)
      expect(tabEl).toBeTruthy()
      expect(tabEl!.style.borderLeft).toContain('var(--chart-2)')
    })

    it('tab without color has no borderLeft style', () => {
      const tab = useTerminalStore.getState().addTab('~')
      render(<TerminalTabs />)
      const tabEl = document.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"]`)
      expect(tabEl).toBeTruthy()
      expect(tabEl!.style.borderLeft).toBe('')
    })

    it('color persists after re-render (store update reflects in DOM)', () => {
      const tab = useTerminalStore.getState().addTab('~')
      const { rerender } = render(<TerminalTabs />)
      useTerminalStore.getState().setTabColor(tab.id, 'chart-3')
      rerender(<TerminalTabs />)
      const tabEl = document.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"]`)
      expect(tabEl!.style.borderLeft).toContain('var(--chart-3)')
    })

    it('clicking color swatch closes the context menu', () => {
      const tab = useTerminalStore.getState().addTab('~')
      render(<TerminalTabs />)
      const tabEl = document.querySelector<HTMLElement>(`[data-tab-id="${tab.id}"]`)
      fireEvent.contextMenu(tabEl!)
      expect(screen.getByRole('menu')).toBeTruthy()

      fireEvent.click(screen.getByRole('menuitemradio', { name: 'Set tab color: Steel' }))
      expect(screen.queryByRole('menu')).toBeNull()
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

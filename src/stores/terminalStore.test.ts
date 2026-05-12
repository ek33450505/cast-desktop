import { describe, it, expect, beforeEach } from 'vitest'
import { useTerminalStore } from './terminalStore'

// Reset store before each test
beforeEach(() => {
  useTerminalStore.setState({ tabs: [], activeTabId: null })
})

describe('terminalStore', () => {
  describe('addTab', () => {
    it('creates a tab with a UUID and null ptyId', () => {
      const tab = useTerminalStore.getState().addTab('~')
      expect(tab.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
      expect(tab.ptyId).toBeNull()
    })

    it('sets the new tab as activeTabId', () => {
      const tab = useTerminalStore.getState().addTab('~')
      expect(useTerminalStore.getState().activeTabId).toBe(tab.id)
    })

    it('appends to the tabs array', () => {
      useTerminalStore.getState().addTab('~')
      useTerminalStore.getState().addTab('/tmp')
      expect(useTerminalStore.getState().tabs).toHaveLength(2)
    })
  })

  describe('closeTab', () => {
    it('removes the tab from the array', () => {
      const tab = useTerminalStore.getState().addTab('~')
      useTerminalStore.getState().closeTab(tab.id)
      expect(useTerminalStore.getState().tabs).toHaveLength(0)
    })

    it('clears activeTabId when the active tab is closed', () => {
      const tab = useTerminalStore.getState().addTab('~')
      expect(useTerminalStore.getState().activeTabId).toBe(tab.id)
      useTerminalStore.getState().closeTab(tab.id)
      expect(useTerminalStore.getState().activeTabId).toBeNull()
    })

    it('activates the previous tab when a non-last tab is closed', () => {
      const tab1 = useTerminalStore.getState().addTab('~')
      const tab2 = useTerminalStore.getState().addTab('/tmp')
      useTerminalStore.getState().closeTab(tab2.id)
      expect(useTerminalStore.getState().activeTabId).toBe(tab1.id)
    })

    it('does not change activeTabId when a non-active tab is closed', () => {
      const tab1 = useTerminalStore.getState().addTab('~')
      const tab2 = useTerminalStore.getState().addTab('/tmp')
      // tab2 is active now; close tab1
      useTerminalStore.getState().closeTab(tab1.id)
      expect(useTerminalStore.getState().activeTabId).toBe(tab2.id)
    })
  })

  describe('setActiveTab', () => {
    it('updates activeTabId', () => {
      const tab1 = useTerminalStore.getState().addTab('~')
      const tab2 = useTerminalStore.getState().addTab('/tmp')
      useTerminalStore.getState().setActiveTab(tab1.id)
      expect(useTerminalStore.getState().activeTabId).toBe(tab1.id)
      useTerminalStore.getState().setActiveTab(tab2.id)
      expect(useTerminalStore.getState().activeTabId).toBe(tab2.id)
    })
  })

  describe('setTabPtyId', () => {
    it('updates the ptyId of the matching tab', () => {
      const tab = useTerminalStore.getState().addTab('~')
      useTerminalStore.getState().setTabPtyId(tab.id, 'abc-123')
      const updated = useTerminalStore.getState().tabs.find((t) => t.id === tab.id)
      expect(updated?.ptyId).toBe('abc-123')
    })

    it('does not mutate other tabs', () => {
      const tab1 = useTerminalStore.getState().addTab('~')
      const tab2 = useTerminalStore.getState().addTab('/tmp')
      useTerminalStore.getState().setTabPtyId(tab1.id, 'abc-123')
      const other = useTerminalStore.getState().tabs.find((t) => t.id === tab2.id)
      expect(other?.ptyId).toBeNull()
    })
  })

  describe('updateTabTitle', () => {
    it('updates the title of the matching tab', () => {
      const tab = useTerminalStore.getState().addTab('~')
      useTerminalStore.getState().updateTabTitle(tab.id, 'my-project')
      const updated = useTerminalStore.getState().tabs.find((t) => t.id === tab.id)
      expect(updated?.title).toBe('my-project')
    })

    it('does not mutate other tabs', () => {
      const tab1 = useTerminalStore.getState().addTab('~')
      const originalTitle1 = useTerminalStore.getState().tabs.find((t) => t.id === tab1.id)?.title
      const tab2 = useTerminalStore.getState().addTab('/tmp')
      useTerminalStore.getState().updateTabTitle(tab2.id, 'changed')
      const tab1AfterUpdate = useTerminalStore.getState().tabs.find((t) => t.id === tab1.id)
      expect(tab1AfterUpdate?.title).toBe(originalTitle1)
    })
  })
})

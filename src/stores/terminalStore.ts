import { create } from 'zustand'

export type TabColor = 'chart-2' | 'chart-3' | 'chart-4'

export interface Tab {
  id: string
  ptyId: string | null
  paneId: string
  cwd: string
  title: string
  // userRenamed: true when the user has explicitly renamed this tab.
  // When true, the resolved display title always uses `title` (even if the tab
  // later becomes bound to a session). Future wave: persist to localStorage.
  userRenamed: boolean
  // color: optional left-border accent color token. undefined = no color accent.
  color?: TabColor
}

interface TerminalState {
  tabs: Tab[]
  activeTabId: string | null
  addTab: (cwd: string, paneId?: string) => Tab
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  setTabPtyId: (id: string, ptyId: string) => void
  setTabPaneId: (id: string, paneId: string) => void
  // updateTabTitle: user-intent rename — sets userRenamed=true by default.
  // Pass userRenamed=false only for programmatic (non-user) updates.
  updateTabTitle: (id: string, title: string, userRenamed?: boolean) => void
  // setAutoTitle: internal auto-title update, never flips userRenamed.
  setAutoTitle: (id: string, title: string) => void
  // setTabColor: sets the left-border accent color token. Pass undefined to clear.
  setTabColor: (id: string, color: TabColor | undefined) => void
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (cwd: string, paneId?: string) => {
    const id = crypto.randomUUID()
    const tabCount = get().tabs.length + 1
    const title = cwd ? cwd.split('/').filter(Boolean).pop() ?? 'Terminal' : `Terminal ${tabCount}`
    const tab: Tab = { id, ptyId: null, paneId: paneId ?? crypto.randomUUID(), cwd, title, userRenamed: false }
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: id,
    }))
    return tab
  },

  closeTab: (id: string) => {
    set((state) => {
      const remaining = state.tabs.filter((t) => t.id !== id)
      let nextActiveId = state.activeTabId
      if (state.activeTabId === id) {
        nextActiveId = remaining.length > 0 ? (remaining[remaining.length - 1].id) : null
      }
      return { tabs: remaining, activeTabId: nextActiveId }
    })
  },

  setActiveTab: (id: string) => {
    set({ activeTabId: id })
  },

  setTabPtyId: (id: string, ptyId: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, ptyId } : t)),
    }))
  },

  setTabPaneId: (id: string, paneId: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, paneId } : t)),
    }))
  },

  updateTabTitle: (id: string, title: string, userRenamed = true) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === id ? { ...t, title, userRenamed } : t,
      ),
    }))
  },

  setAutoTitle: (id: string, title: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) =>
        // Never overwrite a user-renamed tab with an auto-title
        t.id === id && !t.userRenamed ? { ...t, title } : t,
      ),
    }))
  },

  setTabColor: (id: string, color: TabColor | undefined) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, color } : t)),
    }))
  },
}))

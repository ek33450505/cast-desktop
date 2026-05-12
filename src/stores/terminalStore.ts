import { create } from 'zustand'

export interface Tab {
  id: string
  ptyId: string | null
  paneId: string
  cwd: string
  title: string
}

interface TerminalState {
  tabs: Tab[]
  activeTabId: string | null
  addTab: (cwd: string, paneId?: string) => Tab
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  setTabPtyId: (id: string, ptyId: string) => void
  setTabPaneId: (id: string, paneId: string) => void
  updateTabTitle: (id: string, title: string) => void
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (cwd: string, paneId?: string) => {
    const id = crypto.randomUUID()
    const tabCount = get().tabs.length + 1
    const title = cwd ? cwd.split('/').filter(Boolean).pop() ?? 'Terminal' : `Terminal ${tabCount}`
    const tab: Tab = { id, ptyId: null, paneId: paneId ?? crypto.randomUUID(), cwd, title }
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

  updateTabTitle: (id: string, title: string) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, title } : t)),
    }))
  },
}))

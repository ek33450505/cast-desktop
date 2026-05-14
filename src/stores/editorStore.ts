import { create } from 'zustand'

// ── Language detection by file extension ──────────────────────────────────────
export type EditorLanguage = 'javascript' | 'json' | 'markdown' | 'text'

export function detectLanguage(path: string): EditorLanguage {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  if (['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'].includes(ext)) return 'javascript'
  if (ext === 'json') return 'json'
  if (['md', 'mdx', 'markdown'].includes(ext)) return 'markdown'
  return 'text'
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface EditorFile {
  path: string
  content: string
  language: EditorLanguage
}

interface EditorState {
  openFiles: EditorFile[]
  activeFilePath: string | null
  bottomDockExpanded: boolean

  // Actions
  openFile: (path: string, content: string) => void
  closeFile: (path: string) => void
  setActive: (path: string) => void
  setBottomDockExpanded: (expanded: boolean) => void
}

export const useEditorStore = create<EditorState>((set, get) => ({
  openFiles: [],
  activeFilePath: null,
  bottomDockExpanded: false,

  openFile: (path: string, content: string) => {
    const existing = get().openFiles.find((f) => f.path === path)
    if (existing) {
      // Deduplicate — just bring it to focus
      set({ activeFilePath: path })
      return
    }
    const file: EditorFile = { path, content, language: detectLanguage(path) }
    set((state) => ({
      openFiles: [...state.openFiles, file],
      activeFilePath: path,
    }))
  },

  closeFile: (path: string) => {
    set((state) => {
      const remaining = state.openFiles.filter((f) => f.path !== path)
      let nextActive = state.activeFilePath
      if (state.activeFilePath === path) {
        nextActive = remaining.length > 0 ? (remaining[remaining.length - 1].path) : null
      }
      return { openFiles: remaining, activeFilePath: nextActive }
    })
  },

  setActive: (path: string) => {
    set({ activeFilePath: path })
  },

  setBottomDockExpanded: (expanded: boolean) => {
    set({ bottomDockExpanded: expanded })
  },
}))

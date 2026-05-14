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
  /** Paths with unsaved edits */
  dirty: Set<string>
  /** Original content at last open/save, for computing dirty state */
  originalContent: Map<string, string>

  // Actions
  openFile: (path: string, content: string) => void
  closeFile: (path: string) => void
  setActive: (path: string) => void
  setBottomDockExpanded: (expanded: boolean) => void
  /** Update content in memory; marks dirty if different from original */
  updateContent: (path: string, newContent: string) => void
  markClean: (path: string) => void
  /** Write file to disk via Tauri fs, then markClean */
  save: (path: string) => Promise<void>
  /** Write to newPath, close old tab, open new one at newPath */
  saveAs: (currentPath: string, newPath: string) => Promise<void>
}

export const useEditorStore = create<EditorState>((set, get) => ({
  openFiles: [],
  activeFilePath: null,
  bottomDockExpanded: false,
  dirty: new Set<string>(),
  originalContent: new Map<string, string>(),

  openFile: (path: string, content: string) => {
    const existing = get().openFiles.find((f) => f.path === path)
    if (existing) {
      // Deduplicate — just bring it to focus
      set({ activeFilePath: path })
      return
    }
    const file: EditorFile = { path, content, language: detectLanguage(path) }
    set((state) => {
      const nextOriginal = new Map(state.originalContent)
      nextOriginal.set(path, content)
      return {
        openFiles: [...state.openFiles, file],
        activeFilePath: path,
        originalContent: nextOriginal,
      }
    })
  },

  closeFile: (path: string) => {
    set((state) => {
      const remaining = state.openFiles.filter((f) => f.path !== path)
      let nextActive = state.activeFilePath
      if (state.activeFilePath === path) {
        nextActive = remaining.length > 0 ? (remaining[remaining.length - 1].path) : null
      }
      const nextDirty = new Set(state.dirty)
      nextDirty.delete(path)
      const nextOriginal = new Map(state.originalContent)
      nextOriginal.delete(path)
      return { openFiles: remaining, activeFilePath: nextActive, dirty: nextDirty, originalContent: nextOriginal }
    })
  },

  setActive: (path: string) => {
    set({ activeFilePath: path })
  },

  setBottomDockExpanded: (expanded: boolean) => {
    set({ bottomDockExpanded: expanded })
  },

  updateContent: (path: string, newContent: string) => {
    set((state) => {
      const nextFiles = state.openFiles.map((f) =>
        f.path === path ? { ...f, content: newContent } : f,
      )
      const original = state.originalContent.get(path) ?? ''
      const nextDirty = new Set(state.dirty)
      if (newContent !== original) {
        nextDirty.add(path)
      } else {
        nextDirty.delete(path)
      }
      return { openFiles: nextFiles, dirty: nextDirty }
    })
  },

  markClean: (path: string) => {
    set((state) => {
      const nextDirty = new Set(state.dirty)
      nextDirty.delete(path)
      return { dirty: nextDirty }
    })
  },

  save: async (path: string) => {
    const { openFiles, originalContent } = get()
    const file = openFiles.find((f) => f.path === path)
    if (!file) return

    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(path, file.content)

    // Update originalContent and mark clean
    set((state) => {
      const nextDirty = new Set(state.dirty)
      nextDirty.delete(path)
      const nextOriginal = new Map(state.originalContent)
      nextOriginal.set(path, file.content)
      return { dirty: nextDirty, originalContent: nextOriginal }
    })
    void originalContent // suppress unused warning
  },

  saveAs: async (currentPath: string, newPath: string) => {
    const { openFiles } = get()
    const file = openFiles.find((f) => f.path === currentPath)
    if (!file) return

    const { writeTextFile } = await import('@tauri-apps/plugin-fs')
    await writeTextFile(newPath, file.content)

    // Replace old tab with new path
    set((state) => {
      const nextFiles = state.openFiles.map((f) =>
        f.path === currentPath
          ? { ...f, path: newPath, language: detectLanguage(newPath) }
          : f,
      )
      const nextDirty = new Set(state.dirty)
      nextDirty.delete(currentPath)
      nextDirty.delete(newPath)
      const nextOriginal = new Map(state.originalContent)
      nextOriginal.delete(currentPath)
      nextOriginal.set(newPath, file.content)
      const nextActive = state.activeFilePath === currentPath ? newPath : state.activeFilePath
      return {
        openFiles: nextFiles,
        activeFilePath: nextActive,
        dirty: nextDirty,
        originalContent: nextOriginal,
      }
    })
  },
}))

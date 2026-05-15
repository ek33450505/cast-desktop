import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useEditorStore, detectLanguage } from './editorStore'

// Mock Tauri fs plugin
vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn().mockResolvedValue(undefined),
}))

// Reset store state before each test
beforeEach(() => {
  useEditorStore.setState({
    openFiles: [],
    activeFilePath: null,
    bottomDockExpanded: false,
    dirty: new Set<string>(),
    originalContent: new Map<string, string>(),
    externalChange: new Map<string, string>(),
  })
  vi.clearAllMocks()
})

describe('detectLanguage', () => {
  it('detects TypeScript extensions', () => {
    expect(detectLanguage('/foo/bar.ts')).toBe('javascript')
    expect(detectLanguage('/foo/bar.tsx')).toBe('javascript')
  })
  it('detects JavaScript extensions', () => {
    expect(detectLanguage('/foo/bar.js')).toBe('javascript')
    expect(detectLanguage('/foo/bar.jsx')).toBe('javascript')
  })
  it('detects JSON', () => {
    expect(detectLanguage('/foo/bar.json')).toBe('json')
  })
  it('detects Markdown', () => {
    expect(detectLanguage('/foo/bar.md')).toBe('markdown')
    expect(detectLanguage('/foo/bar.mdx')).toBe('markdown')
  })
  it('defaults to text for unknown extensions', () => {
    expect(detectLanguage('/foo/bar.sh')).toBe('text')
    expect(detectLanguage('/foo/bar')).toBe('text')
  })
})

describe('editorStore', () => {
  describe('openFile', () => {
    it('adds a new file and sets it active', () => {
      const store = useEditorStore.getState()
      store.openFile('/foo/bar.ts', 'const x = 1')
      const s = useEditorStore.getState()
      expect(s.openFiles).toHaveLength(1)
      expect(s.openFiles[0].path).toBe('/foo/bar.ts')
      expect(s.openFiles[0].language).toBe('javascript')
      expect(s.activeFilePath).toBe('/foo/bar.ts')
    })

    it('stores originalContent when opening a file', () => {
      useEditorStore.getState().openFile('/foo/bar.ts', 'original text')
      const s = useEditorStore.getState()
      expect(s.originalContent.get('/foo/bar.ts')).toBe('original text')
    })

    it('deduplicates — opening same path twice does not add a second entry', () => {
      const store = useEditorStore.getState()
      store.openFile('/foo/bar.ts', 'content')
      store.openFile('/foo/bar.ts', 'content')
      expect(useEditorStore.getState().openFiles).toHaveLength(1)
    })

    it('switching to duplicate path updates activeFilePath', () => {
      const store = useEditorStore.getState()
      store.openFile('/foo/a.ts', 'a')
      store.openFile('/foo/b.ts', 'b')
      // active is now b; re-open a
      store.openFile('/foo/a.ts', 'a')
      expect(useEditorStore.getState().activeFilePath).toBe('/foo/a.ts')
    })

    it('adds multiple distinct files', () => {
      const store = useEditorStore.getState()
      store.openFile('/foo/a.ts', 'a')
      store.openFile('/foo/b.json', 'b')
      const s = useEditorStore.getState()
      expect(s.openFiles).toHaveLength(2)
      expect(s.openFiles[1].language).toBe('json')
    })
  })

  describe('closeFile', () => {
    it('removes the file from the list', () => {
      const store = useEditorStore.getState()
      store.openFile('/foo/a.ts', 'a')
      store.closeFile('/foo/a.ts')
      expect(useEditorStore.getState().openFiles).toHaveLength(0)
    })

    it('sets active to previous file when closing active', () => {
      const store = useEditorStore.getState()
      store.openFile('/foo/a.ts', 'a')
      store.openFile('/foo/b.ts', 'b')
      store.closeFile('/foo/b.ts')
      expect(useEditorStore.getState().activeFilePath).toBe('/foo/a.ts')
    })

    it('sets active to null when last file is closed', () => {
      const store = useEditorStore.getState()
      store.openFile('/foo/a.ts', 'a')
      store.closeFile('/foo/a.ts')
      expect(useEditorStore.getState().activeFilePath).toBeNull()
    })

    it('preserves active when closing a non-active file', () => {
      const store = useEditorStore.getState()
      store.openFile('/foo/a.ts', 'a')
      store.openFile('/foo/b.ts', 'b')
      store.closeFile('/foo/a.ts')
      expect(useEditorStore.getState().activeFilePath).toBe('/foo/b.ts')
    })

    it('clears dirty and originalContent for closed file', () => {
      const store = useEditorStore.getState()
      store.openFile('/foo/a.ts', 'a')
      store.updateContent('/foo/a.ts', 'changed')
      store.closeFile('/foo/a.ts')
      const s = useEditorStore.getState()
      expect(s.dirty.has('/foo/a.ts')).toBe(false)
      expect(s.originalContent.has('/foo/a.ts')).toBe(false)
    })
  })

  describe('setActive', () => {
    it('updates activeFilePath', () => {
      const store = useEditorStore.getState()
      store.openFile('/foo/a.ts', 'a')
      store.openFile('/foo/b.ts', 'b')
      store.setActive('/foo/a.ts')
      expect(useEditorStore.getState().activeFilePath).toBe('/foo/a.ts')
    })
  })

  describe('setBottomDockExpanded', () => {
    it('toggles dock state', () => {
      const store = useEditorStore.getState()
      expect(store.bottomDockExpanded).toBe(false)
      store.setBottomDockExpanded(true)
      expect(useEditorStore.getState().bottomDockExpanded).toBe(true)
    })
  })

  describe('updateContent', () => {
    it('marks file dirty when content differs from original', () => {
      const store = useEditorStore.getState()
      store.openFile('/foo/a.ts', 'original')
      store.updateContent('/foo/a.ts', 'changed')
      expect(useEditorStore.getState().dirty.has('/foo/a.ts')).toBe(true)
    })

    it('marks file clean when content matches original', () => {
      const store = useEditorStore.getState()
      store.openFile('/foo/a.ts', 'original')
      store.updateContent('/foo/a.ts', 'changed')
      store.updateContent('/foo/a.ts', 'original')
      expect(useEditorStore.getState().dirty.has('/foo/a.ts')).toBe(false)
    })

    it('updates openFiles content in place', () => {
      const store = useEditorStore.getState()
      store.openFile('/foo/a.ts', 'original')
      store.updateContent('/foo/a.ts', 'new content')
      const file = useEditorStore.getState().openFiles.find((f) => f.path === '/foo/a.ts')
      expect(file?.content).toBe('new content')
    })
  })

  describe('markClean', () => {
    it('removes path from dirty set', () => {
      const store = useEditorStore.getState()
      store.openFile('/foo/a.ts', 'x')
      store.updateContent('/foo/a.ts', 'changed')
      store.markClean('/foo/a.ts')
      expect(useEditorStore.getState().dirty.has('/foo/a.ts')).toBe(false)
    })
  })

  describe('save', () => {
    it('calls writeTextFile with correct path and content', async () => {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')
      const store = useEditorStore.getState()
      store.openFile('/foo/a.ts', 'original')
      store.updateContent('/foo/a.ts', 'edited')
      await store.save('/foo/a.ts')
      expect(writeTextFile).toHaveBeenCalledWith('/foo/a.ts', 'edited')
    })

    it('marks file clean after successful save', async () => {
      const store = useEditorStore.getState()
      store.openFile('/foo/a.ts', 'original')
      store.updateContent('/foo/a.ts', 'edited')
      await store.save('/foo/a.ts')
      expect(useEditorStore.getState().dirty.has('/foo/a.ts')).toBe(false)
    })

    it('updates originalContent after save', async () => {
      const store = useEditorStore.getState()
      store.openFile('/foo/a.ts', 'original')
      store.updateContent('/foo/a.ts', 'edited')
      await store.save('/foo/a.ts')
      expect(useEditorStore.getState().originalContent.get('/foo/a.ts')).toBe('edited')
    })

    it('throws when writeTextFile fails', async () => {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')
      vi.mocked(writeTextFile).mockRejectedValueOnce(new Error('disk full'))
      const store = useEditorStore.getState()
      store.openFile('/foo/a.ts', 'x')
      await expect(store.save('/foo/a.ts')).rejects.toThrow('disk full')
    })

    it('is a no-op when path is not in openFiles', async () => {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')
      await useEditorStore.getState().save('/does/not/exist.ts')
      expect(writeTextFile).not.toHaveBeenCalled()
    })
  })

  describe('saveAs', () => {
    it('writes to new path', async () => {
      const { writeTextFile } = await import('@tauri-apps/plugin-fs')
      const store = useEditorStore.getState()
      store.openFile('/foo/a.ts', 'content')
      await store.saveAs('/foo/a.ts', '/bar/b.ts')
      expect(writeTextFile).toHaveBeenCalledWith('/bar/b.ts', 'content')
    })

    it('replaces old path with new path in openFiles', async () => {
      const store = useEditorStore.getState()
      store.openFile('/foo/a.ts', 'content')
      await store.saveAs('/foo/a.ts', '/bar/b.ts')
      const s = useEditorStore.getState()
      expect(s.openFiles.some((f) => f.path === '/foo/a.ts')).toBe(false)
      expect(s.openFiles.some((f) => f.path === '/bar/b.ts')).toBe(true)
    })

    it('updates activeFilePath when active tab is renamed', async () => {
      const store = useEditorStore.getState()
      store.openFile('/foo/a.ts', 'content')
      await store.saveAs('/foo/a.ts', '/bar/b.ts')
      expect(useEditorStore.getState().activeFilePath).toBe('/bar/b.ts')
    })

    it('detects language from new path extension', async () => {
      const store = useEditorStore.getState()
      store.openFile('/foo/a.ts', 'content')
      await store.saveAs('/foo/a.ts', '/bar/b.json')
      const file = useEditorStore.getState().openFiles.find((f) => f.path === '/bar/b.json')
      expect(file?.language).toBe('json')
    })

    it('marks new path as clean after saveAs', async () => {
      const store = useEditorStore.getState()
      store.openFile('/foo/a.ts', 'x')
      store.updateContent('/foo/a.ts', 'changed')
      await store.saveAs('/foo/a.ts', '/bar/b.ts')
      expect(useEditorStore.getState().dirty.has('/bar/b.ts')).toBe(false)
      expect(useEditorStore.getState().dirty.has('/foo/a.ts')).toBe(false)
    })
  })
})

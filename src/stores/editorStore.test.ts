import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore, detectLanguage } from './editorStore'

// Reset store state before each test
beforeEach(() => {
  useEditorStore.setState({ openFiles: [], activeFilePath: null, bottomDockExpanded: false })
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
})

/**
 * EditorShellLayout — three-zone IDE-style layout.
 *
 * Zone layout (horizontal): left file tree | center editor | (no right rail)
 * Bottom dock: terminal panel, collapsed by default, click to expand.
 *
 * Terminal session persistence note:
 * The bottom dock mounts a fresh <TerminalTabs /> instance. This means xterm
 * screen buffers are NOT preserved when navigating / ↔ /editor. The PTY
 * processes survive in cast-server (TerminalPane never kills on unmount), and
 * the tab list + cwds persist in terminalStore. Full xterm session persistence
 * would require a React portal approach (lift TerminalTabs to app root and
 * teleport into target DOM node) — deferred to IDE-2.
 *
 * react-resizable-panels is already in package.json per stack-context.md.
 */

import { useCallback, useEffect } from 'react'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { TerminalTabs } from '../../components/terminal/TerminalTabs'
import { ProjectFileTree } from './ProjectFileTree'
import { EditorTabs } from './EditorTabs'
import { CodeEditor } from './CodeEditor'
import { useEditorStore } from '../../stores/editorStore'
import { useTerminalStore } from '../../stores/terminalStore'

// ── EditorShellLayout ─────────────────────────────────────────────────────────

export function EditorShellLayout() {
  const bottomDockExpanded = useEditorStore((s) => s.bottomDockExpanded)
  const setBottomDockExpanded = useEditorStore((s) => s.setBottomDockExpanded)
  const openFile = useEditorStore((s) => s.openFile)
  const activeFilePath = useEditorStore((s) => s.activeFilePath)
  const save = useEditorStore((s) => s.save)
  const saveAs = useEditorStore((s) => s.saveAs)

  // Route-change guard for dirty files is TODO(IDE-3) — react-router-dom's
  // useBlocker requires a DataRouter (createBrowserRouter); the app currently
  // uses BrowserRouter. Router migration is out of scope for IDE-2.
  // Tab-close guard (in EditorTabs) still applies for dirty close.

  // Root path from active terminal tab's cwd, falling back to home
  const activeTabId = useTerminalStore((s) => s.activeTabId)
  const tabs = useTerminalStore((s) => s.tabs)
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const rootPath = activeTab?.cwd || '~'

  const handleOpenFile = useCallback(
    async (path: string) => {
      // Read file content via Tauri fs — graceful error on failure
      try {
        const { readTextFile } = await import('@tauri-apps/plugin-fs')
        const content = await readTextFile(path)
        openFile(path, content)
      } catch (err) {
        console.error('[EditorShellLayout] failed to read file', path, err)
        // Still open the tab with a placeholder so the user sees it's selected
        openFile(path, `// Could not read file: ${String(err)}`)
      }
    },
    [openFile],
  )

  const toggleDock = useCallback(() => {
    setBottomDockExpanded(!bottomDockExpanded)
  }, [bottomDockExpanded, setBottomDockExpanded])

  // ── Cmd+S — Save ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const metaOrCtrl = isMac ? e.metaKey : e.ctrlKey

      if (!metaOrCtrl || e.key !== 's') return

      // Don't intercept Cmd+Shift+S here (saveAs handles it separately)
      if (e.shiftKey) {
        e.preventDefault()
        if (!activeFilePath) return
        try {
          const { save: dialogSave } = await import('@tauri-apps/plugin-dialog')
          const newPath = await dialogSave({ defaultPath: activeFilePath })
          if (typeof newPath === 'string' && newPath) {
            await saveAs(activeFilePath, newPath)
            const filename = newPath.split('/').pop() ?? newPath
            toast.success(`Saved as ${filename}`)
          }
          // If user cancelled, newPath is null — do nothing silently
        } catch (err) {
          toast.error(`Save As failed: ${String(err)}`)
        }
        return
      }

      e.preventDefault()
      if (!activeFilePath) return

      try {
        await save(activeFilePath)
        const filename = activeFilePath.split('/').pop() ?? activeFilePath
        toast.success(`Saved ${filename}`)
      } catch (err) {
        toast.error(`Save failed: ${String(err)}`)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeFilePath, save, saveAs])

  const DOCK_HEADER_H = 40

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: 'var(--system-canvas)' }}
    >
      {/* ── Main area: horizontal panels ── */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <PanelGroup orientation="horizontal" style={{ flex: 1, minHeight: 0 }}>
          {/* ── Left: Project file tree ── */}
          <Panel
            defaultSize={20}
            minSize={12}
            maxSize={40}
            style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
          >
            <div
              style={{
                height: '100%',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                borderRight: '1px solid var(--stroke-regular)',
                background: 'var(--cast-rail-bg, var(--bg-secondary))',
              }}
            >
              {/* File tree header */}
              <div
                style={{
                  padding: '8px 8px 6px',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--text-muted)',
                  borderBottom: '1px solid var(--cast-rail-border)',
                  flexShrink: 0,
                  userSelect: 'none',
                }}
              >
                Explorer
              </div>
              <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                <ProjectFileTree rootPath={rootPath} onOpenFile={handleOpenFile} />
              </div>
            </div>
          </Panel>

          <PanelResizeHandle
            aria-label="Resize file tree"
            style={{
              width: 4,
              background: 'var(--stroke-regular)',
              cursor: 'col-resize',
              transition: 'background 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--cast-accent)'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--stroke-regular)'
            }}
          />

          {/* ── Center: Editor tabs + CodeMirror ── */}
          <Panel style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <EditorTabs />
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <CodeEditor />
              </div>
            </div>
          </Panel>
        </PanelGroup>

        {/* ── Bottom: Terminal dock ── */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            borderTop: '1px solid var(--stroke-regular)',
            background: 'var(--cast-center-bg)',
          }}
        >
          {/* Dock header bar — always visible */}
          <div
            style={{
              height: DOCK_HEADER_H,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: 12,
              paddingRight: 8,
              flexShrink: 0,
              borderBottom: bottomDockExpanded ? '1px solid var(--stroke-regular)' : undefined,
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-muted)',
                userSelect: 'none',
              }}
            >
              Terminal
            </span>

            <button
              onClick={toggleDock}
              aria-label={bottomDockExpanded ? 'Collapse terminal' : 'Expand terminal'}
              aria-expanded={bottomDockExpanded}
              aria-controls="editor-terminal-dock"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                border: 'none',
                borderRadius: 4,
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                outline: 'none',
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--cast-accent)'
                e.currentTarget.style.outlineOffset = '-2px'
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-muted)'
              }}
            >
              {bottomDockExpanded
                ? <ChevronDown size={14} aria-hidden="true" />
                : <ChevronUp size={14} aria-hidden="true" />
              }
            </button>
          </div>

          {/* Terminal panel — shown when expanded */}
          <div
            id="editor-terminal-dock"
            role="region"
            aria-label="Terminal"
            style={{
              height: bottomDockExpanded ? '30vh' : 0,
              overflow: 'hidden',
              transition: 'height 0.2s ease',
            }}
          >
            {bottomDockExpanded && <TerminalTabs />}
          </div>
        </div>
      </div>
    </div>
  )
}

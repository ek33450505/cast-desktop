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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, Home, Menu, PanelLeftClose, PanelLeft, Search, FolderOpen } from 'lucide-react'
import { useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { TerminalTabs } from '../../components/terminal/TerminalTabs'
import CommandPalette from '../../components/CommandPalette'
import { ProjectFileTree } from './ProjectFileTree'
import { EditorTabs } from './EditorTabs'
import { CodeEditor } from './CodeEditor'
import { DispatchModal } from './DispatchModal'
import type { DispatchAgent } from './DispatchModal'
import { AgentRunStatusPanel } from './AgentRunStatusPanel'
import { useEditorStore } from '../../stores/editorStore'
import { useTerminalStore } from '../../stores/terminalStore'
import { useFileWatch } from '../hooks/useFileWatch'
import { NAV_ITEMS } from '../lib/navItems'

// ── EditorShellLayout ─────────────────────────────────────────────────────────

export function EditorShellLayout() {
  const bottomDockExpanded = useEditorStore((s) => s.bottomDockExpanded)
  const setBottomDockExpanded = useEditorStore((s) => s.setBottomDockExpanded)
  const openFile = useEditorStore((s) => s.openFile)
  const openFiles = useEditorStore((s) => s.openFiles)
  const activeFilePath = useEditorStore((s) => s.activeFilePath)
  const activeSelection = useEditorStore((s) => s.activeSelection)
  const dirty = useEditorStore((s) => s.dirty)
  const externalChange = useEditorStore((s) => s.externalChange)
  const handleExternalChange = useEditorStore((s) => s.handleExternalChange)
  const acceptExternalChange = useEditorStore((s) => s.acceptExternalChange)
  const dismissExternalChange = useEditorStore((s) => s.dismissExternalChange)
  const save = useEditorStore((s) => s.save)
  const saveAs = useEditorStore((s) => s.saveAs)
  const shouldReduceMotion = useReducedMotion()

  const navigate = useNavigate()

  // ── IDE-5: Dispatch modal + status panel ─────────────────────────────────────
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false)
  const [activeRun, setActiveRun] = useState<{ run_id: string; agent: DispatchAgent } | null>(null)

  // ── Hotfix: command palette + collapsible Explorer sidebar ───────────────────
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [explorerOpen, setExplorerOpen] = useState(true)
  const [navMenuOpen, setNavMenuOpen] = useState(false)
  const navMenuRef = useRef<HTMLDivElement>(null)
  const EXPLORER_WIDTH = 240
  const EXPLORER_COLLAPSED = 36

  // Stable list of open paths for useFileWatch
  const openPaths = useMemo(() => openFiles.map((f) => f.path), [openFiles])

  // Route-change guard for dirty files is TODO(IDE-3) — react-router-dom's
  // useBlocker requires a DataRouter (createBrowserRouter); the app currently
  // uses BrowserRouter. Router migration is out of scope for IDE-2.
  // Tab-close guard (in EditorTabs) still applies for dirty close.

  // Root path resolution: explicit editor workspace root takes precedence,
  // then the active terminal cwd, then '~'. This means the user can open a
  // project in /editor without ever launching a terminal.
  const workspaceRoot = useEditorStore((s) => s.workspaceRoot)
  const setWorkspaceRoot = useEditorStore((s) => s.setWorkspaceRoot)
  const activeTabId = useTerminalStore((s) => s.activeTabId)
  const tabs = useTerminalStore((s) => s.tabs)
  const activeTab = tabs.find((t) => t.id === activeTabId)
  const rootPath = workspaceRoot ?? activeTab?.cwd ?? '~'

  const handleOpenWorkspace = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const picked = await open({ directory: true, multiple: false })
      if (typeof picked === 'string' && picked) {
        setWorkspaceRoot(picked)
      }
    } catch (err) {
      toast.error(`Could not open folder: ${String(err)}`)
    }
  }, [setWorkspaceRoot])

  // ── IDE-3: External file watch ───────────────────────────────────────────────
  const handleExternalFileChange = useCallback(
    async (changedPath: string) => {
      try {
        const { readTextFile } = await import('@tauri-apps/plugin-fs')
        const newContent = await readTextFile(changedPath)
        handleExternalChange(changedPath, newContent)
      } catch (err) {
        console.warn('[EditorShellLayout] external change read failed', changedPath, err)
      }
    },
    [handleExternalChange],
  )

  useFileWatch({
    paths: openPaths,
    onChange: handleExternalFileChange,
  })

  // ── Nav menu: click-outside + Escape close ───────────────────────────────────
  useEffect(() => {
    if (!navMenuOpen) return
    const onMouseDown = (e: MouseEvent) => {
      if (navMenuRef.current && !navMenuRef.current.contains(e.target as Node)) {
        setNavMenuOpen(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavMenuOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [navMenuOpen])

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

  // ── cast:open-folder / cast:save-file — native menu (Phase C) ───────────────
  useEffect(() => {
    const onOpenFolder = () => handleOpenWorkspace()
    const onSaveFile = async () => {
      if (!activeFilePath) return
      try {
        await save(activeFilePath)
        const filename = activeFilePath.split('/').pop() ?? activeFilePath
        toast.success(`Saved ${filename}`)
      } catch (err) {
        toast.error(`Save failed: ${String(err)}`)
      }
    }
    window.addEventListener('cast:open-folder', onOpenFolder)
    window.addEventListener('cast:save-file', onSaveFile)
    return () => {
      window.removeEventListener('cast:open-folder', onOpenFolder)
      window.removeEventListener('cast:save-file', onSaveFile)
    }
  }, [activeFilePath, handleOpenWorkspace, save])

  // ── Cmd+S / Cmd+Shift+S / Cmd+Shift+A ───────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const metaOrCtrl = isMac ? e.metaKey : e.ctrlKey

      if (!metaOrCtrl) return

      // ── Cmd+Shift+A — Dispatch agent ──────────────────────────────────────
      if (e.shiftKey && e.key === 'a') {
        e.preventDefault()
        setDispatchModalOpen(true)
        return
      }

      // ── Cmd+Shift+S — Save As ─────────────────────────────────────────────
      if (e.shiftKey && e.key === 's') {
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
        } catch (err) {
          toast.error(`Save As failed: ${String(err)}`)
        }
        return
      }

      // ── Cmd+K — Command palette (not bound by ShellLayout here since /editor
      // renders outside ShellLayout)
      if (!e.shiftKey && e.key === 'k') {
        e.preventDefault()
        setPaletteOpen((open) => !open)
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
      {/* ── Main area: fixed sidebar + flex center ── */}
      {/* Switched from react-resizable-panels (percentage-only minSize couldn't
        * enforce a pixel floor on narrow windows — sidebar collapsed below readability)
        * to a fixed-pixel sidebar with a collapse toggle. Resize-by-drag may
        * return in a polish wave. */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'row' }}>
          {/* ── Left: Project file tree (fixed-px, collapsible) ── */}
          <aside
            aria-label="Project sidebar"
            style={{
              width: explorerOpen ? EXPLORER_WIDTH : EXPLORER_COLLAPSED,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              borderRight: '1px solid var(--stroke-regular)',
              background: 'var(--cast-rail-bg, var(--bg-secondary))',
              transition: shouldReduceMotion ? 'none' : 'width 0.18s ease',
            }}
          >
            {/* Sidebar header — buttons stack vertically when collapsed so all three
              * stay visible at the narrow width (36px is too tight for a row). */}
            <div
              style={{
                display: 'flex',
                flexDirection: explorerOpen ? 'row' : 'column',
                alignItems: 'center',
                gap: 2,
                padding: '4px 4px',
                borderBottom: '1px solid var(--cast-rail-border)',
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => navigate('/')}
                aria-label="Back to Cast home"
                title="Back to Cast home"
                style={iconButtonStyle}
                onFocus={iconButtonFocus}
                onBlur={iconButtonBlur}
              >
                <Home size={14} aria-hidden="true" />
              </button>
              {/* Nav menu — relative wrapper anchors the absolute popover */}
              <div ref={navMenuRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setNavMenuOpen((o) => !o)}
                  aria-label="Open navigation menu"
                  aria-haspopup="menu"
                  aria-expanded={navMenuOpen}
                  title="Navigation menu"
                  style={iconButtonStyle}
                  onFocus={iconButtonFocus}
                  onBlur={iconButtonBlur}
                >
                  <Menu size={14} aria-hidden="true" />
                </button>
                {navMenuOpen && (
                  <div
                    role="menu"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      zIndex: 100,
                      marginTop: 4,
                      minWidth: 200,
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--cast-rail-border)',
                      borderRadius: 6,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                      padding: '4px 0',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {NAV_ITEMS.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        role="menuitem"
                        end={item.path === '/'}
                        onClick={() => setNavMenuOpen(false)}
                        style={({ isActive }) => ({
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          minHeight: 36,
                          padding: '0 12px',
                          fontSize: '0.8125rem',
                          color: isActive ? 'var(--cast-accent, #00FFC2)' : 'var(--text-secondary)',
                          background: isActive ? 'var(--bg-tertiary)' : 'transparent',
                          textDecoration: 'none',
                          cursor: 'pointer',
                          outline: 'none',
                          borderRadius: 0,
                        })}
                        onFocus={(e) => {
                          e.currentTarget.style.outline = '2px solid var(--cast-accent)'
                          e.currentTarget.style.outlineOffset = '-2px'
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.outline = 'none'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--bg-tertiary)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                        }}
                      >
                        <item.icon aria-hidden="true" />
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setPaletteOpen(true)}
                aria-label="Open command palette (Cmd+K)"
                title="Command palette (⌘K)"
                style={iconButtonStyle}
                onFocus={iconButtonFocus}
                onBlur={iconButtonBlur}
              >
                <Search size={14} aria-hidden="true" />
              </button>
              <button
                onClick={handleOpenWorkspace}
                aria-label="Open folder as workspace"
                title="Open Folder…"
                style={iconButtonStyle}
                onFocus={iconButtonFocus}
                onBlur={iconButtonBlur}
              >
                <FolderOpen size={14} aria-hidden="true" />
              </button>
              {/* Spacer pushes the collapse toggle to the far end of the row when open */}
              {explorerOpen && <div style={{ flex: 1 }} />}
              <button
                onClick={() => setExplorerOpen((o) => !o)}
                aria-label={explorerOpen ? 'Collapse Explorer' : 'Expand Explorer'}
                aria-expanded={explorerOpen}
                title={explorerOpen ? 'Collapse Explorer' : 'Expand Explorer'}
                style={iconButtonStyle}
                onFocus={iconButtonFocus}
                onBlur={iconButtonBlur}
              >
                {explorerOpen
                  ? <PanelLeftClose size={14} aria-hidden="true" />
                  : <PanelLeft size={14} aria-hidden="true" />}
              </button>
            </div>

            {/* File tree label + tree (hidden when collapsed) */}
            {explorerOpen && (
              <>
                <div
                  style={{
                    padding: '8px 12px 6px',
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--text-muted)',
                    flexShrink: 0,
                    userSelect: 'none',
                  }}
                >
                  Explorer
                </div>
                <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                  <ProjectFileTree rootPath={rootPath} onOpenFile={handleOpenFile} />
                </div>
              </>
            )}
          </aside>

          {/* ── Center: Editor tabs + CodeMirror ── */}
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <EditorTabs />

              {/* ── IDE-3: External-change banner ── */}
              {activeFilePath && externalChange.has(activeFilePath) && (
                <div
                  role={dirty.has(activeFilePath) ? 'alert' : 'status'}
                  aria-live={dirty.has(activeFilePath) ? 'assertive' : 'polite'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    background: 'rgba(0,255,194,0.08)',
                    borderBottom: '1px solid rgba(0,255,194,0.25)',
                    flexShrink: 0,
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span style={{ flex: 1 }}>
                    Agent updated this file externally.
                  </span>
                  <button
                    aria-label="Reload file with agent changes, discarding local edits"
                    onClick={() => acceptExternalChange(activeFilePath)}
                    style={{
                      padding: '2px 10px',
                      border: '1px solid var(--cast-accent, #00FFC2)',
                      borderRadius: 4,
                      background: 'transparent',
                      color: 'var(--cast-accent, #00FFC2)',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      outline: 'none',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.outline = '2px solid var(--cast-accent)'
                      e.currentTarget.style.outlineOffset = '-2px'
                    }}
                    onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
                  >
                    Reload
                  </button>
                  <button
                    aria-label="Keep my local edits, dismiss the agent update"
                    onClick={() => dismissExternalChange(activeFilePath)}
                    style={{
                      padding: '2px 10px',
                      border: '1px solid var(--cast-rail-border)',
                      borderRadius: 4,
                      background: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '0.8125rem',
                      outline: 'none',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.outline = '2px solid var(--cast-accent)'
                      e.currentTarget.style.outlineOffset = '-2px'
                    }}
                    onBlur={(e) => { e.currentTarget.style.outline = 'none' }}
                  >
                    Keep mine
                  </button>
                </div>
              )}

              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <CodeEditor />
              </div>
            </div>
          </div>
        </div>

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
              transition: shouldReduceMotion ? 'none' : 'height 0.2s ease',
            }}
          >
            {bottomDockExpanded && <TerminalTabs />}
          </div>
        </div>
      </div>

      {/* ── IDE-5: Dispatch modal ── */}
      {dispatchModalOpen && (
        <DispatchModal
          initialPrompt={buildDispatchPrompt(activeFilePath, activeSelection)}
          cwd={rootPath.startsWith('~') ? (rootPath === '~' ? process.env.HOME ?? '/' : rootPath) : rootPath}
          onClose={() => setDispatchModalOpen(false)}
          onDispatched={(run_id, agent) => {
            setActiveRun({ run_id, agent })
          }}
        />
      )}

      {/* ── IDE-5: Agent run status panel ── */}
      {activeRun !== null && (
        <AgentRunStatusPanel
          run_id={activeRun.run_id}
          agent={activeRun.agent}
          onClose={() => setActiveRun(null)}
        />
      )}

      {/* ── Command palette (Cmd+K) — not mounted by ShellLayout on this route ── */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build the pre-filled dispatch prompt from active file path + selection. */
function buildDispatchPrompt(filePath: string | null, selection: string): string {
  const fileStr = filePath ? `File: ${filePath}` : 'File: (no file open)'
  const selStr = selection ? `Selection:\n${selection}` : 'Selection:\n(none)'
  return `${fileStr}\n\n${selStr}\n\nTask: `
}

// ── Icon-button styling shared across sidebar header ──────────────────────────

const iconButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  border: 'none',
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  outline: 'none',
  flexShrink: 0,
}

function iconButtonFocus(e: React.FocusEvent<HTMLButtonElement>) {
  e.currentTarget.style.outline = '2px solid var(--cast-accent)'
  e.currentTarget.style.outlineOffset = '-2px'
  e.currentTarget.style.color = 'var(--text-primary)'
}

function iconButtonBlur(e: React.FocusEvent<HTMLButtonElement>) {
  e.currentTarget.style.outline = 'none'
  e.currentTarget.style.color = 'var(--text-muted)'
}

import { useEffect, useCallback, useRef, useState } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useReducedMotion } from 'framer-motion'
import { useTerminalStore, Tab } from '../../stores/terminalStore'
import { TerminalPane } from './TerminalPane'
import { usePaneBinding } from '../../hooks/usePaneBinding'

// ── helpers ───────────────────────────────────────────────────────────────────

function basename(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? path
}

// ── TabLabel ──────────────────────────────────────────────────────────────────
// Extracted as a subcomponent so usePaneBinding (a hook) can be called
// unconditionally for each tab without violating Rules of Hooks.
//
// Title resolution priority (first match wins):
//  1. user-renamed title (tab.userRenamed=true) — always wins
//  2. bound session label — {projectBasename} · {sessionIdShort6}
//  3. cwd basename — tab.cwd when not bound
//  4. ordinal fallback — tab.title (set to "Terminal N" when cwd is empty)

interface TabLabelProps {
  tab: Tab
}

function TabLabel({ tab }: TabLabelProps) {
  const { bound, sessionId, projectPath } = usePaneBinding(tab.paneId)

  // Priority 1: user-renamed title is always authoritative
  if (tab.userRenamed) {
    return <>{tab.title}</>
  }

  // Priority 2: bound session label
  if (bound && sessionId && projectPath) {
    return <>{basename(projectPath)} · {sessionId.slice(0, 6)}</>
  }

  // Priority 3 & 4: cwd basename or ordinal fallback (both stored in tab.title by addTab)
  return <>{tab.title}</>
}

// ── useResolvedTitle ──────────────────────────────────────────────────────────
// Returns the same title string that TabLabel would render, for aria-label use.

function useResolvedTitle(tab: Tab): string {
  const { bound, sessionId, projectPath } = usePaneBinding(tab.paneId)

  if (tab.userRenamed) return tab.title
  if (bound && sessionId && projectPath) return `${basename(projectPath)} · ${sessionId.slice(0, 6)}`
  return tab.title
}

// ── TabItem ───────────────────────────────────────────────────────────────────
// Renders a single tab with rename UX (double-click, right-click context menu).

interface TabItemProps {
  tab: Tab
  isActive: boolean
  shouldReduceMotion: boolean | null
  onActivate: () => void
  onClose: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
}

function TabItem({ tab, isActive, shouldReduceMotion, onActivate, onClose, onKeyDown }: TabItemProps) {
  const updateTabTitle = useTerminalStore((s) => s.updateTabTitle)
  const resolvedTitle = useResolvedTitle(tab)

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const tabButtonRef = useRef<HTMLDivElement>(null)

  const startRename = useCallback(() => {
    setRenameValue(resolvedTitle)
    setIsRenaming(true)
  }, [resolvedTitle])

  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim()
    if (trimmed) {
      updateTabTitle(tab.id, trimmed)
    }
    setIsRenaming(false)
    // Return focus to the tab button
    requestAnimationFrame(() => tabButtonRef.current?.focus())
  }, [renameValue, tab.id, updateTabTitle])

  const cancelRename = useCallback(() => {
    setIsRenaming(false)
    requestAnimationFrame(() => tabButtonRef.current?.focus())
  }, [])

  // Auto-focus and select-all when rename mode activates
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handler = () => closeContextMenu()
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [contextMenu, closeContextMenu])

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div
        ref={tabButtonRef}
        role="tab"
        aria-selected={isActive}
        aria-label={resolvedTitle}
        tabIndex={0}
        data-tab-id={tab.id}
        onClick={onActivate}
        onDoubleClick={(e) => {
          e.stopPropagation()
          startRename()
        }}
        onContextMenu={handleContextMenu}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onActivate()
          }
          onKeyDown(e)
        }}
        title={resolvedTitle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 10px',
          height: 36,
          cursor: 'pointer',
          fontSize: '0.8125rem',
          color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
          background: isActive ? 'var(--cast-center-bg)' : 'transparent',
          borderBottom: isActive
            ? '2px solid var(--cast-accent)'
            : '2px solid transparent',
          borderRight: '1px solid var(--cast-rail-border)',
          userSelect: 'none',
          outline: 'none',
          transition: shouldReduceMotion ? 'none' : 'color 0.15s ease',
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--cast-accent)'
          e.currentTarget.style.outlineOffset = '-2px'
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none'
        }}
      >
        {/* Tab title: inline rename input or label */}
        <span
          style={{
            maxWidth: '10rem',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {isRenaming ? (
            <input
              ref={inputRef}
              type="text"
              aria-label="Rename tab"
              value={renameValue}
              maxLength={40}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  e.stopPropagation()
                  commitRename()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  e.stopPropagation()
                  cancelRename()
                }
              }}
              onBlur={commitRename}
              onClick={(e) => e.stopPropagation()}
              style={{
                fontSize: '0.8125rem',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--cast-accent)',
                borderRadius: 3,
                padding: '1px 4px',
                outline: 'none',
                width: '8rem',
              }}
            />
          ) : (
            <TabLabel tab={tab} />
          )}
        </span>

        {/* Close button */}
        <button
          aria-label={`Close ${resolvedTitle}`}
          onClick={(e) => {
            e.stopPropagation()
            onClose()
          }}
          tabIndex={-1}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 18,
            height: 18,
            minWidth: 18,
            minHeight: 18,
            padding: 0,
            border: 'none',
            borderRadius: 3,
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '0.75rem',
            lineHeight: 1,
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
          ×
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ul
          role="menu"
          aria-label="Tab options"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'var(--cast-top-bar-bg)',
            border: '1px solid var(--cast-rail-border)',
            borderRadius: 6,
            padding: '4px 0',
            margin: 0,
            listStyle: 'none',
            zIndex: 1000,
            minWidth: 120,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              closeContextMenu()
            }
          }}
        >
          <li
            role="menuitem"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation()
              closeContextMenu()
              startRename()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                closeContextMenu()
                startRename()
              }
            }}
            style={{
              padding: '6px 12px',
              fontSize: '0.8125rem',
              color: 'var(--text-primary)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'var(--bg-tertiary)'
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'transparent'
            }}
          >
            Rename
          </li>
        </ul>
      )}
    </div>
  )
}

// TerminalTabs — Wave 2.2b
// Provides a horizontal tab strip above a single active TerminalPane.
// Only the active tab's pane is mounted — each mount/unmount cycles the xterm
// lifecycle (TerminalPane manages its own instance).
//
// NOTE: PTY kill on tab close is deferred to Wave 2.4. closeTab() removes the
// tab from the store only. The underlying PTY process will orphan until the
// Tauri process exits or Wave 2.4 wires pty_kill.

export function TerminalTabs() {
  const tabs = useTerminalStore((s) => s.tabs)
  const activeTabId = useTerminalStore((s) => s.activeTabId)
  const addTab = useTerminalStore((s) => s.addTab)
  const closeTab = useTerminalStore((s) => s.closeTab)
  const setActiveTab = useTerminalStore((s) => s.setActiveTab)
  const shouldReduceMotion = useReducedMotion()
  const hasBootstrapped = useRef(false)

  // Bootstrap: auto-create the first tab on initial mount only.
  // We use a ref so re-renders (e.g. after a user closes all tabs) don't
  // re-trigger the bootstrap and silently re-open a tab.
  useEffect(() => {
    if (!hasBootstrapped.current && tabs.length === 0) {
      hasBootstrapped.current = true
      addTab('~')
    } else if (!hasBootstrapped.current && tabs.length > 0) {
      // Tabs were already present when component mounted (e.g. from persisted state)
      hasBootstrapped.current = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAddTab = useCallback(() => {
    addTab('~')
  }, [addTab])

  const handleCloseTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId)
      if (!tab) return

      // Only restore focus when focus was already inside the tablist.
      // If the user triggered ⌘W from the terminal area we should NOT yank
      // focus into the tab strip.
      const tablistEl = document.querySelector('[role="tablist"]')
      const focusWasInTablist =
        tablistEl !== null && tablistEl.contains(document.activeElement)

      // Pre-compute the next active id before the store update so we know
      // which tab button to focus after the DOM settles.
      let nextActiveId: string | null = null
      if (tabId === activeTabId) {
        const remaining = tabs.filter((t) => t.id !== tabId)
        nextActiveId =
          remaining.length > 0 ? remaining[remaining.length - 1].id : null
      } else {
        nextActiveId = activeTabId
      }

      closeTab(tabId)

      if (focusWasInTablist && nextActiveId) {
        requestAnimationFrame(() => {
          const nextTabEl = document.querySelector<HTMLElement>(
            `[data-tab-id="${nextActiveId}"]`,
          )
          nextTabEl?.focus()
        })
      }
    },
    [tabs, activeTabId, closeTab],
  )

  // ⌘T — new tab
  useHotkeys(
    'mod+t',
    (e) => {
      e.preventDefault()
      handleAddTab()
    },
    { enableOnFormTags: true, enableOnContentEditable: true },
  )

  // ⌘W — close active tab
  useHotkeys(
    'mod+w',
    (e) => {
      e.preventDefault()
      if (activeTabId) {
        handleCloseTab(activeTabId)
      }
    },
    { enableOnFormTags: true, enableOnContentEditable: true },
  )

  // Arrow key navigation within the tablist
  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent, tabId: string) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const currentIndex = tabs.findIndex((t) => t.id === tabId)
        if (currentIndex === -1) return

        let nextIndex: number
        if (e.key === 'ArrowLeft') {
          nextIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1
        } else {
          nextIndex = currentIndex === tabs.length - 1 ? 0 : currentIndex + 1
        }

        const nextTab = tabs[nextIndex]
        if (nextTab) {
          setActiveTab(nextTab.id)
          // Move focus to the newly activated tab button
          const tabEl = document.querySelector<HTMLElement>(
            `[data-tab-id="${nextTab.id}"]`,
          )
          tabEl?.focus()
        }
      }
    },
    [tabs, setActiveTab],
  )

  // Empty state (should be unreachable due to bootstrap useEffect, but handled gracefully)
  if (tabs.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center h-full gap-4"
        style={{ background: 'var(--cast-center-bg)', color: 'var(--text-muted)' }}
      >
        <p className="text-sm">No terminal sessions</p>
        <button
          onClick={handleAddTab}
          aria-label="New terminal tab"
          style={{
            background: 'var(--accent)',
            color: 'var(--bg-primary)',
            border: 'none',
            borderRadius: 6,
            padding: '10px 20px',
            fontSize: '0.875rem',
            cursor: 'pointer',
            minWidth: 44,
            minHeight: 44,
          }}
        >
          New Tab
        </button>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--cast-center-bg)' }}
    >
      {/* ── Tab strip ─────────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Terminal tabs"
        style={{
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--cast-rail-border)',
          background: 'var(--cast-top-bar-bg)',
          flexShrink: 0,
          overflowX: 'auto',
          scrollbarWidth: 'none',
        }}
      >
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            shouldReduceMotion={shouldReduceMotion}
            onActivate={() => setActiveTab(tab.id)}
            onClose={() => handleCloseTab(tab.id)}
            onKeyDown={(e) => handleTabKeyDown(e, tab.id)}
          />
        ))}

        {/* ── New tab button ─────────────────────────────────────────── */}
        <button
          onClick={handleAddTab}
          aria-label="New terminal tab"
          title="New tab (⌘T)"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 36,
            minWidth: 44,
            minHeight: 36,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '1.125rem',
            flexShrink: 0,
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)'
            e.currentTarget.style.background = 'var(--bg-tertiary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)'
            e.currentTarget.style.background = 'transparent'
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = '2px solid var(--cast-accent)'
            e.currentTarget.style.outlineOffset = '-2px'
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none'
          }}
        >
          +
        </button>
      </div>

      {/* ── Active terminal pane ───────────────────────────────────────── */}
      <div
        role="tabpanel"
        aria-label={`Terminal: ${tabs.find((t) => t.id === activeTabId)?.title ?? ''}`}
        className="flex-1 min-h-0"
        style={{ overflow: 'hidden' }}
      >
        {activeTabId && <TerminalPane tabId={activeTabId} />}
      </div>
    </div>
  )
}

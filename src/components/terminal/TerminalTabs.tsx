import { useEffect, useCallback, useRef } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useReducedMotion } from 'framer-motion'
import { useTerminalStore } from '../../stores/terminalStore'
import { TerminalPane } from './TerminalPane'

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
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              data-tab-id={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setActiveTab(tab.id)
                }
                handleTabKeyDown(e, tab.id)
              }}
              title={tab.title}
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
                flexShrink: 0,
                outline: 'none',
                transition: shouldReduceMotion ? 'none' : 'color 0.15s ease',
              }}
              // eslint-disable-next-line react/no-unknown-property
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--cast-accent)'
                e.currentTarget.style.outlineOffset = '-2px'
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none'
              }}
            >
              {/* Tab title with overflow truncation */}
              <span
                style={{
                  maxWidth: '10rem',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                }}
              >
                {tab.title}
              </span>

              {/* Close button */}
              <button
                aria-label={`Close ${tab.title}`}
                onClick={(e) => {
                  e.stopPropagation()
                  handleCloseTab(tab.id)
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
          )
        })}

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

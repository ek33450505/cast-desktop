import { useCallback } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import { useEditorStore } from '../../stores/editorStore'
import { useUnsavedChangesGuard } from '../hooks/useUnsavedChangesGuard'

// ── Helpers ───────────────────────────────────────────────────────────────────

function basename(path: string): string {
  const parts = path.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? path
}

// ── EditorTabs ────────────────────────────────────────────────────────────────
// Horizontal tab strip for the editor surface.
// Mirrors the pattern from TerminalTabs.tsx.
// Keyboard: Cmd+W closes active tab, Cmd+1..9 switch by index.

export function EditorTabs() {
  const openFiles = useEditorStore((s) => s.openFiles)
  const activeFilePath = useEditorStore((s) => s.activeFilePath)
  const closeFile = useEditorStore((s) => s.closeFile)
  const setActive = useEditorStore((s) => s.setActive)
  const dirty = useEditorStore((s) => s.dirty)
  const save = useEditorStore((s) => s.save)
  const shouldReduceMotion = useReducedMotion()
  const { promptGuard, modalElement } = useUnsavedChangesGuard()

  const handleClose = useCallback(
    async (path: string, e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation()
      if (dirty.has(path)) {
        const result = await promptGuard([path])
        if (result.action === 'cancel') return
        if (result.action === 'save') {
          try {
            await save(path)
          } catch (err) {
            toast.error(`Save failed: ${String(err)}`)
            return
          }
        }
        // 'discard' — fall through to close
      }
      closeFile(path)
    },
    [closeFile, dirty, promptGuard, save],
  )

  // Cmd+W — close active tab (async — guard for unsaved changes)
  useHotkeys(
    'mod+w',
    async (e) => {
      if (!activeFilePath) return
      // Only intercept if we're in editor context (not terminal)
      const active = document.activeElement
      const isTermFocused = active?.closest('.xterm') !== null
      if (isTermFocused) return
      e.preventDefault()
      if (dirty.has(activeFilePath)) {
        const result = await promptGuard([activeFilePath])
        if (result.action === 'cancel') return
        if (result.action === 'save') {
          try {
            await save(activeFilePath)
          } catch (err) {
            toast.error(`Save failed: ${String(err)}`)
            return
          }
        }
      }
      closeFile(activeFilePath)
    },
    { enableOnFormTags: false, enableOnContentEditable: false },
  )

  // Cmd+1..9 — switch to tab by 1-based index
  useHotkeys(
    'mod+1,mod+2,mod+3,mod+4,mod+5,mod+6,mod+7,mod+8,mod+9',
    (e, handler) => {
      // Extract digit from the triggered combination (e.g. "mod+3" → "3")
      const key = handler.keys?.[0] ?? ''
      const idx = parseInt(key, 10) - 1
      const target = openFiles[idx]
      if (target) {
        e.preventDefault()
        setActive(target.path)
      }
    },
    { enableOnFormTags: false, enableOnContentEditable: false },
  )

  if (openFiles.length === 0) {
    return null
  }

  return (
    <>
    <div
      role="tablist"
      aria-label="Editor tabs"
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
      {openFiles.map((file, idx) => {
        const isActive = file.path === activeFilePath
        const isDirty = dirty.has(file.path)
        const label = basename(file.path)
        const tabLabel = `${label}${isDirty ? ' (unsaved)' : ''}${isActive ? ', active tab' : ''}`

        return (
          <div
            key={file.path}
            role="tab"
            aria-selected={isActive}
            aria-label={tabLabel}
            tabIndex={isActive ? 0 : -1}
            data-editor-tab={file.path}
            onClick={() => setActive(file.path)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setActive(file.path)
              }
              // Arrow key navigation between tabs
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault()
                const currentIdx = openFiles.findIndex((f) => f.path === file.path)
                let nextIdx: number
                if (e.key === 'ArrowLeft') {
                  nextIdx = currentIdx === 0 ? openFiles.length - 1 : currentIdx - 1
                } else {
                  nextIdx = currentIdx === openFiles.length - 1 ? 0 : currentIdx + 1
                }
                const nextFile = openFiles[nextIdx]
                if (nextFile) {
                  setActive(nextFile.path)
                  const nextEl = document.querySelector<HTMLElement>(
                    `[data-editor-tab="${CSS.escape(nextFile.path)}"]`,
                  )
                  nextEl?.focus()
                }
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              paddingLeft: 12,
              paddingRight: 8,
              height: 36,
              flexShrink: 0,
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
              whiteSpace: 'nowrap',
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid var(--cast-accent)'
              e.currentTarget.style.outlineOffset = '-2px'
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none'
            }}
            title={file.path}
          >
            <span
              style={{
                maxWidth: '10rem',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              {isDirty && (
                <span
                  aria-hidden="true"
                  data-testid="dirty-indicator"
                  style={{ color: 'var(--cast-accent)', marginRight: 3 }}
                >
                  •
                </span>
              )}
              {label}
            </span>

            {/* Keyboard shortcut hint (Cmd+1..9) */}
            {idx < 9 && (
              <span
                aria-hidden="true"
                style={{
                  fontSize: '0.625rem',
                  color: 'var(--text-muted)',
                  marginLeft: 2,
                  opacity: isActive ? 0.8 : 0.5,
                }}
              >
                ⌘{idx + 1}
              </span>
            )}

            {/* Close button */}
            <button
              aria-label={`Close ${label}`}
              tabIndex={-1}
              onClick={(e) => handleClose(file.path, e)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleClose(file.path, e)
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
                minWidth: 18,
                minHeight: 18,
                marginLeft: 4,
                padding: 0,
                border: 'none',
                borderRadius: 3,
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.75rem',
                lineHeight: 1,
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-muted)'
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--cast-accent)'
                e.currentTarget.style.outlineOffset = '-2px'
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none'
              }}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
    {modalElement}
    </>
  )
}

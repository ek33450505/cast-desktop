import { useEffect, useRef, useCallback, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { useReducedMotion } from 'framer-motion'

interface FolderPickerModalProps {
  recentDirs: string[]
  defaultPath?: string
  onPick: (dir: string) => void
  onCancel: () => void
}

export function FolderPickerModal({
  recentDirs,
  defaultPath,
  onPick,
  onCancel,
}: FolderPickerModalProps) {
  const shouldReduceMotion = useReducedMotion()
  const [isPicking, setIsPicking] = useState(false)
  const browseButtonRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const isMountedRef = useRef(true)

  // Track mounted state to guard post-await setState calls
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Focus the Browse button on mount
  useEffect(() => {
    browseButtonRef.current?.focus()
  }, [])

  // Close on Escape; trap Tab / Shift+Tab within the modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
        return
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute('disabled'))

        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const handleBrowse = useCallback(async () => {
    setIsPicking(true)
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        defaultPath: defaultPath ?? undefined,
      })
      if (typeof selected === 'string' && selected !== null) {
        onPick(selected)
      }
      // null or array (multiple: false so no array) = user cancelled — keep modal open
    } catch {
      // picker failed; fall back gracefully, keep modal open
    } finally {
      if (isMountedRef.current) {
        setIsPicking(false)
      }
    }
  }, [defaultPath, onPick])

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) {
        onCancel()
      }
    },
    [onCancel],
  )

  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.55)',
    animation: shouldReduceMotion ? 'none' : 'cast-fade-in 0.12s ease',
  }

  const dialogStyle: React.CSSProperties = {
    background: 'var(--cast-center-bg)',
    border: '1px solid var(--cast-rail-border)',
    borderRadius: 10,
    padding: '20px 24px',
    minWidth: 340,
    maxWidth: 480,
    width: '90vw',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    animation: shouldReduceMotion ? 'none' : 'cast-slide-up 0.12s ease',
  }

  const headingStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  }

  const recentLabelStyle: React.CSSProperties = {
    fontSize: '0.6875rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    margin: '0 0 6px 0',
  }

  const recentButtonStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    padding: '7px 10px',
    fontSize: '0.8125rem',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    outline: 'none',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }

  const actionsStyle: React.CSSProperties = {
    display: 'flex',
    gap: 8,
    justifyContent: 'flex-end',
    borderTop: '1px solid var(--cast-rail-border)',
    paddingTop: 14,
  }

  const cancelButtonStyle: React.CSSProperties = {
    padding: '7px 16px',
    fontSize: '0.8125rem',
    border: '1px solid var(--cast-rail-border)',
    borderRadius: 6,
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    outline: 'none',
  }

  const browseButtonStyle: React.CSSProperties = {
    padding: '7px 16px',
    fontSize: '0.8125rem',
    border: 'none',
    borderRadius: 6,
    background: 'var(--cast-accent)',
    color: 'var(--bg-primary)',
    cursor: isPicking ? 'wait' : 'pointer',
    fontWeight: 600,
    outline: 'none',
    opacity: isPicking ? 0.7 : 1,
  }

  return (
    <>
      {/* Keyframe animations — injected inline so no CSS file needed */}
      <style>{`
        @keyframes cast-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cast-slide-up { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      <div style={backdropStyle} onClick={handleBackdropClick}>
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Pick a folder for new terminal"
          style={dialogStyle}
        >
          <h2 style={headingStyle}>New terminal in folder</h2>

          {recentDirs.length > 0 && (
            <div>
              <p style={recentLabelStyle}>Recent</p>
              <div
                style={{
                  maxHeight: 180,
                  overflowY: 'auto',
                  border: '1px solid var(--cast-rail-border)',
                  borderRadius: 6,
                }}
              >
                {recentDirs.map((dir) => (
                  <button
                    key={dir}
                    aria-label={`Open terminal in ${dir}`}
                    style={recentButtonStyle}
                    onClick={() => onPick(dir)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--bg-tertiary)'
                    }}
                    onMouseLeave={(e) => {
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
                    {dir}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={actionsStyle}>
            <button
              aria-label="Cancel folder picker"
              style={cancelButtonStyle}
              onClick={onCancel}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--cast-accent)'
                e.currentTarget.style.outlineOffset = '-2px'
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none'
              }}
            >
              Cancel
            </button>
            <button
              ref={browseButtonRef}
              aria-label="Browse for folder"
              style={browseButtonStyle}
              onClick={handleBrowse}
              disabled={isPicking}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--text-primary)'
                e.currentTarget.style.outlineOffset = '2px'
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none'
              }}
            >
              {isPicking ? 'Opening…' : 'Browse…'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

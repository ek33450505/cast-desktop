import { useEffect, useRef } from 'react'

interface PasteConfirmBannerProps {
  lineCount: number
  onConfirm: () => void
  onCancel: () => void
}

export function PasteConfirmBanner({ lineCount, onConfirm, onCancel }: PasteConfirmBannerProps) {
  const bannerRef = useRef<HTMLDivElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  // Focus the confirm button when banner appears so keyboard users can act immediately
  useEffect(() => {
    requestAnimationFrame(() => confirmButtonRef.current?.focus())
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onCancel()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      onConfirm()
    }
  }

  return (
    <div
      ref={bannerRef}
      role="alertdialog"
      aria-label="Paste confirmation"
      aria-modal="false"
      onKeyDown={handleKeyDown}
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        right: 8,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: 'var(--cast-top-bar-bg)',
        border: '1px solid var(--cast-rail-border)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        fontSize: '0.8125rem',
        color: 'var(--text-primary)',
      }}
    >
      <span style={{ flex: 1 }}>
        Paste{' '}
        <strong>
          {lineCount} {lineCount === 1 ? 'line' : 'lines'}
        </strong>
        ?
      </span>

      <button
        ref={confirmButtonRef}
        aria-label="Confirm paste"
        onClick={onConfirm}
        style={confirmButtonStyle}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--cast-accent-hover, var(--cast-accent))')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--cast-accent)')}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--cast-accent)'
          e.currentTarget.style.outlineOffset = '2px'
        }}
        onBlur={(e) => (e.currentTarget.style.outline = 'none')}
      >
        Paste
      </button>

      <button
        aria-label="Cancel paste"
        onClick={onCancel}
        style={cancelButtonStyle}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--cast-accent)'
          e.currentTarget.style.outlineOffset = '2px'
        }}
        onBlur={(e) => (e.currentTarget.style.outline = 'none')}
      >
        Cancel
      </button>
    </div>
  )
}

const confirmButtonStyle: React.CSSProperties = {
  padding: '4px 12px',
  border: 'none',
  borderRadius: 4,
  background: 'var(--cast-accent)',
  color: 'var(--cast-bg, #1D2622)',
  fontSize: '0.8125rem',
  fontWeight: 600,
  cursor: 'pointer',
  outline: 'none',
  flexShrink: 0,
}

const cancelButtonStyle: React.CSSProperties = {
  padding: '4px 10px',
  border: '1px solid var(--cast-rail-border)',
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: '0.8125rem',
  cursor: 'pointer',
  outline: 'none',
  flexShrink: 0,
}

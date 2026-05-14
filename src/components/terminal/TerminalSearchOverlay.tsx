import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useReducedMotion } from 'framer-motion'
import { ChevronUp, ChevronDown, X } from 'lucide-react'

interface TerminalSearchOverlayProps {
  open: boolean
  onClose: () => void
  onSearch: (query: string, direction: 'next' | 'prev') => void
  onClear: () => void
  matchCount?: { current: number; total: number } | null
}

export function TerminalSearchOverlay({
  open,
  onClose,
  onSearch,
  onClear,
  matchCount,
}: TerminalSearchOverlayProps) {
  const shouldReduceMotion = useReducedMotion()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')

  // Focus input when overlay opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Debounced live search
  useEffect(() => {
    if (!query) {
      onClear()
      return
    }
    const timer = setTimeout(() => {
      onSearch(query, 'next')
    }, 120)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        onSearch(query, 'prev')
      } else {
        onSearch(query, 'next')
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  const handleClose = () => {
    setQuery('')
    onClear()
    onClose()
  }

  const matchLabel = (() => {
    if (!query) return null
    if (!matchCount) return null
    if (matchCount.total === 0) return 'No results'
    return `${matchCount.current} of ${matchCount.total}`
  })()

  const animVariants = shouldReduceMotion
    ? { initial: {}, animate: {}, exit: {} }
    : {
        initial: { opacity: 0, y: -8 },
        animate: { opacity: 1, y: 0, transition: { duration: 0.15 } },
        exit: { opacity: 0, y: -8, transition: { duration: 0.1 } },
      }

  return (
    <motion.div
      role="search"
      aria-label="Terminal search"
      variants={animVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        width: 280,
        padding: '6px 8px',
        background: 'var(--cast-top-bar-bg)',
        border: '1px solid var(--cast-rail-border)',
        borderRadius: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
      }}
    >
      {/* Search input */}
      <input
        ref={inputRef}
        type="text"
        placeholder="Search…"
        value={query}
        maxLength={200}
        aria-label="Search terminal"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--text-primary)',
          fontSize: '0.8125rem',
          lineHeight: 1.4,
        }}
      />

      {/* Match count */}
      {matchLabel && (
        <span
          style={{
            fontSize: '0.75rem',
            color: matchCount?.total === 0 ? 'var(--destructive)' : 'var(--text-muted)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {matchLabel}
        </span>
      )}

      {/* Prev button */}
      <button
        aria-label="Previous match"
        onClick={() => onSearch(query, 'prev')}
        style={iconButtonStyle}
        onMouseEnter={handleIconHoverEnter}
        onMouseLeave={handleIconHoverLeave}
        onFocus={handleIconFocus}
        onBlur={handleIconBlur}
      >
        <ChevronUp size={14} aria-hidden="true" />
      </button>

      {/* Next button */}
      <button
        aria-label="Next match"
        onClick={() => onSearch(query, 'next')}
        style={iconButtonStyle}
        onMouseEnter={handleIconHoverEnter}
        onMouseLeave={handleIconHoverLeave}
        onFocus={handleIconFocus}
        onBlur={handleIconBlur}
      >
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      {/* Close button */}
      <button
        aria-label="Close search"
        onClick={handleClose}
        style={iconButtonStyle}
        onMouseEnter={handleIconHoverEnter}
        onMouseLeave={handleIconHoverLeave}
        onFocus={handleIconFocus}
        onBlur={handleIconBlur}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </motion.div>
  )
}

// ── Shared icon button style ────────────────────────────────────────────────────

const iconButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  minWidth: 24,
  minHeight: 24,
  padding: 0,
  border: 'none',
  borderRadius: 4,
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  flexShrink: 0,
  outline: 'none',
}

function handleIconHoverEnter(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = 'var(--bg-tertiary)'
  e.currentTarget.style.color = 'var(--text-primary)'
}

function handleIconHoverLeave(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = 'transparent'
  e.currentTarget.style.color = 'var(--text-muted)'
}

function handleIconFocus(e: React.FocusEvent<HTMLButtonElement>) {
  e.currentTarget.style.outline = '2px solid var(--cast-accent)'
  e.currentTarget.style.outlineOffset = '-2px'
}

function handleIconBlur(e: React.FocusEvent<HTMLButtonElement>) {
  e.currentTarget.style.outline = 'none'
}

import { useState } from 'react'
import { Bug } from 'lucide-react'
import { invoke } from '@tauri-apps/api/core'
import { useGitUser } from '../api/useGitUser'
import { AppIconSVG } from './AppIcon'

export function StatusBar() {
  const { data: gitUser } = useGitUser()
  const userName = gitUser?.name ?? null
  const [devtoolsFocused, setDevtoolsFocused] = useState(false)

  function handleToggleDevtools() {
    invoke('toggle_devtools').catch(() => {
      // invoke throws outside a Tauri context (e.g. under vitest) — swallow silently
    })
  }

  return (
    <div
      role="status"
      aria-live="off"
      className="shrink-0 h-8 px-4 flex items-center gap-3 text-xs"
      style={{
        background: 'var(--system-elevated)',
        borderTop: '1px solid var(--border)',
        color: 'var(--content-muted)',
      }}
    >
      {/* DevTools toggle — left side, works in all builds */}
      <button
        type="button"
        aria-label="Toggle developer tools"
        title="Toggle developer tools"
        onClick={handleToggleDevtools}
        onFocus={() => setDevtoolsFocused(true)}
        onBlur={() => setDevtoolsFocused(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          background: 'transparent',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          color: 'var(--content-muted)',
          outline: devtoolsFocused ? '2px solid var(--cast-accent)' : 'none',
          outlineOffset: '1px',
          transition: 'color 0.1s',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--content-secondary)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--content-muted)'
        }}
      >
        <Bug size={14} aria-hidden="true" />
      </button>

      {/* Spacer pushes the brand cluster to the right edge */}
      <span className="flex-1" />

      {/* Cast brand cluster — app icon + wordmark + git user name */}
      <span className="flex items-center gap-1.5">
        <AppIconSVG size={16} aria-hidden="true" />
        <span style={{ color: 'var(--content-secondary)' }}>Cast</span>
        {userName && (
          <>
            <span aria-hidden="true">·</span>
            <span>{userName}</span>
          </>
        )}
      </span>
    </div>
  )
}

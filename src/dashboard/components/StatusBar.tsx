import { useGitUser } from '../api/useGitUser'
import { AppIconSVG } from './AppIcon'

export function StatusBar() {
  const { data: gitUser } = useGitUser()
  const userName = gitUser?.name ?? null

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

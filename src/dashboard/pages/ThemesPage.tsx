import { useAppearance } from '../../hooks/useAppearance'
import type { Appearance } from '../../hooks/useAppearance'

const THEMES: Array<{
  id: Appearance
  label: string
  canvas: string
  panel: string
  accent: string
  text: string
  description: string
}> = [
  {
    id: 'dusk',
    label: 'Forest at Dusk',
    canvas: '#0F1117',
    panel: '#161B22',
    accent: '#00D4AA',
    text: '#E8EDF3',
    description: 'Dark — easy on the eyes for long sessions.',
  },
  {
    id: 'dawn',
    label: 'Sunrise',
    canvas: '#F5F0E8',
    panel: '#EDE8E0',
    accent: '#1A6B4A',
    text: '#2C3A2E',
    description: 'Light — clear and calm.',
  },
]

export default function ThemesPage() {
  const { appearance, setAppearance } = useAppearance()

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--content-primary)' }}>Themes</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--content-muted)' }}>
          Choose your Cast Desktop appearance.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {THEMES.map(theme => {
          const isActive = appearance === theme.id
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => setAppearance(theme.id)}
              aria-pressed={isActive}
              aria-label={`Select ${theme.label} theme`}
              className="rounded-xl p-4 text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-1"
              style={{
                background: 'var(--system-panel)',
                border: `2px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                minHeight: '44px',
              }}
            >
              {/* Swatch preview */}
              <div
                className="rounded-lg overflow-hidden mb-3 h-24"
                style={{ background: theme.canvas, border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div
                  className="h-8 px-3 flex items-center gap-2"
                  style={{ background: theme.panel, borderBottom: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ background: theme.accent }} />
                  <div className="h-1.5 w-16 rounded-full opacity-40" style={{ background: theme.text }} />
                </div>
                <div className="p-3 space-y-1.5">
                  <div className="h-1.5 rounded-full w-3/4 opacity-30" style={{ background: theme.text }} />
                  <div className="h-1.5 rounded-full w-1/2 opacity-20" style={{ background: theme.text }} />
                  <div className="h-1.5 rounded-full w-5/6 opacity-25" style={{ background: theme.text }} />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold" style={{ color: 'var(--content-primary)' }}>
                    {theme.label}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--content-muted)' }}>
                    {theme.description}
                  </div>
                </div>
                {isActive && (
                  <span
                    className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: 'var(--accent)', color: 'var(--system-canvas)' }}
                  >
                    Active
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

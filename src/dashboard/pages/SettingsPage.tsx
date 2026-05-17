import { Link } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { useSystemHealth } from '../api/useSystem'
import { useAppearance } from '../../hooks/useAppearance'

export default function SettingsPage() {
  const { data } = useSystemHealth()
  const { appearance } = useAppearance()

  const stats = [
    { label: 'Model', value: data?.model ?? '—' },
    { label: 'Agents', value: data?.agentCount != null ? String(data.agentCount) : '—' },
    { label: 'Skills', value: data?.skillCount != null ? String(data.skillCount) : '—' },
    { label: 'Plans', value: data?.planCount != null ? String(data.planCount) : '—' },
  ]

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-2.5">
        <Settings className="w-5 h-5" aria-hidden="true" style={{ color: 'var(--accent)' }} />
        <h1 className="text-xl font-bold" style={{ color: 'var(--content-primary)' }}>Settings</h1>
      </div>

      {/* CAST stats */}
      <section aria-label="CAST configuration">
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-3"
          style={{ color: 'var(--content-muted)' }}
        >
          Configuration
        </h2>
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--system-panel)', border: '1px solid var(--border)' }}
        >
          {stats.map(({ label, value }, i) => (
            <div
              key={label}
              className="flex items-center justify-between px-4 py-3"
              style={{
                borderBottom: i < stats.length - 1 ? '1px solid var(--border)' : 'none',
                minHeight: '44px',
              }}
            >
              <span className="text-sm" style={{ color: 'var(--content-secondary)' }}>
                {label}
              </span>
              <span className="text-sm font-mono font-medium" style={{ color: 'var(--content-primary)' }}>
                {value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Appearance */}
      <section aria-label="Appearance">
        <h2
          className="text-xs font-semibold uppercase tracking-wider mb-3"
          style={{ color: 'var(--content-muted)' }}
        >
          Appearance
        </h2>
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--system-panel)', border: '1px solid var(--border)' }}
        >
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ minHeight: '44px' }}
          >
            <span className="text-sm" style={{ color: 'var(--content-secondary)' }}>
              Theme
            </span>
            <div className="flex items-center gap-3">
              <span
                className="text-sm font-medium capitalize"
                style={{ color: 'var(--content-primary)' }}
              >
                {appearance === 'dusk' ? 'Forest at Dusk' : 'Sunrise'}
              </span>
              <Link
                to="/themes"
                className="text-xs hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] rounded-sm"
                style={{ color: 'var(--accent)' }}
              >
                Change
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

import { Link } from 'react-router-dom'

interface StubPageProps {
  title: string
  subtitle?: string
}

function StubPage({ title, subtitle }: StubPageProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
      <h1 className="text-2xl font-semibold text-[var(--content-primary)]">{title}</h1>
      <p className="text-sm text-[var(--content-muted)] max-w-sm">
        {subtitle ?? 'Repatriates from claude-code-dashboard in a sub-wave'}
      </p>
      <Link
        to="/"
        className="mt-2 text-sm text-[var(--accent)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2 rounded-sm"
      >
        ← Back to terminal
      </Link>
    </div>
  )
}

export function HooksPage() {
  return <StubPage title="Hooks" />
}

export function PlansPage() {
  return <StubPage title="Plans" />
}

export function MemoryPage() {
  return <StubPage title="Memory" />
}

export function DbPage() {
  return <StubPage title="DB Explorer" />
}

export function SettingsPage() {
  return <StubPage title="Settings" />
}

export function ThemesPage() {
  return <StubPage title="Themes" subtitle="Themes are coming in v1.1 — forest-at-dusk (dark) and sunrise (light) palettes are in design. We're polishing functional UX first." />
}

export function SkillsPage() {
  return <StubPage title="Skills" />
}

export function AboutPage() {
  return <StubPage title="About" />
}

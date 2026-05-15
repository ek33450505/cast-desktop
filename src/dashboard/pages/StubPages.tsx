import { Link } from 'react-router-dom'

interface ComingSoonProps {
  title: string
  subtitle?: string
  targetVersion?: string
}

function ComingSoon({ title, subtitle = 'Coming in v1.1.' }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
      <h1 className="text-2xl font-semibold text-[var(--content-primary)]">{title}</h1>
      <p className="text-sm text-[var(--content-muted)] max-w-sm">
        {subtitle}
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
  return (
    <ComingSoon
      title="Hooks"
      subtitle="View and edit Claude Code hooks from inside Cast Desktop. Coming in v1.1."
    />
  )
}

export function PlansPage() {
  return (
    <ComingSoon
      title="Plans"
      subtitle="Browse and resume CAST plans. Coming in v1.1."
    />
  )
}

export function MemoryPage() {
  return (
    <ComingSoon
      title="Memory"
      subtitle="Inspect agent and project memory. Coming in v1.1."
    />
  )
}

export function DbPage() {
  return (
    <ComingSoon
      title="Database"
      subtitle="Explore cast.db tables and schema. Coming in v1.1."
    />
  )
}

export function SettingsPage() {
  return (
    <ComingSoon
      title="Settings"
      subtitle="Configure Cast Desktop. Coming in v1.1."
    />
  )
}

export function ThemesPage() {
  return (
    <ComingSoon
      title="Themes"
      subtitle="forest-at-dusk (dark) and sunrise (light) palettes are in design. Coming in v1.1."
    />
  )
}

export function SkillsPage() {
  return (
    <ComingSoon
      title="Skills"
      subtitle="Browse installed Claude Code skills. Coming in v1.1."
    />
  )
}

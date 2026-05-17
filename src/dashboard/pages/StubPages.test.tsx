import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  HooksPage,
  PlansPage,
  MemoryPage,
  SettingsPage,
  ThemesPage,
  SkillsPage,
} from './StubPages'

// ── Mock API hooks so pages render without a network ──────────────────────────

vi.mock('../api/useHooks', () => ({
  useHooks: () => ({ data: [], isLoading: false, error: null }),
}))

vi.mock('../api/usePlans', () => ({
  usePlans: () => ({ data: [], isLoading: false, error: null }),
}))

vi.mock('../api/useMemory', () => ({
  useProjectMemory: () => ({ data: [], isLoading: false, error: null }),
}))

vi.mock('../api/useSystem', () => ({
  useSystemHealth: () => ({ data: null }),
}))

vi.mock('../../hooks/useAppearance', () => ({
  useAppearance: () => ({ appearance: 'dusk', setAppearance: vi.fn(), toggle: vi.fn() }),
}))

// Skills page uses inline useQuery — mock @tanstack/react-query
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQuery: ({ queryKey }: { queryKey: unknown[] }) => {
      if (Array.isArray(queryKey) && queryKey[0] === 'skills') {
        return { data: [], isLoading: false, error: null }
      }
      // For any other query key, return loading state (no crash)
      return { data: undefined, isLoading: false, error: null }
    },
  }
})

// ── Page title assertions ─────────────────────────────────────────────────────

function renderInRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('HooksPage', () => {
  beforeEach(() => { renderInRouter(<HooksPage />) })

  it('renders the Hooks heading', () => {
    expect(screen.getByRole('heading', { name: 'Hooks' })).toBeInTheDocument()
  })

  it('renders empty state when no hooks', () => {
    expect(screen.getByText(/no hooks configured/i)).toBeInTheDocument()
  })
})

describe('PlansPage', () => {
  beforeEach(() => { renderInRouter(<PlansPage />) })

  it('renders the Plans heading', () => {
    expect(screen.getByRole('heading', { name: 'Plans' })).toBeInTheDocument()
  })

  it('renders empty state when no plans', () => {
    expect(screen.getByText(/no plans found/i)).toBeInTheDocument()
  })
})

describe('MemoryPage', () => {
  beforeEach(() => { renderInRouter(<MemoryPage />) })

  it('renders the Memory heading', () => {
    expect(screen.getByRole('heading', { name: 'Memory' })).toBeInTheDocument()
  })

  it('renders empty state when no memory files', () => {
    expect(screen.getByText(/no memory files found/i)).toBeInTheDocument()
  })
})

describe('SettingsPage', () => {
  beforeEach(() => { renderInRouter(<SettingsPage />) })

  it('renders the Settings heading', () => {
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })

  it('renders a link to /themes', () => {
    const link = screen.getByRole('link', { name: /change/i })
    expect(link).toHaveAttribute('href', '/themes')
  })
})

describe('ThemesPage', () => {
  beforeEach(() => { renderInRouter(<ThemesPage />) })

  it('renders the Themes heading', () => {
    expect(screen.getByRole('heading', { name: 'Themes' })).toBeInTheDocument()
  })

  it('renders theme option buttons', () => {
    expect(screen.getByRole('button', { name: /forest at dusk/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sunrise/i })).toBeInTheDocument()
  })

  it('marks the current theme as active', () => {
    const duskBtn = screen.getByRole('button', { name: /forest at dusk/i })
    expect(duskBtn).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('SkillsPage', () => {
  beforeEach(() => { renderInRouter(<SkillsPage />) })

  it('renders the Skills heading', () => {
    expect(screen.getByRole('heading', { name: 'Skills' })).toBeInTheDocument()
  })

  it('renders empty state when no skills', () => {
    expect(screen.getByText(/no skills found/i)).toBeInTheDocument()
  })
})

// ── DbPage is a real page — verify re-export works ───────────────────────────

describe('DbPage re-export', () => {
  it('re-exports DbPage from ./DbPage without error', async () => {
    vi.mock('../api/useSqliteExplorer', () => ({
      useSqliteTables: () => ({ data: { tables: [] }, isLoading: false, error: null }),
      useSqliteTable: () => ({ data: null, isLoading: false, error: null }),
      useSqliteTableSchema: () => ({ data: null, isLoading: false, error: null }),
    }))

    const { DbPage } = await import('./StubPages')
    const { render: renderComponent, screen: s } = await import('@testing-library/react')
    renderComponent(
      <MemoryRouter>
        <DbPage />
      </MemoryRouter>,
    )
    expect(s.getByText(/select a table to browse/i)).toBeInTheDocument()
  })
})

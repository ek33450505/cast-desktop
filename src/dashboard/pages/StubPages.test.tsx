import { describe, it, expect, vi } from 'vitest'
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
import type { ComponentType } from 'react'

// ── Stub pages that are still "coming soon" placeholders ──────────────────────

const STUB_PAGES: Array<{ name: string; Page: ComponentType; title: string }> = [
  { name: 'HooksPage', Page: HooksPage, title: 'Hooks' },
  { name: 'PlansPage', Page: PlansPage, title: 'Plans' },
  { name: 'MemoryPage', Page: MemoryPage, title: 'Memory' },
  { name: 'SettingsPage', Page: SettingsPage, title: 'Settings' },
  { name: 'ThemesPage', Page: ThemesPage, title: 'Themes' },
  { name: 'SkillsPage', Page: SkillsPage, title: 'Skills' },
]

describe.each(STUB_PAGES)('$name', ({ Page, title }) => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    )
  }

  it('does not contain internal placeholder copy', () => {
    renderPage()
    expect(screen.queryByText(/repatriates from claude-code-dashboard/i)).not.toBeInTheDocument()
  })

  it('renders the correct page title', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
  })

  it('renders a back link to /', () => {
    renderPage()
    const link = screen.getByRole('link', { name: /back to terminal/i })
    expect(link).toHaveAttribute('href', '/')
  })
})

// ── DbPage is now a real page — verify re-export works ───────────────────────

describe('DbPage re-export', () => {
  it('re-exports DbPage from ./DbPage without error', async () => {
    // Mock the API hooks so the component can render without a network
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
    // The real DbPage renders a "Select a table to browse" empty state when no table is selected
    expect(s.getByText(/select a table to browse/i)).toBeInTheDocument()
  })
})

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  HooksPage,
  PlansPage,
  MemoryPage,
  DbPage,
  SettingsPage,
  ThemesPage,
  SkillsPage,
} from './StubPages'
import type { ComponentType } from 'react'

const STUB_PAGES: Array<{ name: string; Page: ComponentType; title: string }> = [
  { name: 'HooksPage', Page: HooksPage, title: 'Hooks' },
  { name: 'PlansPage', Page: PlansPage, title: 'Plans' },
  { name: 'MemoryPage', Page: MemoryPage, title: 'Memory' },
  { name: 'DbPage', Page: DbPage, title: 'Database' },
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

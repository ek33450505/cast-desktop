# Contributing to Cast Desktop

Thank you for your interest in contributing to Cast Desktop — a terminal UI and desktop application for Claude agents and the CAST framework.

## Prerequisites

- **Node.js 22+** — for frontend and backend development
- **Rust toolchain** — required for Tauri desktop builds (`rustup install stable`)
- **Bun** — for fast server builds and CLI tooling (`npm install -g bun`)
- **CAST framework** — for understanding agent integration (see [claude-agent-team](https://github.com/ek33450505/claude-agent-team))
- **TypeScript Language Server** — for IDE support (`npm install -g typescript-language-server`)

## Setup

```bash
git clone https://github.com/ek33450505/cast-desktop.git
cd cast-desktop
npm install
cd server && npm install && npm run build:sqlite
cd ..
```

The `npm run build:sqlite` step rebuilds the `better-sqlite3` native module for your platform.

## Dev Commands

```bash
# Start frontend (Vite @ :5173) and backend server (Express @ :3001) together
npm run dev

# Run frontend only (Vite)
vite

# Run backend server only
cd server && npm run dev

# Launch the full Tauri desktop app
cargo tauri dev

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Project Structure

```
cast-desktop/
├── src/                          # React frontend
│   ├── dashboard/                # Main dashboard app
│   │   ├── App.tsx              # Route definitions
│   │   ├── views/               # Page-level views (Sessions, Analytics, etc.)
│   │   ├── components/          # Shared UI components
│   │   └── api/                 # Hooks for data fetching
│   └── components/
│       ├── CommandPalette.tsx    # Cmd+K navigation
│       ├── TerminalTabs.tsx      # PTY terminal interface
│       └── ...                   # Other shells (Editor, System, etc.)
├── server/                        # Express API backend
│   ├── routes/                   # API endpoint handlers (one file per resource)
│   ├── utils/                    # withTable, apiFetch helpers
│   └── index.ts                  # Express server setup
├── src-tauri/                     # Tauri desktop shell
│   ├── src/                      # Rust app logic
│   ├── tauri.conf.json           # Tauri build config
│   └── binaries/                 # Compiled server + LSP sidecars
└── vite.config.ts                # Vite + Tailwind config
```

## Adding a New Dashboard Page

1. **Create the view file:**
   ```
   src/dashboard/views/MyFeatureView.tsx
   ```
   Export a React functional component:
   ```tsx
   export default function MyFeatureView() {
     return <div>My feature content</div>
   }
   ```

2. **Register the route in App.tsx:**
   ```tsx
   const MyFeatureView = lazy(() => import('./views/MyFeatureView'))
   
   // Inside ShellLayout's Routes:
   <Route path="/my-feature" element={<ErrorBoundary><MyFeatureView /></ErrorBoundary>} />
   ```

3. **Add a nav entry in LeftRail.tsx** (if navigation-exposed):
   ```tsx
   <NavItem to="/my-feature" label="My Feature" icon={MyIcon} />
   ```

4. **Wire Command Palette** in CommandPalette.tsx if it should be discoverable via Cmd+K.

## Adding a New API Endpoint

1. **Create the route file:**
   ```
   server/routes/myResource.ts
   ```

2. **Follow the route pattern:**
   ```typescript
   import { Router } from 'express'
   import { withTable } from '../utils/withTable.js'
   
   export const myResourceRouter = Router()
   
   myResourceRouter.get('/', withTable('cast.db'), (req, res) => {
     const db = req.db
     const rows = db.prepare('SELECT * FROM my_table').all()
     res.json(rows)
   })
   
   myResourceRouter.post('/', express.json(), (req, res) => {
     const db = req.db
     const { name } = req.body
     const result = db.prepare('INSERT INTO my_table (name) VALUES (?)').run(name)
     res.json({ id: result.lastInsertRowid })
   })
   ```

3. **Register in server/routes/index.ts:**
   ```typescript
   import { myResourceRouter } from './myResource.js'
   router.use('/my-resource', myResourceRouter)
   ```

4. **Use from the frontend:**
   ```typescript
   const { data } = useQuery({
     queryKey: ['my-resource'],
     queryFn: () => apiFetch('/api/my-resource')
   })
   ```

## Testing

Tests live alongside source files:
- `src/components/MyComponent.tsx` → `src/components/MyComponent.test.tsx`
- `server/routes/sessions.ts` → `server/routes/sessions.test.ts`

**Frontend tests** use Vitest + React Testing Library:
```typescript
import { render, screen } from '@testing-library/react'
import MyComponent from './MyComponent'

it('renders with text', () => {
  render(<MyComponent />)
  expect(screen.getByText('expected text')).toBeInTheDocument()
})
```

**Backend tests** use Vitest + Supertest:
```typescript
import request from 'supertest'
import app from '../index'

it('GET /health returns 200', async () => {
  const res = await request(app).get('/health')
  expect(res.status).toBe(200)
})
```

**Run tests:**
```bash
npm test                 # Run once
npm run test:watch      # Watch mode
```

**Testing guidelines:**
- Test behavior, not implementation — use `getByRole`, `getByText`, not `getByTestId`
- Cover happy path, edge cases, and error states
- Do not mock the database unless testing error handling paths
- Keep tests under 500 lines per file; split into multiple test files if needed

## PR Checklist

- [ ] `npm test` passes locally
- [ ] `tsc -b` shows no errors (TypeScript compilation)
- [ ] No hardcoded absolute paths — use `process.cwd()`, `import.meta.url`, or paths relative to project root
- [ ] `CHANGELOG.md` updated for user-visible changes
- [ ] Components have appropriate ARIA labels if adding new UI
- [ ] API responses validated against database schema
- [ ] No console.log or debug code committed

## Good First Issues

New to the codebase? Look for issues labeled **[good-first-issue](https://github.com/ek33450505/cast-desktop/issues?q=label%3A%22good+first+issue%22)**.

Good first contributions include:
- New dashboard views or panels (self-contained, one file)
- Command Palette additions (keyboard shortcuts, new command)
- Accessibility improvements (aria-label, focus rings, keyboard nav)
- Theme polish (color tokens, spacing, animations)
- Bug fixes in isolated components

If you're unsure where to start, open an issue or comment on a good-first-issue ticket asking for guidance — we're happy to help onboard new contributors.

## Code Style

- **TypeScript**: use strict mode, avoid `any` without a comment explaining why
- **React**: functional components and hooks only, no class components
- **Imports**: group in order (React, third-party, local modules, types)
- **Naming**: PascalCase for components (`MyComponent.tsx`), camelCase for utilities (`useMyHook.ts`)
- **Tailwind**: use design tokens (CSS custom properties like `var(--text-primary)`) where possible

## Questions?

- Open an issue on [GitHub](https://github.com/ek33450505/cast-desktop)
- Check existing issues and discussions for similar questions
- See the [README](README.md) for feature overview and architecture notes

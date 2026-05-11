<!-- TODO: docs/cast-desktop-banner.png -->

# Cast Desktop

The desktop app for CAST — every signal your agents emit, all in one place.

[![Build Status](https://img.shields.io/badge/build-in_progress-orange)](https://github.com/ek33450505/cast-desktop)
![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)
![Stack](https://img.shields.io/badge/stack-Tauri+React+Express-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

> **Cast Desktop** brings the complete CAST observability surface into a single unified app — sessions, agents, hooks, memory, plans, token spend, database explorer, and a real PTY-backed terminal, all keyboard-driven, all local-first. If you're already using the CAST framework (claude-agent-team), this is the desktop companion you've been jumping between Claude Desktop and VS Code to fake. Watch your multi-agent workflows unfold in real time without context-switching.

---

## What Makes Cast Desktop Different

- **One app for everything CAST records.** Sessions, agents, hooks, memory, plans, token spend, database explorer, terminal — all in one window. No external dashboards, no separate CLI. Everything keyboard-driven.

- **Local-first, no cloud.** Reads directly from your `~/.claude/cast.db` (the CAST SQLite observability database on your machine). No SaaS, no telemetry, no account, no network required.

- **Real terminal, not a toy.** xterm.js + Rust-backed Forge PTY for full shell support, theme-aware rendering, ANSI color, and proper signal handling. The terminal lives in a collapsible drawer right next to your agent analytics.

- **Built on CAST.** Everything the CAST framework already records — agent dispatches, token spend, routing decisions, memory writes, hook audits — now has a visual surface. You're not learning a new tool; you're getting the UI for what CAST already does.

---

## Current Status

**Phase 1 — Core Backend & Dashboard Integration** is in progress.

| Wave | Scope | Status |
|------|-------|--------|
| 1 | Tauri 2.10.3 scaffold + vite config | ✓ Complete |
| 2 | Forge PTY + xterm.js stack imported | ✓ Complete |
| 3 | Dashboard absorbed (server + UI + types) | ✓ Complete |
| 4 | Sidecar wiring (Express serves dist + API) | ✓ Complete |
| 4.5 | Sidecar packaging (binary bundling) | In Progress |
| 5 | Terminal drawer integration | Planned |
| 6–8 | Polish, CI, cross-platform | Planned |

**What works today:**
```bash
npm run dev
```
Brings up Vite at `http://localhost:5173` with Express at `http://localhost:3001`. The full dashboard + API surface is functional in a browser. All data reads from `~/.claude/cast.db` (your local CAST database).

**What doesn't yet:**
- `cargo tauri build` — the packaged desktop bundle. Currently blocked on Wave 4.5 (packaging the Express sidecar with native `better-sqlite3` bindings). We're evaluating solutions (`@vercel/ncc`, `pkg`, alternative bundlers).
- Terminal drawer — UI placeholder exists; PTY wiring pending Wave 5.
- Cross-platform — Phase 4 work.
- Auto-updates — Phase 6+ polish.

---

## Installation & Running Locally

**Prerequisites:**
- Node.js 22+
- Rust toolchain (for Tauri build support)
- `npm` or `yarn`
- Optional: `bun` (needed for sidecar packaging experiments)
- CAST installed locally — `cast status` should work in your terminal

**Clone & Install:**

```bash
git clone https://github.com/ek33450505/cast-desktop.git
cd cast-desktop
npm install
cd server && npm install && npm rebuild better-sqlite3 && cd ..
npm run dev
```

**Open the app:**
- Web mode: `http://localhost:5173` — full dev experience (recommended for Phase 1)
- Tauri desktop mode: `cargo tauri dev` — currently blocked by Wave 4.5. The sidecar binary spawn in `src-tauri/src/lib.rs` panics until a working sidecar binary is in place. Use `npm run dev` for browser-mode development for now.

---

## Architecture

Cast Desktop follows **Option C: Single In-Process Sidecar**. One Express 5 backend runs inside the Tauri app and serves both the built SPA (`dist/`) and REST API endpoints (`/api/*`). The Tauri webview points at `http://localhost:3001/` in production; Vite dev mode proxies `/api` to Express running on a separate process.

```
┌─────────────────────────────────────────────┐
│  Tauri Application (macOS Binary)           │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Webview (Chromium)                 │   │
│  │  http://localhost:3001/             │   │
│  │  - React 19 SPA (dist/)             │   │
│  │  - Interactive dashboards           │   │
│  │  - Terminal drawer (xterm.js)       │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │  Express 5 Sidecar (in-process)     │   │
│  │  :3001                              │   │
│  │  - Serves dist/ (SPA root)          │   │
│  │  - /api/* routes                    │   │
│  │  - better-sqlite3 DB reads          │   │
│  │  - File watchers (chokidar)         │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
        ↓
  ~/.claude/cast.db (SQLite, local-only)
```

**Frontend:** React 19, Vite 6, TypeScript, Tailwind CSS v4, shadcn/ui components, TanStack Query v5, Recharts, Framer Motion, xterm.js, cmdk, react-resizable-panels.

**Backend (in-app):** Express 5, better-sqlite3 (SQLite driver), chokidar (file watchers for real-time DB changes).

**Port:** Hardcoded to 3001 for Phase 1 (dynamic port selection is a Phase 3 polish item).

---

## Features

### Dashboards & Analytics

**Activity Feed** — Real-time log of agent dispatches, tool calls, token spend, and routing decisions. Streams via Server-Sent Events (SSE) from cast.db watchers.

**Sessions** — Full list of Claude Code sessions with timestamp, status, agent count, and token spend. Click to drill into session details.

**Agent Analytics** — Agent run history, model tier distribution, cost breakdown by agent, thinking token allocation, success/error rates.

**Hooks** — Hook event audit trail (SessionStart, PreToolUse, PostToolUse, PostCompact). Success/failure counts, latency histograms.

**Plans** — Agent Dispatch Manifests (ADM) and orchestration history. View planned agent runs, status, and outcomes.

**Memory** — Agent memory browser with FTS5 search. Filter by agent, type (user/feedback/project/reference), or keyword. Temporal validity tracking.

**System Overview** — CAST health dashboard. cast.db size, hook health, stale memories, outdated dependencies (via cast.db logs).

**Token Spend** — Daily/weekly cost trends by agent, model tier, and session. Cost optimization recommendations.

**Database Explorer** — Full SQLite table browser. Query cast.db schema, inspect rows, export CSV (Phase 2+).

### Terminal

**Embedded Shell** — Real PTY-backed terminal (xterm.js + Rust Forge) in a resizable drawer. Run shell commands, observe file system changes, trigger agent dispatches from CLI.

**Theme Support** — Terminal respects system dark/light mode and CAST theme settings.

---

## The CAST Ecosystem

Cast Desktop is one piece of the broader CAST ecosystem. All are open-source and actively maintained.

### Core Framework & Tools

| Project | Purpose | Latest |
|---------|---------|--------|
| [**claude-agent-team**](https://github.com/ek33450505/claude-agent-team) | Local-first swarm control plane. Specialist agents, quality gates, hook enforcement. | v7.0 |
| [**cast-hooks**](https://github.com/ek33450505/cast-hooks) | 13 auditable hook scripts — observability, safety guards, quality gates. | v0.1.0 |
| [**cast-dash**](https://github.com/ek33450505/cast-dash) | Terminal UI dashboard for live swarm monitoring (Textual). | v0.1.0 |
| [**cast-claudes_journal**](https://github.com/ek33450505/cast-claudes_journal) | Session continuity — Claude's Journal auto-injects prior-day context via SessionStart hook. | v0.1.0 |
| [**claude-code-dashboard**](https://github.com/ek33450505/claude-code-dashboard) | React observability UI — sessions, agent analytics, memory browser, DB explorer, Constellation 3D graph. | v0.5.0 |

**New to CAST?** Start with [claude-agent-team](https://github.com/ek33450505/claude-agent-team) — the core framework. Cast Desktop is the visual companion once you're running CAST workflows.

---

## Roadmap

| Phase | Goals | ETA |
|-------|-------|-----|
| **Phase 1** | Backend + dashboard absorption (in progress) | Q2 2026 |
| **Phase 2** | Voice MVP (push-to-talk, real-time transcription) | Q3 2026 |
| **Phase 3** | Polish (dynamic port, Tauri native menus, keyboard shortcuts) | Q3 2026 |
| **Phase 4** | Cross-platform (Linux, Windows) | Q4 2026 |
| **Phase 5** | Sidecar packaging hardening (if binary bundling remains complex) | Q4 2026 |

**Phase 1 blockers:** Resolving Wave 4.5 packaging. The challenge: bundling the Express sidecar with native `better-sqlite3` bindings into a self-contained executable. Current investigation: `@vercel/ncc` + `esbuild`, `pkg`, and alternative compression schemes.

---

## Development

### Scripts

```bash
npm run dev              # Vite :5173 + Express :3001 (concurrent)
npm run server:dev      # Express only (tsx watch)
npm run build           # TypeScript compile + Vite build
npm run build:app       # Full Tauri app build (requires Wave 4.5 resolution)
npm run test            # Vitest
npm run test:watch      # Vitest --watch
```

### Project Structure

```
cast-desktop/
  src/
    components/           ← Terminal UI: TerminalPane.tsx, Flame.tsx
    dashboard/            ← Absorbed dashboard (Wave 3)
      api/                ← TanStack Query hooks (useSessions, useAgents, etc.)
      assets/
      components/         ← Dashboard-specific UI components
      lib/
      state/              ← Zustand stores
      types/              ← Type re-exports
      utils/              ← Helpers (modelBadge, agentCategories, etc.)
      views/              ← View components (HomeView, SessionsView, AnalyticsView, etc.)
      App.tsx             ← React Router root
      main.tsx            ← Entry point
    hooks/                ← Forge-side React hooks (useTerminal, etc.)
    themes/               ← 6 themes (forge-dark, dracula, solarized-dark, etc.)
    types/                ← Canonical shared types (ipc.ts, index.ts)
  server/
    __tests__/            ← Vitest specs
    parsers/
    routes/
    utils/
    watchers/
    constants.ts          ← PORT, CAST_DB path, etc.
    index.ts              ← Express entry point
    package.json          ← Server-side deps (Express 5, better-sqlite3, chokidar, tsx)
  src-tauri/              ← Tauri config + Rust code
    src/                  ← Rust (lib.rs, main.rs, session.rs, pty/, etc.)
    tauri.conf.json
    Cargo.toml
  dist/                   ← Vite build output (gitignored)
  package.json
  tsconfig.json
  vite.config.ts
  index.html              ← Vite entry
```

### Adding a Dashboard

To add a new view or dashboard:

1. Create `src/dashboard/views/MyView.tsx` — your React component
2. Add a lazy-loaded route in `src/dashboard/App.tsx` — use the React Router v6 lazy import pattern (see existing routes for the pattern)
3. If the view needs data, add a TanStack Query hook in `src/dashboard/api/useMyData.ts` — model after `useSessions.ts` or similar
4. If the data needs a new API route, add `server/routes/my-route.ts` and mount it in `server/routes/index.ts`

Example hook:
```typescript
// src/dashboard/api/useMyData.ts
import { useQuery } from '@tanstack/react-query'

async function fetchMyData(): Promise<MyData[]> {
  const res = await fetch('/api/my-data')
  if (!res.ok) throw new Error('Failed to fetch my data')
  return res.json()
}

export const useMyData = () =>
  useQuery({
    queryKey: ['my-data'],
    queryFn: fetchMyData,
  })
```

Example view:
```typescript
// src/dashboard/views/MyView.tsx
import { useMyData } from '../api/useMyData'

export default function MyView() {
  const { data, isLoading } = useMyData()
  if (isLoading) return <div>Loading...</div>
  return <div>{/* render data */}</div>
}
```

### Modifying the Database

All data reads from `~/.claude/cast.db`. To add a new query:

```typescript
// server/routes/my-route.ts
import Database from 'better-sqlite3'
import os from 'os'
import path from 'path'

const dbPath = path.join(os.homedir(), '.claude', 'cast.db')
const db = new Database(dbPath)

export function getMyData() {
  return db.prepare(`SELECT * FROM my_table LIMIT 100`).all()
}
```

---

## Contributing

We welcome contributions from frontend developers, Tauri enthusiasts, and folks interested in observability UIs.

**Good first issues:** Terminal drawer integration (Wave 5), database explorer enhancements, new dashboard pages, keyboard shortcut documentation.

**Development help:**
- Not sure how to start? Read [CONTRIBUTING.md](CONTRIBUTING.md) (TBD).
- Questions? Open an [issue](https://github.com/ek33450505/cast-desktop/issues).
- Found a bug? File it with reproduction steps.
- Want to add a feature? Check if an issue exists first; if not, open a discussion.

This is an open-source project — community involvement is what keeps it alive. All contributions are welcome, from code to documentation to bug reports.

---

## License

MIT — see [LICENSE](LICENSE).

---

## Author

**Edward Kubiak** — Full-stack engineer, Claude Code expert, CAST creator.

- GitHub: [@ek33450505](https://github.com/ek33450505)
- Web: [edwardkubiak.com](https://edwardkubiak.com)
- CAST Framework: [castframework.dev](https://castframework.dev)

---

## Related Reading

- **[CAST v8 Master Plan](https://github.com/ek33450505/claude-agent-team/blob/main/research/cast-v8-master-plan.md)** — Multi-year roadmap including Cast Desktop phases
- **[CAST Architecture](https://github.com/ek33450505/claude-agent-team/blob/main/docs/architecture/ARCHITECTURE.md)** — Deep dive into hook enforcement, swarm composition, audit trails
- **[Token Optimization](https://github.com/ek33450505/claude-agent-team/blob/main/docs/TOKEN-OPTIMIZATION.md)** — Cost reduction via model tiering, local routing, and response budgets

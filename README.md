<!-- TODO: docs/cast-desktop-banner.png -->

# Cast Desktop — CAST v8 Desktop UI

![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)
![Stack](https://img.shields.io/badge/stack-Tauri+React+Express-blue)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

> **Cast Desktop** brings the complete CAST observability surface into a single unified app — sessions, agents, hooks, memory, plans, token spend, database explorer, and a real PTY-backed terminal, all keyboard-driven, all local-first. If you're already using the CAST framework (claude-agent-team), this is the desktop companion you've been jumping between Claude Desktop and VS Code to fake. Watch your multi-agent workflows unfold in real time without context-switching.

---

## What Ships Today

- **Complete CAST Dashboard** — Activity feed, sessions, agents, analytics, hooks, plans, memory browser, system health, token spend, database explorer, and docs view. All fed by your local `~/.claude/cast.db` (no cloud).
- **Modern Terminal** — PTY-backed xterm with keyboard shortcuts (Cmd+F search, Cmd+K clear, Cmd+=/-, tab cycling, folder picker), theme-aware rendering, ANSI color, and proper signal handling. Terminal lives in a resizable drawer.
- **Design Language Locked** — Forest-at-dusk (dark) and sunrise (light) themes applied across UI, with user-first eye comfort as the design north star.
- **819 Tests** — Full Vitest + React Testing Library coverage for frontend and backend; verified on every commit.

---

## Core Features

### Dashboards & Analytics

| View | Purpose |
|------|---------|
| **Activity** | Real-time log of agent dispatches, tool calls, token spend, routing decisions. Streams via SSE from cast.db watchers. |
| **Sessions** | Full session list with timestamp, status, agent count, token spend. Drill into session details with isolation per sessionId. |
| **Analytics** | Agent run history, model tier distribution, cost breakdown by agent, thinking token allocation, success/error rates. |
| **Agents** | Agent roster with model tier, status, memory pool, and per-agent performance metrics. |
| **Hooks** | Hook event audit trail (SessionStart, PreToolUse, PostToolUse, PostCompact). Success/failure counts, latency histograms. |
| **Plans** | Agent Dispatch Manifests (ADM) and orchestration history. View planned agent runs, status, and outcomes. |
| **Memory** | Agent memory browser with FTS5 search. Filter by agent, type (user/feedback/project/reference), or keyword. Temporal validity tracking. |
| **System** | CAST health dashboard. cast.db size, hook health, stale memories, cost trends with cast.db pricing data. |
| **Token Spend** | Daily/weekly cost trends by agent, model tier, and session. Cost optimization recommendations. |
| **Database** | SQLite browser for cast.db. Inspect rows, view schema, debug queries. |
| **Docs** | Markdown viewer with frontmatter parsing for CAST documentation. Inline file links, modal previews. |

### Terminal Features

**Keyboard Shortcuts:**

| Shortcut | Action |
|----------|--------|
| **Cmd+F** | Open search overlay (find text in terminal buffer) |
| **Cmd+K** | Clear terminal (when xterm focused) |
| **Cmd+** (equals) | Increase font size (persists to localStorage) |
| **Cmd−** (minus) | Decrease font size (persists to localStorage) |
| **Cmd+0** | Reset to default font size |
| **Cmd+Shift+]** | Cycle to next terminal tab |
| **Cmd+Shift+[** | Cycle to previous terminal tab |
| **Cmd+T** | New tab (opens in home directory) |
| **Cmd+Shift+T** | New tab with folder picker (Tauri dialog) |
| **Cmd+W** | Close active tab |
| **Cmd+D** | Toggle terminal visibility |

**Terminal Capabilities:**
- Real Forge PTY (portable-pty) for full shell support
- xterm.js with search, link detection, and texture atlas optimization
- Tab auto-titles from cwd/cmd/sessionId; inline rename (right-click/double-click)
- Tab coloring via visual indicator
- Theme-aware (dusk & dawn) with reactive appearance toggle
- Bracketed paste confirmation for multi-line clipboard input
- RAFrame-batched PTY writes for smooth rendering
- Font size hotkeys with localStorage persistence

---

## Installation & Running Locally

**Prerequisites:**
- Node.js 22+
- Rust toolchain (for Tauri)
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
```bash
# Browser dev mode (recommended for development)
http://localhost:5173

# Tauri desktop (packaged binary)
cargo tauri dev
```

The full dashboard + API surface is functional in both modes. All data reads from `~/.claude/cast.db` (your local CAST database).

---

## Architecture

Cast Desktop follows **Option C: Single In-Process Sidecar**. One Express 5 backend runs inside the Tauri app and serves both the built SPA and REST API endpoints.

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

**Frontend:** React 19, Vite 6, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Query v5, Recharts, Framer Motion, xterm.js, cmdk, react-resizable-panels.

**Backend:** Express 5, better-sqlite3, chokidar, Tauri 2.10.3.

**Tauri Plugins:** dialog (for folder picker), log.

---

## Project Structure

```
cast-desktop/
  src/
    components/
      terminal/               ← Terminal UI (TerminalPane, TerminalTabs, etc.)
      CommandPalette.tsx      ← Global Cmd+K palette
    dashboard/
      views/                  ← Dashboard pages (ActivityView, SessionsView, etc.)
      api/                    ← TanStack Query hooks
      components/             ← Dashboard-specific UI
      state/                  ← Zustand stores
      types/                  ← Type definitions
      utils/                  ← Helpers
      App.tsx                 ← Router root
    hooks/                    ← useTerminal, useAppearance, etc.
    stores/                   ← Zustand terminal + appearance state
    themes/                   ← Theme definitions (dusk, dawn)
  server/
    __tests__/                ← API and utility tests
    routes/                   ← Express API endpoints
    parsers/                  ← Frontmatter parser, data transformers
    watchers/                 ← SSE stream watchers for cast.db
    constants.ts              ← PORT, CAST_DB path
    index.ts                  ← Express entry
  src-tauri/
    src/                      ← Rust (PTY, signal handling)
    tauri.conf.json
    Cargo.toml
  package.json
  vite.config.ts
```

---

## Development

```bash
npm run dev              # Vite :5173 + Express :3001 (concurrent)
npm run server:dev      # Express only (tsx watch)
npm run build           # TypeScript compile + Vite build
npm run build:app       # Full Tauri app build
npm test                # Vitest
npm test:watch          # Vitest watch mode
```

---

## Roadmap

| Phase | Goals | Status |
|-------|-------|--------|
| **Phase 3.5** | Broken button audit (Sessions delete, POST routes for editability) | ✓ Complete |
| **Phase 4 (Slice 1)** | Terminal modernization (Cmd+F, Cmd+K clear, font hotkeys, tab cycling, folder picker) | ✓ Complete |
| **Phase 4 (Slice 2)** | Native macOS menu bar, file editor, in-app agent run UI | In Progress |
| **Phase 5** | Federal a11y audit, mobile responsive, file upload/edit capability | Planned |
| **Phase 6** | Cross-platform (Linux, Windows) | Planned |

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

## Testing

**61 test files with 819 test cases** across frontend dashboards, terminal components, server routes, and utilities. Verified on every commit with Vitest + React Testing Library.

```bash
npm test          # Run all tests
npm test:watch    # Watch mode
```

---

## Contributing

We welcome contributions from frontend developers, Tauri enthusiasts, and folks interested in observability UIs.

**Good first issues:** Keyboard shortcut documentation, database explorer enhancements, new dashboard pages, a11y improvements.

**Development help:**
- Not sure how to start? Open an [issue](https://github.com/ek33450505/cast-desktop/issues).
- Found a bug? File it with reproduction steps.
- Want to add a feature? Check if an issue exists first; if not, open a discussion.

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

- **[CAST Architecture](https://github.com/ek33450505/claude-agent-team/blob/main/docs/architecture/ARCHITECTURE.md)** — Deep dive into hook enforcement, swarm composition, audit trails
- **[CAST Token Optimization](https://github.com/ek33450505/claude-agent-team/blob/main/docs/TOKEN-OPTIMIZATION.md)** — Cost reduction via model tiering, local routing, and response budgets
- **[Cast Desktop Design Language](docs/design-language.md)** — Theme system, component tokens, accessibility (TBD)

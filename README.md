<!-- TODO: add banner screenshot -->

# Cast Desktop

![Version](https://img.shields.io/badge/version-1.0.0-blue) ![Platform](https://img.shields.io/badge/platform-macOS-lightgrey) ![License](https://img.shields.io/badge/license-MIT-lightgrey) ![Tests](https://img.shields.io/badge/vitest%20%2F%20rtl-1075%20passing-brightgreen)

**Your agents, in the room.**

Cast Desktop is a Tauri 2 desktop app that brings real-time observability for the [CAST multi-agent framework](https://github.com/ek33450505/claude-agent-team) into a unified, keyboard-driven interface. Sessions, agents, hooks, memory, plans, token spend, database browser, and a fully featured terminal—all fed from your local `~/.claude/cast.db`, no cloud, no telemetry. If you're orchestrating Claude Code agents, Cast Desktop is the visual companion you've been jumping between terminals and VS Code to emulate.

---

## What's Included

- **10 Dashboard Views** — Activity feed, sessions, analytics, agents, hooks, plans, memory browser, system health, token spend, database explorer
- **Real PTY-Backed Terminal** — xterm with tabs, Cmd+F search, font hotkeys, folder picker, theme-aware rendering, full ANSI support
- **Two Themes** — forest-at-dusk (dark) and sunrise (light), designed for 8-hour daily use with eye comfort as the north star
- **1075 Tests** — Full Vitest + React Testing Library coverage across frontend and backend, verified on every commit
- **Keyboard-First** — Command palette (Cmd+K), global shortcuts, no mouse required for power users
- **Local-First** — All data lives in `~/.claude/cast.db` (SQLite). No accounts, no cloud, no data collection

---

## Quick Start

### Install via Homebrew (Recommended)

```bash
brew install --cask ek33450505/cast-desktop/cast-desktop
```

The app opens to your local CAST database immediately. No configuration needed.

### Build from Source

```bash
git clone https://github.com/ek33450505/cast-desktop.git
cd cast-desktop
npm install
cd server && npm install && npm rebuild better-sqlite3 && cd ..
npm run dev
```

Then open http://localhost:5173 in your browser or run `cargo tauri dev` for the packaged desktop app.

### Prerequisites

- **Node.js 22+**
- **Rust 1.80+** (for Tauri compilation)
- **Bun** (for sidecar builds)
- **CAST installed** — `cast status` should work in your terminal
- **typescript-language-server** in PATH (for LSP/IDE features):
  ```bash
  npm install -g typescript-language-server
  ```

---

## Features

### Dashboard Views

| View | What it Does |
|------|--------------|
| **Activity** | Real-time log of agent dispatches, tool calls, token spend, routing decisions. Streams via SSE. |
| **Sessions** | Full session list with status, agent count, and token spend. Drill into session details. |
| **Analytics** | Agent run history, model distribution, cost breakdown, thinking token allocation, success rates. |
| **Agents** | Agent roster with model tier, status, memory pool, and per-agent performance metrics. |
| **Hooks** | Hook event audit trail (SessionStart, PreToolUse, PostToolUse, PostCompact) with latency histograms. |
| **Plans** | Agent Dispatch Manifests and orchestration history. View planned runs and outcomes. |
| **Memory** | Agent memory browser with FTS5 search. Filter by agent, type, or keyword. |
| **System** | CAST health dashboard. Database size, hook health, cost trends. |
| **Token Spend** | Daily/weekly cost trends by agent and model. Cost optimization recommendations. |
| **Database** | SQLite browser for cast.db. Inspect rows, view schema, debug queries. |

### Terminal Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Cmd+K** | Clear terminal |
| **Cmd+F** | Find text in buffer |
| **Cmd+=** / **Cmd−** | Increase / decrease font size |
| **Cmd+0** | Reset font size |
| **Cmd+Shift+]** / **Cmd+Shift+[** | Cycle to next / previous tab |
| **Cmd+T** | New tab in home directory |
| **Cmd+Shift+T** | New tab with folder picker |
| **Cmd+W** | Close active tab |
| **Cmd+D** | Toggle terminal visibility |

**Terminal Capabilities:**
- Real Forge PTY (portable-pty) for full shell support
- xterm.js with search overlay, link detection, texture atlas optimization
- Auto-title tabs from current working directory / command
- Tab rename via right-click or double-click
- Theme-aware rendering (dusk/dawn) with instant toggle
- Bracketed paste confirmation for safe multi-line input
- Font size persistence to localStorage

---

## Architecture

Cast Desktop runs as a single in-process application: a Tauri 2 shell with an embedded Express 5 backend, communicating with your local CAST database via better-sqlite3.

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

**Stack:**
- **Frontend:** React 19, Vite 6, TypeScript, Tailwind CSS v4, shadcn/ui, TanStack Query v5, Recharts, Framer Motion, xterm.js, cmdk, react-resizable-panels
- **Backend:** Express 5, better-sqlite3, chokidar, Tauri 2.10.3
- **Tauri Plugins:** dialog (folder picker), log

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
npm run build:app       # Full Tauri app build (macOS binary)
npm test                # Run all tests (Vitest)
npm test:watch          # Watch mode
```

---

## Testing

**1075 passing tests** across 88 test files — frontend dashboards, terminal components, server routes, utilities.

```bash
npm test          # Run all tests
npm test:watch    # Watch mode
```

---

## Contributing

We welcome contributions. Good first issues: keyboard shortcut documentation, database explorer enhancements, new dashboard pages, accessibility improvements.

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## The CAST Ecosystem

Cast Desktop is one piece of the broader CAST multi-agent framework.

| Project | Purpose | Latest |
|---------|---------|--------|
| [**claude-agent-team**](https://github.com/ek33450505/claude-agent-team) | Local-first multi-agent control plane. Specialist agents, quality gates, hook enforcement. | v7.0 |
| [**cast-hooks**](https://github.com/ek33450505/cast-hooks) | 13 auditable hook scripts — observability, safety guards, quality gates. | v0.1.0 |
| [**cast-dash**](https://github.com/ek33450505/cast-dash) | Terminal UI dashboard for live agent monitoring (Textual). | v0.1.0 |
| [**cast-claudes_journal**](https://github.com/ek33450505/cast-claudes_journal) | Session continuity — Claude's Journal auto-injects prior-day context via SessionStart hook. | v0.1.0 |
| [**claude-code-dashboard**](https://github.com/ek33450505/claude-code-dashboard) | React observability UI — sessions, analytics, memory browser, database explorer. | v0.5.0 |

**New to CAST?** Start with [claude-agent-team](https://github.com/ek33450505/claude-agent-team) — the core framework. Cast Desktop is the visual companion once you're running CAST workflows.

---

## License

MIT — see [LICENSE](LICENSE).

---

## Author

**Edward Kubiak** — Full-stack engineer, Claude Code expert, CAST creator.

- GitHub: [@ek33450505](https://github.com/ek33450505)
- Web: [edwardkubiak.com](https://edwardkubiak.com)
- CAST: [claude-agent-team](https://github.com/ek33450505/claude-agent-team)

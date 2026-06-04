# Cast Desktop

[![Version](https://img.shields.io/github/v/release/ek33450505/cast-desktop?color=blue&label=version)](https://github.com/ek33450505/cast-desktop/releases/latest) [![CI](https://github.com/ek33450505/cast-desktop/actions/workflows/release.yml/badge.svg)](https://github.com/ek33450505/cast-desktop/actions/workflows/release.yml) ![Platform](https://img.shields.io/badge/platform-macOS-lightgrey) ![License](https://img.shields.io/badge/license-MIT-lightgrey) ![Tests](https://img.shields.io/badge/vitest%20%2F%20rtl-1222%20passing-brightgreen)

**Your agents, in the room.**

Cast Desktop is a Tauri 2 desktop app that brings real-time observability for the [CAST multi-agent framework](https://github.com/ek33450505/claude-agent-team) into a unified, keyboard-driven interface. Sessions, agents, hooks, memory, plans, token spend, database browser, and a fully featured terminal—all fed from your local `~/.claude/cast.db`, no cloud, no telemetry. If you're orchestrating Claude Code agents, Cast Desktop is the visual companion you've been jumping between terminals and VS Code to emulate.

---

## What's Included

- **11 Dashboard Views** — Activity feed, sessions, analytics, agents, hooks, plans, memory browser, system health, token spend, database explorer, and integrated `~/.claude` vault viewer for agent definitions, plans, rules, and memory
- **Real PTY-Backed Terminal** — xterm with tabs, Cmd+F search, font hotkeys, folder picker, theme-aware rendering, full ANSI support
- **In-App Markdown Editor** — CodeMirror 6 editor for `~/.claude/**` files. Cmd+S to save agent definitions, plans, and rules without leaving the app
- **Two Themes** — forest-at-dusk (dark) and sunrise (light), designed for 8-hour daily use with eye comfort as the north star
- **1222 Tests across 107 test files on frontend and backend, verified on every commit
- **Native macOS Menu Bar** — File / Edit / View / Tabs / Window / Help menus wired to in-app actions. Cmd+T, Cmd+Shift+]/ [ and the full keybind set backed by native OS accelerators
- **Keyboard-First** — Command palette (Cmd+K), global shortcuts, no mouse required for power users
- **Local-First** — All data lives in `~/.claude/cast.db` (SQLite). No accounts, no cloud, no data collection

---

## Quick Start

### Install via Homebrew

```bash
brew tap ek33450505/cast
brew install --cask ek33450505/cast/cast-desktop
```

The app opens to your local CAST database immediately. No configuration needed. The cask handles macOS Gatekeeper automatically — no extra steps required.

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

**To install and run Cast Desktop (binary):**
- macOS (Apple Silicon) — no other dependencies required
- Cast Desktop v1.2.0 includes an onboarding screen that guides you through CAST setup if it isn't installed yet

**To build from source:**
- **Node.js 22+**
- **Rust 1.80+** (for Tauri compilation)
- **Bun** (for sidecar builds)
- **typescript-language-server** in PATH (for LSP/IDE features):
  ```bash
  npm install -g typescript-language-server
  ```

**For full functionality** (live agent data, session tracking):
- **CAST installed** — `cast status` should work in your terminal. See [claude-agent-team](https://github.com/ek33450505/claude-agent-team).

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

**1222 passing tests** across 107 test files — frontend dashboards, terminal components, server routes, utilities.

```bash
npm test          # Run all tests
npm test:watch    # Watch mode
```

---

## Contributing

We welcome contributions. Good first issues: keyboard shortcut documentation, database explorer enhancements, new dashboard pages, accessibility improvements.

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## CAST Ecosystem

> Auto-synced from [claude-agent-team/docs/ecosystem.md](https://github.com/ek33450505/claude-agent-team/blob/main/docs/ecosystem.md). Run `~/Projects/personal/claude-agent-team/scripts/sync-ecosystem-readme.sh` to refresh.

<!-- ECOSYSTEM_START -->
| Repo | Description | Latest | Install |
|---|---|---|---|
| [cast-hooks](https://github.com/ek33450505/cast-hooks) | 13 auditable hook scripts — observability, safety guards, quality gates. SessionStart, PreToolUse, PostToolUse, PostCompact. | ![](https://img.shields.io/github/v/release/ek33450505/cast-hooks?style=flat-square) | `brew tap ek33450505/cast-hooks && brew install cast-hooks` |
| [cast-agents](https://github.com/ek33450505/cast-agents) | 23 specialist agents — commit, debug, review, plan, test, research, and more. Agent definitions with YAML frontmatter. v7-synced. | ![](https://img.shields.io/github/v/release/ek33450505/cast-agents?style=flat-square) | `brew tap ek33450505/cast-agents && brew install cast-agents` |
| [cast-memory](https://github.com/ek33450505/cast-memory) | Persistent agent memory with FTS5 search, relevance scoring, shared pool, semantic embeddings. Per-agent knowledge accumulation. | ![](https://img.shields.io/github/v/release/ek33450505/cast-memory?style=flat-square) | `brew tap ek33450505/cast-memory && brew install cast-memory` |
| [cast-routines](https://github.com/ek33450505/cast-routines) | Scheduled autonomous Claude Code routines via YAML + cron. Daily briefings, inbox triage, release celebration, weekly cost reports. | ![](https://img.shields.io/github/v/release/ek33450505/cast-routines?style=flat-square) | `brew tap ek33450505/cast-routines && brew install cast-routines` |
| [cast-parallel](https://github.com/ek33450505/cast-parallel) | Parallel agent execution across worktree sessions. Agent Dispatch Manifest (ADM) support. | ![](https://img.shields.io/github/v/release/ek33450505/cast-parallel?style=flat-square) | `brew tap ek33450505/cast-parallel && brew install cast-parallel` |
| [cast-observe](https://github.com/ek33450505/cast-observe) | Session-level observability — cost tracking, agent run history, token spend, event sourcing. Feeds cast.db. | ![](https://img.shields.io/github/v/release/ek33450505/cast-observe?style=flat-square) | `brew tap ek33450505/cast-observe && brew install cast-observe` |
| [cast-security](https://github.com/ek33450505/cast-security) | Security hooks and audit trails. PII redaction, parry-guard integration, compliance logging. | ![](https://img.shields.io/github/v/release/ek33450505/cast-security?style=flat-square) | `brew tap ek33450505/cast-security && brew install cast-security` |
| [cast-doctor](https://github.com/ek33450505/cast-doctor) | Read-only health check for any Claude Code install. Validates hooks, MCP servers, agent frontmatter, cast.db schema, stale memories. | ![](https://img.shields.io/github/v/release/ek33450505/cast-doctor?style=flat-square) | `brew tap ek33450505/cast-doctor && brew install cast-doctor` |
| [cast-time](https://github.com/ek33450505/cast-time) | Gives Claude Code a clock — injects local time, timezone, and a semantic time-of-day bucket at every SessionStart. | ![](https://img.shields.io/github/v/release/ek33450505/cast-time?style=flat-square) | `brew tap ek33450505/cast-time && brew install cast-time` |
| [cast-dash](https://github.com/ek33450505/cast-dash) | Terminal UI dashboard for live swarm monitoring. 4-panel real-time display (Textual framework). | ![](https://img.shields.io/github/v/release/ek33450505/cast-dash?style=flat-square) | `brew tap ek33450505/cast-dash && brew install cast-dash` |
| [cast-claudes_journal](https://github.com/ek33450505/cast-claudes_journal) | Session continuity — Claude's Journal auto-injects prior-day context via SessionStart hook. Obsidian vault sync. | ![](https://img.shields.io/github/v/release/ek33450505/cast-claudes_journal?style=flat-square) | `brew tap ek33450505/homebrew-claudes-journal && brew install claudes-journal` |
| [cast-website](https://github.com/ek33450505/cast-website) | castframework.dev — marketing site and docs portal for the CAST ecosystem. | ![](https://img.shields.io/github/v/release/ek33450505/cast-website?style=flat-square) | — |
| [cast-desktop](https://github.com/ek33450505/cast-desktop) | Tauri 2 native app — embedded PTY terminal, command palette, 11 dashboard views, Constellation 3D graph. NEW. | ![](https://img.shields.io/github/v/release/ek33450505/cast-desktop?style=flat-square) | `brew tap ek33450505/homebrew-cast-desktop && brew install cast-desktop` |
<!-- ECOSYSTEM_END -->

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

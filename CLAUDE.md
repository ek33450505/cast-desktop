# cast-desktop

## Install

```bash
npm install
cd server && npm install && npm rebuild better-sqlite3 && cd ..
```

## Run

```bash
npm run dev          # Vite :5173 + Express :3001 (concurrent)
```

For the packaged Tauri desktop app: `cargo tauri dev` (requires Rust 1.80+).

## Test

```bash
npm test             # Vitest run (all tests)
npm run test:watch   # Watch mode
```

## Build

```bash
npm run build          # TypeScript + Vite frontend build only
npm run build:server   # Express backend build only
npm run build:app      # Full Tauri macOS binary (runs all of the above + cargo tauri build)
```

Sidecar builds (`build:sidecar`, `build:lsp-sidecar`, `build:sidecars`) require **Bun** in PATH — they compile the Express server and LSP sidecar to standalone binaries targeting `aarch64-apple-darwin`.

## Non-obvious

- `docs/` contains design language/token files only — not user-facing documentation.
- `better-sqlite3` is a native module; after `npm install` you may need `npm rebuild better-sqlite3` inside `server/` if the binding fails to load.
- `typescript-language-server` must be in PATH for LSP/IDE features in the in-app editor.
- All data reads from `~/.claude/cast.db` — the app is read-only against the DB by design.
- Badge/README test counts reflect the last verified run; re-run `npm test` to get current numbers.

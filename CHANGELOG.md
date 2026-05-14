# Changelog

All notable changes to Cast Desktop are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] — 2026-05-14

Cast Desktop v0.1.0 is the initial public release of Cast Desktop, a Tauri 2 desktop application for the CAST observability framework. This release bundles Phases 1–4 of development, including terminal multiplexing, file browser integration, real-time activity panels, design language lock-in, and terminal modernization.

### Phase 4 — Terminal Modernization & CWD Picker

**Added**
- Cmd+F terminal search overlay with live search, prev/next navigation, and debounce to prevent regex blocking ([f6b29da](https://github.com/ek33450505/cast-desktop/commit/f6b29da), [7eab854](https://github.com/ek33450505/cast-desktop/commit/7eab854))
- Modern terminal keybinds: Cmd+K clear (with focus guard to avoid palette collision), Cmd+= / Cmd+- / Cmd+0 for font size adjustment with localStorage persist ([f6b29da](https://github.com/ek33450505/cast-desktop/commit/f6b29da))
- Cmd+Shift+] / Cmd+Shift+[ for tab cycling across open terminal panes ([f6b29da](https://github.com/ek33450505/cast-desktop/commit/f6b29da))
- Bracketed-paste confirmation banner with Cmd+V interception, clipboard read, and line-count detection to prevent accidental multi-line pastes ([f6b29da](https://github.com/ek33450505/cast-desktop/commit/f6b29da))
- Cmd+Shift+T folder picker for new-tab cwd selection via Tauri dialog plugin, useRecentDirs LRU hook, and FolderPickerModal component ([7eab854](https://github.com/ek33450505/cast-desktop/commit/7eab854))

**Changed**
- Terminal font size utilities extracted to standalone module with localStorage error handling and boundary clamping ([f6b29da](https://github.com/ek33450505/cast-desktop/commit/f6b29da))
- xterm SearchAddon wiring completed; search input bounded with maxLength=200 to prevent pathological regex queries ([f6b29da](https://github.com/ek33450505/cast-desktop/commit/f6b29da))

**Accessibility**
- Search overlay and paste banner respect `prefers-reduced-motion` media query ([f6b29da](https://github.com/ek33450505/cast-desktop/commit/f6b29da))
- PasteConfirmBanner wired as ARIA alert dialog with Esc/Enter keybinds and semantic button roles ([f6b29da](https://github.com/ek33450505/cast-desktop/commit/f6b29da))

---

### Phase 3.5 — Broken Controls Audit & Strict Session Isolation

**Added**
- PreviewModal pattern applied across Rules, Memory, Hooks, and Agents pages to replace stale inline preview pane ([7433a6a](https://github.com/ek33450505/cast-desktop/commit/7433a6a))
- LeftRail scroll-to-section affordance for large file trees ([7433a6a](https://github.com/ek33450505/cast-desktop/commit/7433a6a))
- cast-db guard preventing database access in test environments; dev-only seed gate ([7433a6a](https://github.com/ek33450505/cast-desktop/commit/7433a6a))

**Fixed**
- Cmd+K palette items with stub destinations are now hidden until ready, reducing discoverability friction ([7433a6a](https://github.com/ek33450505/cast-desktop/commit/7433a6a))
- Strict sessionId gating across right-rail panels (PlanProgressPanel, CostPanel, AgentsPanel) to prevent cross-session data leakage ([73a1be5](https://github.com/ek33450505/cast-desktop/commit/73a1be5))
- PlanProgressPanel null-guard against unbound terminal panes in multi-pane scenarios ([7df1d9e](https://github.com/ek33450505/cast-desktop/commit/7df1d9e))

---

### Phase 3 — Visual Polish & Modal-Load Sweep

#### Wave 6 — Terminal Tab Coloring & UI Affordances

**Added**
- Terminal tab color coding for visual pane identification across multi-tab layouts ([3c7e8f1](https://github.com/ek33450505/cast-desktop/commit/3c7e8f1))
- "..." button (TabOptionsMenu) discoverability pass with improved visual affordance ([3c7e8f1](https://github.com/ek33450505/cast-desktop/commit/3c7e8f1))

#### Wave 5 — Modal-Load Sweep & TopBar Enhancements

**Added**
- SystemView modal-load pattern: pricing, hooks, agents, and other dashboard pages now load content via PreviewModal instead of full-page navigation ([c0ff490](https://github.com/ek33450505/cast-desktop/commit/c0ff490))
- Live clock and date display in TopBar header for session context ([c0ff490](https://github.com/ek33450505/cast-desktop/commit/c0ff490))

#### Wave 4 — Terminal Performance Improvements

**Performance**
- xterm PTY writes now batched via RAF (requestAnimationFrame) to prevent renderer thread blocking on high-throughput terminal output ([b361db9](https://github.com/ek33450505/cast-desktop/commit/b361db9))
- Texture atlas cleared after xterm fit operation to prevent stale glyph cache issues on resize ([b361db9](https://github.com/ek33450505/cast-desktop/commit/b361db9))

#### Wave 3 — System Cost Analytics

**Added**
- System page pricing tab populated with real cast.db cost data; analytics suite rethink with chart-color hook ([67d20b8](https://github.com/ek33450505/cast-desktop/commit/67d20b8), [4836bf5](https://github.com/ek33450505/cast-desktop/commit/4836bf5))

#### Wave 2 — PreviewBody Frontmatter Parser Fix

**Fixed**
- PreviewBody frontmatter parser block-scalar continuation bug (normalized multiline frontmatter in markdown metadata) ([e1c1c08](https://github.com/ek33450505/cast-desktop/commit/e1c1c08))

#### Wave 3.3 — Design Language & Terminal Appearance State

**Fixed**
- Terminal xterm texture atlas cleared on appearance change to prevent theme-flip visual glitches ([ce02b89](https://github.com/ek33450505/cast-desktop/commit/ce02b89))
- xterm forced repaint and container background correction on light/dark mode toggle ([3debcf4](https://github.com/ek33450505/cast-desktop/commit/3debcf4))

#### Design Language Migration (Stages 1–5b)

**Added**
- Cast design language foundation with semantic color tokens (forest-at-dusk dark theme, sunrise light theme) aligned to eye-comfort requirements for 8h/day terminal usage ([c2c8a5f](https://github.com/ek33450505/cast-desktop/commit/c2c8a5f))
- Palette lock-in: accent (#00FFC2), extended color semantic mappings, reduced saturation for long-dwell surfaces ([c2c8a5f](https://github.com/ek33450505/cast-desktop/commit/c2c8a5f))
- Day mode (dawn) unlock with adjusted lightness values ([c2c8a5f](https://github.com/ek33450505/cast-desktop/commit/c2c8a5f))
- Design language token migration across right-rail (Stage 3), left-rail (Stage 4), and full dashboard (Stage 5a–5b) ([a061dde](https://github.com/ek33450505/cast-desktop/commit/a061dde), [257bf30](https://github.com/ek33450505/cast-desktop/commit/257bf30), [4836bf5](https://github.com/ek33450505/cast-desktop/commit/4836bf5), [a68b6ae](https://github.com/ek33450505/cast-desktop/commit/a68b6ae))

**Changed**
- Cast brand placeholder system mark introduced, lowercase casing sweep across UI ([7663ff2](https://github.com/ek33450505/cast-desktop/commit/7663ff2))
- Terminal reactive theme on appearance toggle ([c3c3245](https://github.com/ek33450505/cast-desktop/commit/c3c3245))
- Dawn font darkening to improve contrast on light backgrounds ([c3c3245](https://github.com/ek33450505/cast-desktop/commit/c3c3245))

#### Wave 3.2 — Terminal Tab Auto-Titles & Inline Rename

**Added**
- Terminal tab auto-titling from cwd, command, and sessionId with inline double-click rename UX ([0b648bf](https://github.com/ek33450505/cast-desktop/commit/0b648bf))

#### Phase 2 — Right-Rail Activity Panels & Architecture

**Added**
- Wave 2.1: Three-pane layout shell (terminal, left-rail, right-rail) with responsive drawer support ([ce651d5](https://github.com/ek33450505/cast-desktop/commit/ce651d5))
- Wave 2.2a: Tabbed PTY terminal foundation with tab creation/close/selection logic ([3048eaf](https://github.com/ek33450505/cast-desktop/commit/3048eaf))
- Wave 2.2b: Multi-tab UI with Cmd+T / Cmd+W keybinds, native Tauri font menu, and macOS menu bar fixes ([07f87d7](https://github.com/ek33450505/cast-desktop/commit/07f87d7))
- Wave 2.3a: Cast file tree with inline preview pane showing Cast config and documentation files ([d547adb](https://github.com/ek33450505/cast-desktop/commit/d547adb))
- Wave 2.3b: Project tree modal preview, skills and commands list view improvements ([0eabe66](https://github.com/ek33450505/cast-desktop/commit/0eabe66))
- Wave 2.4: PTY ↔ Claude session binding via CAST_DESKTOP_PANE_ID environment variable and pane_bindings database table ([6f4a2d5](https://github.com/ek33450505/cast-desktop/commit/6f4a2d5))
- Wave 2.5: Plan progress panel with live SSE updates showing agent run status and completion tracking ([72cc478](https://github.com/ek33450505/cast-desktop/commit/72cc478))
- Wave 2.6: Live agents panel with agent detail modal, real-time activity tracking from cast.db ([10f71ea](https://github.com/ek33450505/cast-desktop/commit/10f71ea))
- Wave 2.7: Cost analytics panel and dashboard tiles pulling real cast.db observability data ([e1f33d7](https://github.com/ek33450505/cast-desktop/commit/e1f33d7))
- Wave 2.11: Cmd+K command palette with 8 stub route scaffolds for future features ([9b85bd5](https://github.com/ek33450505/cast-desktop/commit/9b85bd5))
- Wave 2.13: SSE event multiplexing (12 EventSources → single /api/events stream) reducing client connection overhead ([b4b2d6a](https://github.com/ek33450505/cast-desktop/commit/b4b2d6a))

**Changed**
- All sidebar files now open in modal (PreviewModal) instead of inline PreviewPane, improving UX consistency ([c0019d1](https://github.com/ek33450505/cast-desktop/commit/c0019d1))
- LeftRail header now dynamically displays project basename instead of static branding ([0e4b473](https://github.com/ek33450505/cast-desktop/commit/0e4b473))
- Expanded nav sections now capped with max-height and scrollable overflow to prevent layout crush ([ce79462](https://github.com/ek33450505/cast-desktop/commit/ce79462))

**Fixed**
- Modal font sizes bumped to improve readability on large display content ([7ac352c](https://github.com/ek33450505/cast-desktop/commit/7ac352c))

**Accessibility**
- Phase 2 wrap: PreviewModal aria-labelledby attribute and reduced-motion guard for all motion-dependent components ([a2afe88](https://github.com/ek33450505/cast-desktop/commit/a2afe88))

---

### Phase 1 — Backend Absorption & Tauri Foundation

**Added**
- Bootstrap Tauri v2.10.3 desktop scaffold with Vite 6 frontend and Express 5 API sidecar ([39dbc8a](https://github.com/ek33450505/cast-desktop/commit/39dbc8a))
- xterm.js + Forge PTY terminal stack for native terminal multiplexing ([2aac773](https://github.com/ek33450505/cast-desktop/commit/2aac773))
- Tauri sidecar spawn for Express server with build-on-demand scripts (binary packaging deferred) ([e1b7a80](https://github.com/ek33450505/cast-desktop/commit/e1b7a80))
- Absorb claude-code-dashboard source and apply Tauri v2 compatibility fixes ([79b44a2](https://github.com/ek33450505/cast-desktop/commit/79b44a2))

**Fixed**
- npm run dev unblocked for Express 5 + ESM compatibility ([5bf9e21](https://github.com/ek33450505/cast-desktop/commit/5bf9e21))
- Auto-seed and JSON body limit fixes for sidecar Express server ([a96f502](https://github.com/ek33450505/cast-desktop/commit/a96f502))

**Documentation**
- Real README with audience, status, ecosystem, and contributing guidelines ([aae8d18](https://github.com/ek33450505/cast-desktop/commit/aae8d18))
- GitHub issue templates, PR template, and CODEOWNERS file ([3fd3a34](https://github.com/ek33450505/cast-desktop/commit/3fd3a34))

---

## Contributing

Cast Desktop is a portfolio piece built with product discipline. See [CONTRIBUTING.md](./CONTRIBUTING.md) for development guidelines.

## License

Cast Desktop is part of the CAST framework. See [LICENSE](./LICENSE) for details.

---

**Full Changelog:** [v0.1.0 commits](https://github.com/ek33450505/cast-desktop/commits/main)

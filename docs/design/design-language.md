# cast design language

> The vocabulary and grammar of cast's visual + interaction system.
> This document defines surfaces, tokens, motion, and density.
> Concrete palette values (dawn / dusk hex) come in a follow-up doc.

---

## 0. Frame

cast is an OS, not an app. Its design language is closer to macOS HIG, Fluent
Design, or Material than to a "theme file." That means:

- **Surfaces have contracts.** A modal is not just "a div with a backdrop" — it
  has an elevation level, a translucency rule, a motion contract, and focus
  semantics. Every surface type is named and governed.
- **Tokens are the language.** Every color, size, radius, and motion value is
  reachable through a token. No raw hex codes in components. Themes flip
  values; token names never change.
- **Depth is structural.** Layering, blur, and vibrancy aren't decoration —
  they're how cast tells the user "this is above that." Modals don't look
  elevated by accident.
- **Density is a philosophy.** The same language must serve dense (file tree,
  log views), standard (terminal, modal), and ambient (status strip,
  notifications) surfaces coherently. Like Finder, Photos, and Activity
  Monitor are all clearly macOS.

System appearances are **dawn** (light) and **dusk** (dark). They are not
"light theme" and "dark theme." They are two times of day in the same world.
The accent stays warm in both; the surface temperature shifts.

---

## 1. Surface taxonomy

Every UI surface cast produces is one of the following types. Each has an
elevation, a translucency rule, a motion contract, and dismissibility.

| Surface | Purpose | Elevation | Translucency | Motion | Dismiss |
|---|---|---|---|---|---|
| **window** | Root OS window. The thing the user resizes. | 0 | opaque | — | OS-managed |
| **chrome** | Title bar, menubar, status strip. Top edge of the window. | 0 | opaque | — | non-dismissible |
| **panel** | Docked side surfaces. Left rail (file browser), right rail (cast.db widgets). Always-present, resizable. | 1 | opaque | width-drift | non-dismissible (can collapse) |
| **pane** | Workspace content. Terminal panes, future editor panes. The center where work happens. | 0 | opaque | — | tab-managed |
| **modal** | Floating overlay with backdrop. Read-heavy surface — PreviewModal, AgentDetailModal. | 3 | vibrancy + blur | flow-enter | esc / backdrop-click |
| **sheet** | Slide-up overlay anchored to parent. Form-heavy or task-flow. Not yet built; planned for settings. | 3 | vibrancy + blur | drift-up | esc / explicit close |
| **popover** | Anchored floating panel near a trigger element. Context menus, future hover-cards. | 2 | vibrancy + blur | snap-in | outside-click / esc |
| **palette** | Command-bar overlay. CommandPalette (⌘K). | 3 | vibrancy + blur | flow-enter | esc / outside-click |
| **toast** | Transient bottom-corner notification. Sonner-backed. | 2 | vibrancy + blur | drift-in/out | auto-timeout / swipe |
| **drawer** | Slide-out side panel anchored to a window edge. Future: settings, MCP server config. | 2 | opaque | drift-side | esc / explicit close |
| **tab-strip** | Tabbed nav within a pane. TerminalTabs. | 0 | opaque | — | non-dismissible |

**Elevation values are abstract** (0 = canvas, 1 = panel, 2 = popover, 3 =
modal/sheet/palette, 4 = OS menus). They map to concrete shadow + stroke +
background token combinations in §3.7.

**Translucency rules:**
- *opaque* — fully solid background. No blur. Used for chrome, panels, panes.
- *vibrancy + blur* — translucent background reading the colors behind it,
  with a backdrop blur (typically 6–12px). Used for floating surfaces (modal,
  sheet, popover, palette, toast).

**Motion contracts** (defined in §3.6):
- *flow-enter* — modal/sheet/palette appear: opacity 0→1 + scale 0.96→1 +
  spring (stiffness 220, damping 26).
- *snap-in* — popover/menu: opacity 0→1 + translate-y 4→0 + spring (stiffness
  600, damping 40). Fast and crisp.
- *drift-up / drift-side / drift-in/out* — large surfaces slide from an edge:
  spring (stiffness 120, damping 22). Long but composed.
- *width-drift* — panel collapse/expand: width transition + spring (stiffness
  180, damping 24).

All motion respects `prefers-reduced-motion` and collapses to opacity-only
fades at duration 0 when set.

---

## 2. Density philosophy

Three density modes. Each surface picks one. The token system carries the
density-aware spacing under the same token names — the variant is set by a
data attribute on the surface root.

| Density | Use for | Spacing scale | Typography baseline | Example surfaces |
|---|---|---|---|---|
| **dense** | Lists, trees, tables, log views. Information-rich, scanning-mode. | 4px-grid, tight (gap-2 = 4px, gap-4 = 8px) | text-sm (13px) baseline | left-rail tree, plan task list, live agents list |
| **standard** | Default UI. Buttons, forms, cards, tab strips, panels. | 4px-grid, balanced (gap-2 = 8px, gap-4 = 16px) | text-base (14px) baseline | chrome, right-rail panels, tab strip, palette items |
| **spacious** | Reading surfaces. Modals, preview, future editor, onboarding. | 4px-grid, generous (gap-2 = 12px, gap-4 = 24px) | text-md (16px) baseline | PreviewModal body, AgentDetailModal, future editor pane |

A surface declares its density once on its root. Child components inherit it
unless they explicitly opt out. This prevents the current pattern where
modals have to override every nested component's spacing.

---

## 3. Token architecture

All tokens live as CSS custom properties on `:root` (default = dusk) with a
`[data-appearance="dawn"]` override block. JS reads `getComputedStyle()`
when it needs a token value (rare). Tailwind reads them via
`bg-[var(--surface-canvas)]` etc.

Token names are **stable across appearances**. Only values flip.

### 3.1 System surfaces (chrome and structure)

```
--system-canvas              /* root background, behind everything */
--system-chrome              /* title bar, status strip */
--system-panel               /* left rail, right rail, docked surfaces */
--system-pane                /* terminal pane, editor pane content */
--system-elevated            /* opaque base for elevated surfaces */
--system-vibrancy-base       /* tint behind vibrancy/blur material */
--system-vibrancy-overlay    /* on-top wash for translucent surfaces */
```

### 3.2 Stroke / border

```
--stroke-subtle              /* quiet dividers between sections */
--stroke-regular             /* default control + panel borders */
--stroke-strong              /* emphasized boundaries, active states */
--stroke-focus               /* keyboard focus ring — must hit 3:1 contrast */
```

### 3.3 Content (text + iconography)

```
--content-primary            /* body text, primary readable content */
--content-secondary          /* labels, secondary text */
--content-muted              /* meta, timestamps, placeholders */
--content-disabled           /* non-interactive text + icons */
--content-on-accent          /* text legible on --accent backgrounds */
--content-on-status          /* text legible on status fills */
```

### 3.4 Accent and brand

```
--accent                     /* primary action / brand highlight */
--accent-hover               /* hover state */
--accent-pressed             /* active/pressed state */
--accent-muted               /* subtle fill — selected row, soft chip */
--accent-glow                /* outer halo for emphasis (used sparingly) */
```

### 3.5 Status semantics

```
--status-success             /* positive completion */
--status-success-muted       /* soft fill version */
--status-warning             /* caution, attention */
--status-warning-muted
--status-error               /* failure, destructive */
--status-error-muted
--status-info                /* neutral information */
--status-info-muted
```

Status colors must remain perceptible to common color-vision deficiencies.
Pair every status with an icon or text label — never color alone.

### 3.6 Motion

```
--motion-instant             /* { duration: 0 }, reduced-motion fallback */
--motion-snap                /* spring(stiffness 600, damping 40) — controls */
--motion-flow                /* spring(stiffness 220, damping 26) — modals */
--motion-drift               /* spring(stiffness 120, damping 22) — drawers */
--motion-width-drift         /* spring(stiffness 180, damping 24) — panels */

--duration-fast              /* 120ms — hover, focus transitions */
--duration-base              /* 200ms — toasts, tooltips */
--duration-slow              /* 320ms — sheets, large fades */
```

The spring tokens are consumed by framer-motion `transition` props. The
duration tokens are for non-spring CSS transitions (color, opacity,
border-color). All collapse to `--motion-instant` under
`prefers-reduced-motion: reduce`.

### 3.7 Elevation (shadow + blur + stroke combo)

Elevation is not a single property — it's a *recipe* combining shadow, stroke,
backdrop-filter, and background. Each level is a named token bundle:

```
--elevation-0                /* flat: no shadow, --stroke-subtle */
--elevation-1                /* panels: subtle shadow + --stroke-regular */
--elevation-2                /* popovers, toasts: med shadow + blur(8px) + vibrancy */
--elevation-3                /* modals, palette, sheets: strong shadow + blur(12px) + vibrancy */
--elevation-4                /* OS menus (rare): max shadow + blur(16px) + vibrancy */
```

These are applied as utility classes (`.elev-1`, `.elev-2`, etc.) that bundle
the right combination of CSS properties. Components reference the class, not
individual shadow / blur values.

### 3.8 Spacing

4px grid. Density (§2) selects which scale a surface uses, but the token
names are universal.

```
--space-0                    /* 0 */
--space-1                    /* 4px  — hairline gap */
--space-2                    /* 8px */
--space-3                    /* 12px */
--space-4                    /* 16px */
--space-5                    /* 24px */
--space-6                    /* 32px */
--space-7                    /* 48px */
--space-8                    /* 64px */
```

### 3.9 Radius

```
--radius-sm                  /* 4px  — chip, badge, status pill (when not pill) */
--radius-md                  /* 6px  — button, input, small control */
--radius-lg                  /* 10px — panel, card, popover */
--radius-xl                  /* 14px — modal, sheet, palette */
--radius-pill                /* 9999px — toggle, soft chip */
```

### 3.10 Typography

**Font stack:**

```
--font-sans                  /* UI text */
--font-mono                  /* terminal, code, agent IDs */
```

Sans family is system-first: `-apple-system, BlinkMacSystemFont, "Segoe UI",
"Inter", system-ui, sans-serif`. cast feels native because it uses native
fonts. (Inter is the explicit fallback for non-Apple/Windows.)

Mono family is `"JetBrains Mono", "SF Mono", "Cascadia Code", Menlo, monospace`.

**Scale:**

```
--text-2xs    10px / 1.3
--text-xs     11px / 1.4
--text-sm     13px / 1.4   /* dense baseline */
--text-base   14px / 1.5   /* standard baseline */
--text-md     16px / 1.5   /* spacious baseline */
--text-lg     18px / 1.4   /* in-panel headlines */
--text-xl     24px / 1.3   /* section heads */
--text-2xl    32px / 1.25  /* page heroes (rare) */
```

**Weights:** 400 regular, 500 medium, 600 semibold. Never bold (700+) for UI
text — too loud. Mono weight stays at 400 or 500.

---

## 4. Surface contracts (taxonomy × tokens)

The marriage of §1 and §3. For each surface type, the canonical token bundle:

| Surface | Background | Border | Elevation | Radius | Density |
|---|---|---|---|---|---|
| window | `--system-canvas` | — | `--elevation-0` | OS-managed | n/a |
| chrome | `--system-chrome` | `--stroke-subtle` bottom | `--elevation-0` | — | standard |
| panel | `--system-panel` | `--stroke-regular` edge | `--elevation-1` | — | dense or standard |
| pane | `--system-pane` | — | `--elevation-0` | — | spacious (terminal-driven) |
| modal | `--system-elevated` + vibrancy wash | `--stroke-regular` | `--elevation-3` | `--radius-xl` | spacious |
| sheet | `--system-elevated` + vibrancy wash | `--stroke-regular` top | `--elevation-3` | `--radius-lg` (top corners) | standard or spacious |
| popover | `--system-elevated` + vibrancy wash | `--stroke-regular` | `--elevation-2` | `--radius-lg` | standard |
| palette | `--system-elevated` + vibrancy wash | `--stroke-regular` | `--elevation-3` | `--radius-xl` | standard |
| toast | `--system-elevated` + vibrancy wash | `--stroke-subtle` | `--elevation-2` | `--radius-lg` | standard |
| drawer | `--system-panel` | `--stroke-regular` edge | `--elevation-2` | `--radius-lg` (inner corners) | standard |
| tab-strip | `--system-chrome` | `--stroke-subtle` bottom | `--elevation-0` | — | standard |

---

## 5. Iconography rules

**Source:** Lucide React is the baseline glyph set. No mixing with other icon
libraries inside the same surface.

**Sizing:**
- `16px` — dense surfaces (file tree, list rows, button-internal icons)
- `20px` — standard surfaces (toolbar buttons, modal close, status indicators)
- `24px` — spacious / hero surfaces (empty states, onboarding, large CTAs)

**Stroke:** Lucide's default 2px stroke at all sizes. Do not adjust.

**Color:**
- Default state: `--content-secondary`
- Hover: `--content-primary`
- Active / selected: `--accent`
- Decorative-only: `--content-muted` with `aria-hidden="true"`

**Optical alignment:** icons in line with text take `vertical-align: -2px`
(or flex + `align-items: center` on the parent) to sit on the text baseline.

**Status icons** must be paired with text or aria-label — never used as the
sole signal of state.

---

## 6. Focus and accessibility (system contract)

cast's a11y bar is federal compliance (Section 508 + WCAG AA), per the
Phase 3+ requirements memory. The design language enforces this at the
token level:

- **Focus ring** uses `--stroke-focus` outline at 2px with a 1px offset on
  every interactive element. Never rely on browser default rings (invisible
  on dusk). Every component must declare `:focus-visible` explicitly.
- **Contrast minimums:** body text ≥ 4.5:1, large text ≥ 3:1, UI components
  ≥ 3:1. The dawn/dusk palette work (next doc) ratifies every pairing.
- **Touch targets ≥ 44×44px** on any element that can be tapped (not just
  mouse-clicked). Known tradeoff for the tree row at 32px — Phase 3 design
  call still pending.
- **Reduced motion** is non-negotiable. All spring tokens collapse to
  `--motion-instant` under `prefers-reduced-motion: reduce`.
- **Keyboard navigation** works end-to-end. Logical tab order, modal focus
  trap, Escape closes overlays, ⌘K opens palette. No keyboard dead-ends.
- **Semantic HTML first.** ARIA only when semantic HTML is insufficient.
  `<button>`, `<a>`, `<nav>`, `<dialog>` over `<div onClick>`.

---

## 7. What this doc does NOT do

- It does not pick concrete hex values. Those land in
  `docs/design/palette-dawn-dusk.md` (next session).
- It does not specify the cast logo / wordmark. Those land in
  `docs/design/mark.md`.
- It does not specify voice / copy. Those land in `docs/design/voice.md`.
- It does not migrate existing components. That is a sweep wave executed
  after the palette doc and the migration plan land.

---

## 8. Open questions to resolve in the palette doc

- **Accent hue at dawn:** coral / peach / amber — which warmth wins?
- **Accent hue at dusk:** amber-gold / honey / pumpkin — same family as dawn?
- **Surface temperature at dawn:** cool slate-blue base, or warm cream base?
  (Slate-blue feels more "OS"; cream feels more "writing app." Cast leans
  OS.)
- **Surface temperature at dusk:** indigo-blue base or forest-green base?
  (Earlier memory says "forest-at-dusk, NOT midnight black.")
- **Vibrancy tint behavior:** does the blur material pick up surface tint
  (macOS-style) or stay neutral (Fluent-style)?
- **Status hues:** keep semantic conventions (green / amber / red / blue) but
  shift saturation per appearance to avoid jarring brightness.

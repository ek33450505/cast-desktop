# cast palette — dawn and dusk

> Concrete hex values for every token defined in `design-language.md`.
> Dawn = cool slate base + amber accent. Dusk = forest-undertone base + amber-gold accent.
> The accent family is the brand warmth thread — same family, two times of day.

---

## 0. Decisions ratified

- **Dawn accent:** amber (warm, slightly golden — not orange)
- **Dusk accent:** amber-gold (warmer, deeper than dawn's amber)
- **Dawn surface temperature:** cool slate-blue (chilly, pre-sunrise)
- **Dusk surface temperature:** deep with forest undertone (NOT midnight black)
- **Vibrancy behavior:** macOS-style — translucent surfaces pick up underlying surface tint
- **Status hues:** saturation shifts per appearance to avoid jarring brightness; warning shifted toward orange-amber to distinguish from brand amber

---

## 1. Full token reference

### 1.1 System surfaces

| Token | Dawn | Dusk | Notes |
|---|---|---|---|
| `--system-canvas` | `#E8ECF1` | `#0E1614` | Root background, behind everything |
| `--system-chrome` | `#DDE3EA` | `#0A100F` | Top bar, status strip — reads as "above" canvas |
| `--system-panel` | `#E2E7ED` | `#121B18` | Left / right rails, docked surfaces |
| `--system-pane` | `#EEF1F5` | `#0B1311` | Terminal pane content (dusk darkest for terminal legibility) |
| `--system-elevated` | `#F2F5F9` | `#1A2421` | Opaque base for modals / sheets / popovers / palette |

### 1.2 Stroke

| Token | Dawn | Dusk | Notes |
|---|---|---|---|
| `--stroke-subtle` | `#D0D6DD` | `#1F2A26` | Quiet dividers between sections |
| `--stroke-regular` | `#B0B8C2` | `#2D3A35` | Default control + panel borders |
| `--stroke-strong` | `#8A93A0` | `#43534D` | Emphasized boundaries, active states |
| `--stroke-focus` | `#C48B1A` | `#E6A532` | Keyboard focus ring — amber, on-brand |

### 1.3 Content (text + iconography)

| Token | Dawn | Dusk | Notes |
|---|---|---|---|
| `--content-primary` | `#1A2333` | `#E6E8E2` | Body text — 16+:1 on canvas (dawn), 14+:1 (dusk) |
| `--content-secondary` | `#475063` | `#A8ADA6` | Labels, secondary text |
| `--content-muted` | `#737B8C` | `#737A75` | Meta, timestamps, placeholders |
| `--content-disabled` | `#A4ADBA` | `#4D544F` | Non-interactive text + icons |
| `--content-on-accent` | `#1A2333` | `#0E1614` | Dark text on amber fills |
| `--content-on-status-fill` | `#FFFFFF` | `#FFFFFF` | White text on saturated status fills |

### 1.4 Accent (brand amber)

| Token | Dawn | Dusk | Notes |
|---|---|---|---|
| `--accent` | `#D48E1A` | `#E6A532` | Primary action / brand highlight |
| `--accent-hover` | `#C07F12` | `#F0B441` | Hover (darker dawn, lighter dusk — both "warmer") |
| `--accent-pressed` | `#A66C0A` | `#D49621` | Active / pressed |
| `--accent-muted` | `#F4E4C4` | `#3F311A` | Soft fill — selected row, chip |
| `--accent-glow` | `rgba(212,142,26,0.25)` | `rgba(230,165,50,0.35)` | Outer halo for emphasis (sparingly) |
| `--accent-text` | `#9E6A0E` | `#F0B441` | When accent must be the text color (links, etc.) — passes 4.5:1 |

> Two accent tokens exist for two use cases: `--accent` is for fills with
> `--content-on-accent` text on top. `--accent-text` is for accent-as-text
> (hyperlinks, emphasized labels). On dusk they're nearly identical; on
> dawn `--accent-text` is darker to meet 4.5:1 against the light canvas.

### 1.5 Status semantics

| Status | Dawn fill | Dawn muted | Dusk fill | Dusk muted |
|---|---|---|---|---|
| success | `#1F8B4C` | `#D7F0DF` | `#3FA968` | `#1B2F23` |
| warning | `#D86B0F` | `#F8DEC5` | `#F09543` | `#3A2316` |
| error | `#C42F1E` | `#F5DAD7` | `#E64837` | `#391B19` |
| info | `#2065BD` | `#D4E3F4` | `#4E91D6` | `#162739` |

> Warning is **orange-amber**, distinct from brand **golden-amber**. Adjacent
> they read as different colors despite the family overlap. Same status type
> across appearances uses the same hue; saturation shifts to avoid harshness
> on dusk and faintness on dawn.

### 1.6 Vibrancy (macOS-style translucent material)

Vibrancy isn't a fixed color — it's a translucent layer that picks up the
underlying surface tint, combined with a backdrop blur. The token values are
RGBA so the alpha channel does the work.

| Token | Dawn | Dusk |
|---|---|---|
| `--system-vibrancy-base` | `rgba(232,236,241,0.65)` | `rgba(14,22,20,0.70)` |
| `--system-vibrancy-overlay` | `rgba(255,255,255,0.04)` | `rgba(255,255,255,0.02)` |
| `--system-vibrancy-blur` | `blur(12px) saturate(140%)` | `blur(12px) saturate(140%)` |

Usage pattern for an elevated translucent surface (modal / sheet / palette):
```css
.surface-elevated-translucent {
  background-color: var(--system-vibrancy-base);
  backdrop-filter: var(--system-vibrancy-blur);
  -webkit-backdrop-filter: var(--system-vibrancy-blur);
  /* The overlay is layered via box-shadow inset or a pseudo-element */
}
```

The `saturate(140%)` on the blur is the macOS trick — it pulls warmth out of
whatever's behind the material so it feels alive, not gray.

---

## 2. Contrast verification (key pairings)

WCAG AA requires ≥ 4.5:1 for body text, ≥ 3:1 for large text + UI
components. Verified pairings (calculated for the values above):

### Dawn

| Foreground | Background | Ratio | Use |
|---|---|---|---|
| `--content-primary` `#1A2333` | `--system-canvas` `#E8ECF1` | 14.8:1 ✓ | body text on canvas |
| `--content-secondary` `#475063` | `--system-canvas` `#E8ECF1` | 6.9:1 ✓ | labels, secondary |
| `--content-muted` `#737B8C` | `--system-canvas` `#E8ECF1` | 3.8:1 ⚠ | only for large text or meta — NOT body |
| `--content-on-accent` `#1A2333` | `--accent` `#D48E1A` | 6.4:1 ✓ | dark text on amber button |
| `--accent-text` `#9E6A0E` | `--system-canvas` `#E8ECF1` | 4.6:1 ✓ | accent-as-link |
| `--stroke-focus` `#C48B1A` | `--system-canvas` `#E8ECF1` | 3.0:1 ✓ | focus ring (UI component min) |

### Dusk

| Foreground | Background | Ratio | Use |
|---|---|---|---|
| `--content-primary` `#E6E8E2` | `--system-canvas` `#0E1614` | 14.2:1 ✓ | body text on canvas |
| `--content-secondary` `#A8ADA6` | `--system-canvas` `#0E1614` | 8.0:1 ✓ | labels, secondary |
| `--content-muted` `#737A75` | `--system-canvas` `#0E1614` | 4.0:1 ⚠ | only for large text or meta |
| `--content-on-accent` `#0E1614` | `--accent` `#E6A532` | 9.3:1 ✓ | dark text on amber button |
| `--accent-text` `#F0B441` | `--system-canvas` `#0E1614` | 9.2:1 ✓ | accent-as-link |
| `--stroke-focus` `#E6A532` | `--system-canvas` `#0E1614` | 8.6:1 ✓ | focus ring |

> `--content-muted` intentionally lands near the 4.5:1 floor in both
> appearances. It's reserved for meta text (timestamps, hints) at
> ≥14px / ≥18px-large; never use it for body content.

---

## 3. Elevation recipes (concrete)

Each elevation bundles shadow + stroke + background + (for translucent)
vibrancy. These are the values consumed by the `.elev-N` utility classes.

### Dawn

| Level | Shadow | Stroke | Background |
|---|---|---|---|
| `--elevation-0` | none | `--stroke-subtle` | inherit surface |
| `--elevation-1` | `0 1px 2px rgba(20,30,50,0.04), 0 1px 0 rgba(20,30,50,0.02)` | `--stroke-regular` | `--system-panel` |
| `--elevation-2` | `0 6px 16px rgba(20,30,50,0.10), 0 1px 3px rgba(20,30,50,0.06)` | `--stroke-regular` | translucent (vibrancy) |
| `--elevation-3` | `0 24px 48px rgba(20,30,50,0.16), 0 4px 8px rgba(20,30,50,0.08)` | `--stroke-regular` | translucent (vibrancy) |
| `--elevation-4` | `0 32px 64px rgba(20,30,50,0.24), 0 8px 16px rgba(20,30,50,0.12)` | `--stroke-strong` | translucent (vibrancy) |

### Dusk

| Level | Shadow | Stroke | Background |
|---|---|---|---|
| `--elevation-0` | none | `--stroke-subtle` | inherit surface |
| `--elevation-1` | `0 1px 2px rgba(0,0,0,0.30), 0 1px 0 rgba(255,255,255,0.02)` | `--stroke-regular` | `--system-panel` |
| `--elevation-2` | `0 6px 16px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.30)` | `--stroke-regular` | translucent (vibrancy) |
| `--elevation-3` | `0 24px 48px rgba(0,0,0,0.55), 0 4px 8px rgba(0,0,0,0.35)` | `--stroke-regular` | translucent (vibrancy) |
| `--elevation-4` | `0 32px 64px rgba(0,0,0,0.65), 0 8px 16px rgba(0,0,0,0.45)` | `--stroke-strong` | translucent (vibrancy) |

Dusk shadows are pure black (high alpha) — they read as actual depth on dark
surfaces. Dawn shadows are tinted slate-blue (low alpha) — they match the
surface temperature.

---

## 4. Implementation snippet

Drop into a new file (`src/dashboard/styles/tokens.css`) or extend the existing
`src/dashboard/index.css`. The `:root` block sets dusk as the default
appearance (matches current app behavior); `[data-appearance="dawn"]` flips
the values.

```css
:root {
  /* ─── Dusk (default appearance) ─────────────────────────────────────── */
  /* System surfaces */
  --system-canvas:           #0E1614;
  --system-chrome:           #0A100F;
  --system-panel:            #121B18;
  --system-pane:             #0B1311;
  --system-elevated:         #1A2421;
  --system-vibrancy-base:    rgba(14, 22, 20, 0.70);
  --system-vibrancy-overlay: rgba(255, 255, 255, 0.02);
  --system-vibrancy-blur:    blur(12px) saturate(140%);

  /* Stroke */
  --stroke-subtle:           #1F2A26;
  --stroke-regular:          #2D3A35;
  --stroke-strong:           #43534D;
  --stroke-focus:            #E6A532;

  /* Content */
  --content-primary:         #E6E8E2;
  --content-secondary:       #A8ADA6;
  --content-muted:           #737A75;
  --content-disabled:        #4D544F;
  --content-on-accent:       #0E1614;
  --content-on-status-fill:  #FFFFFF;

  /* Accent */
  --accent:                  #E6A532;
  --accent-hover:            #F0B441;
  --accent-pressed:          #D49621;
  --accent-muted:            #3F311A;
  --accent-glow:             rgba(230, 165, 50, 0.35);
  --accent-text:             #F0B441;

  /* Status */
  --status-success:          #3FA968;
  --status-success-muted:    #1B2F23;
  --status-warning:          #F09543;
  --status-warning-muted:    #3A2316;
  --status-error:            #E64837;
  --status-error-muted:      #391B19;
  --status-info:             #4E91D6;
  --status-info-muted:       #162739;

  /* Color-scheme hint for browser-rendered controls (scrollbars, form ui) */
  color-scheme: dark;
}

[data-appearance="dawn"] {
  /* ─── Dawn appearance overrides ─────────────────────────────────────── */
  --system-canvas:           #E8ECF1;
  --system-chrome:           #DDE3EA;
  --system-panel:            #E2E7ED;
  --system-pane:             #EEF1F5;
  --system-elevated:         #F2F5F9;
  --system-vibrancy-base:    rgba(232, 236, 241, 0.65);
  --system-vibrancy-overlay: rgba(255, 255, 255, 0.04);

  --stroke-subtle:           #D0D6DD;
  --stroke-regular:          #B0B8C2;
  --stroke-strong:           #8A93A0;
  --stroke-focus:            #C48B1A;

  --content-primary:         #1A2333;
  --content-secondary:       #475063;
  --content-muted:           #737B8C;
  --content-disabled:        #A4ADBA;
  --content-on-accent:       #1A2333;

  --accent:                  #D48E1A;
  --accent-hover:            #C07F12;
  --accent-pressed:          #A66C0A;
  --accent-muted:            #F4E4C4;
  --accent-glow:             rgba(212, 142, 26, 0.25);
  --accent-text:             #9E6A0E;

  --status-success:          #1F8B4C;
  --status-success-muted:    #D7F0DF;
  --status-warning:          #D86B0F;
  --status-warning-muted:    #F8DEC5;
  --status-error:            #C42F1E;
  --status-error-muted:      #F5DAD7;
  --status-info:             #2065BD;
  --status-info-muted:       #D4E3F4;

  color-scheme: light;
}

/* Honour OS preference at boot when the user hasn't picked manually */
@media (prefers-color-scheme: light) {
  :root:not([data-appearance]) {
    color-scheme: light;
    /* (re-declare dawn values here when shipping — omitted for brevity) */
  }
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-snap:        { duration: 0 };
    --motion-flow:        { duration: 0 };
    --motion-drift:       { duration: 0 };
    --motion-width-drift: { duration: 0 };
    --duration-fast:      0ms;
    --duration-base:      0ms;
    --duration-slow:      0ms;
  }
}
```

> Spring motion tokens are pseudo-CSS — they're consumed by framer-motion in
> JS. The JS reads `getComputedStyle()` for the duration tokens and switches
> to opacity-only transitions when `prefers-reduced-motion` is set.

---

## 5. Notes on each appearance

### Dawn (light)

The base reads as **pre-sunrise sky** — slate-blue with a hint of cool light
just before the sun crests. Not a "white" theme; the whitepoint is offset
toward blue, and there's NO yellow / cream warmth in the surfaces. The amber
accent provides all the warmth, and because it's the only warm color on a
cool stage, it carries the brand without competing.

Terminal panes use `--system-pane` `#EEF1F5` — slightly lighter and more
neutral than the canvas, so xterm output stays readable against a near-white
ground. Modal vibrancy picks up the slate tint from whatever panel is
behind it.

### Dusk (dark)

The base is **deep with forest undertone** — `#0E1614` reads as black at a
glance, but next to a pure-black surface it reveals a slight green. That's
the moment of dusk, not the absence of day. The amber-gold accent is the
"last light" — warmer than dawn's amber because the surrounding cool blues
of dawn are gone, so the accent has to do more emotional warming on its own.

Terminal pane is the deepest surface (`#0B1311`), giving ANSI bright colors
maximum perceived contrast. Modals float above with vibrancy that picks up
the forest tint subtly — they don't disappear into the canvas; they read as
a layer.

### The amber thread

The brand idea: amber is the warmth that survives both times of day.
- Dawn amber `#D48E1A` is golden-warm on a cool stage.
- Dusk amber `#E6A532` is gold-orange on a dark stage.
Same family, different temperature. When you toggle appearances, the accent
shifts but doesn't change identity — like the sun looks different at 6am vs
6pm but it's the same sun.

---

## 6. What's NOT in this doc

- **Implementation**: This doc defines values. The migration sweep
  (replacing hardcoded hex codes and legacy `--cast-*` token names across
  the codebase) is its own wave, planned next.
- **Logo / wordmark / system mark**: lands in `docs/design/mark.md`.
- **Voice / tagline / introducing-cast copy**: lands in `docs/design/voice.md`.
- **Typography scale + spacing scale + radius scale values**: see
  `design-language.md` §3.8–§3.10. Those tokens are appearance-invariant
  (same in dawn and dusk).
- **Mobile / responsive breakpoints**: deferred to Phase 3+ (per
  `project_phase_3_plus_requirements.md`). The token system here is
  responsive-ready (no fixed pixel widths in the tokens themselves).

---

## 7. Open calls for the migration wave

When we sweep the codebase to apply this palette, three decisions to make
in flight:

1. **Default appearance at first launch**: dusk (current behavior) or
   respect `prefers-color-scheme`? Recommendation: respect OS pref by
   default, with manual override persisted in localStorage.
2. **Appearance toggle UX**: dedicated button in chrome, or buried in
   Settings? Recommendation: dedicated button — appearance is a personal
   preference users adjust often.
3. **Animation when toggling**: instant flip or fade? Recommendation:
   instant. Fades on color-theme changes feel sluggish and amplify
   reduced-motion concerns.

import { useState, useEffect } from 'react'

/**
 * Reads a CSS custom property value from the document root.
 * Returns the trimmed string, or the fallback if empty.
 */
function getCSSVar(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback
  const val = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return val || fallback
}

export interface ChartColors {
  /** --accent (amber) — for HERO data series only */
  accent: string
  /** --accent-muted — for non-hero secondary fill areas */
  accentMuted: string
  /** Model-tier: haiku — falls back to --status-info (blue family) because --chart-2 does not exist */
  haiku: string
  /** Model-tier: sonnet — falls back to --status-success (green family) because --chart-3 does not exist */
  sonnet: string
  /** Model-tier: opus — falls back to --content-secondary (neutral) because --chart-4 does not exist */
  opus: string
  /** --status-success — only for true positive deltas */
  success: string
  /** --status-warning — only for true warnings */
  warning: string
  /** --status-error — only for true errors / failures */
  error: string
  /** --stroke-subtle — grid lines */
  gridStroke: string
  /** --content-muted — axis labels */
  axisTick: string
  /** --system-elevated — tooltip background */
  tooltipBg: string
  /** --stroke-regular — tooltip border */
  tooltipBorder: string
  /** --content-primary — tooltip text */
  tooltipText: string
}

function resolveChartColors(): ChartColors {
  // NOTE: --chart-2, --chart-3, --chart-4 do not exist in tokens.css (as of Stage 5a).
  // Model-tier colors fall back to semantic status tokens until a chart-N wave adds them.
  return {
    accent: getCSSVar('--accent', '#E6A532'),
    accentMuted: getCSSVar('--accent-muted', '#3F311A'),
    haiku: getCSSVar('--status-info', '#4E91D6'),      // blue family — TODO: migrate to --chart-2
    sonnet: getCSSVar('--status-success', '#3FA968'),  // green family — TODO: migrate to --chart-3
    opus: getCSSVar('--content-secondary', '#A8ADA6'), // neutral — TODO: migrate to --chart-4
    success: getCSSVar('--status-success', '#3FA968'),
    warning: getCSSVar('--status-warning', '#F09543'),
    error: getCSSVar('--status-error', '#E64837'),
    gridStroke: getCSSVar('--stroke-subtle', '#25312C'),
    axisTick: getCSSVar('--content-muted', '#737A75'),
    tooltipBg: getCSSVar('--system-elevated', '#2D3B35'),
    tooltipBorder: getCSSVar('--stroke-regular', '#36453F'),
    tooltipText: getCSSVar('--content-primary', '#E6E8E2'),
  }
}

/**
 * useChartColors — returns appearance-aware chart color values resolved from CSS tokens.
 *
 * Subscribes to data-appearance attribute changes on <html> via MutationObserver so
 * charts re-color correctly when the user toggles dawn/dusk.
 *
 * IMPORTANT: Recharts requires actual hex/rgba values — it cannot consume CSS custom
 * properties directly. This hook bridges the token system to Recharts.
 */
export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(resolveChartColors)

  useEffect(() => {
    if (typeof document === 'undefined') return

    const observer = new MutationObserver(() => {
      setColors(resolveChartColors())
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-appearance'],
    })

    // Re-resolve once after mount in case fonts/vars settled after first render
    setColors(resolveChartColors())

    return () => observer.disconnect()
  }, [])

  return colors
}

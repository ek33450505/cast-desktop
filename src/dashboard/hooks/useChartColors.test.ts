import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChartColors } from './useChartColors'

// Mock getComputedStyle to return predictable values for CSS vars
const CSS_VAR_VALUES: Record<string, string> = {
  '--accent': '#E6A532',
  '--accent-muted': '#3F311A',
  '--status-info': '#4E91D6',
  '--status-success': '#3FA968',
  '--content-secondary': '#A8ADA6',
  '--status-warning': '#F09543',
  '--status-error': '#E64837',
  '--stroke-subtle': '#25312C',
  '--content-muted': '#737A75',
  '--system-elevated': '#2D3B35',
  '--stroke-regular': '#36453F',
  '--content-primary': '#E6E8E2',
}

beforeEach(() => {
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({
    getPropertyValue: (name: string) => CSS_VAR_VALUES[name] ?? '',
  } as unknown as CSSStyleDeclaration)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useChartColors', () => {
  it('returns resolved values for all expected keys', () => {
    const { result } = renderHook(() => useChartColors())
    const colors = result.current

    expect(colors.accent).toBe('#E6A532')
    expect(colors.accentMuted).toBe('#3F311A')
    expect(colors.haiku).toBe('#4E91D6')
    expect(colors.sonnet).toBe('#3FA968')
    expect(colors.opus).toBe('#A8ADA6')
    expect(colors.success).toBe('#3FA968')
    expect(colors.warning).toBe('#F09543')
    expect(colors.error).toBe('#E64837')
    expect(colors.gridStroke).toBe('#25312C')
    expect(colors.axisTick).toBe('#737A75')
    expect(colors.tooltipBg).toBe('#2D3B35')
    expect(colors.tooltipBorder).toBe('#36453F')
    expect(colors.tooltipText).toBe('#E6E8E2')
  })

  it('falls back to hardcoded values when CSS vars are empty', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: () => '',
    } as unknown as CSSStyleDeclaration)

    const { result } = renderHook(() => useChartColors())

    // Fallbacks should be non-empty strings
    expect(result.current.accent).toBeTruthy()
    expect(result.current.error).toBeTruthy()
    expect(result.current.tooltipBg).toBeTruthy()
  })

  it('re-resolves colors when data-appearance attribute changes', async () => {
    const { result } = renderHook(() => useChartColors())

    // Initial: dusk values
    expect(result.current.accent).toBe('#E6A532')

    // Simulate dawn — update mock BEFORE triggering the attribute change
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      getPropertyValue: (name: string) =>
        name === '--accent' ? '#D48E1A' : CSS_VAR_VALUES[name] ?? '',
    } as unknown as CSSStyleDeclaration)

    // Trigger the MutationObserver by changing data-appearance on documentElement
    // and flush microtasks so the observer callback runs
    await act(async () => {
      document.documentElement.setAttribute('data-appearance', 'dawn')
      // MutationObserver fires asynchronously — yield to allow callback
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    // After mutation, colors should re-resolve with dawn accent
    expect(result.current.accent).toBe('#D48E1A')

    // Clean up
    document.documentElement.removeAttribute('data-appearance')
  })
})

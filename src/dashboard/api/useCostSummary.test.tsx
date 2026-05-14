/**
 * Tests for useCostSummary hook and the pricing widget rendering.
 *
 * The SystemView PricingTab is too integrated to render end-to-end in unit tests
 * (it pulls 20+ data hooks). These tests cover:
 * 1. useCostSummary — loading state
 * 2. useCostSummary — successful data fetch
 * 3. useCostSummary — error state
 * 4. useCostSummary — empty data (zero totals)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'
import { useCostSummary } from './useCostSummary'
import type { CostSummaryData } from './useCostSummary'

// ── Fetch mock helpers ────────────────────────────────────────────────────────

function makeFetchOk(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  })
}

function makeFetchError() {
  return vi.fn().mockResolvedValue({
    ok: false,
    json: () => Promise.resolve({}),
  })
}

// ── Wrapper ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: React.ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_COST_SUMMARY: CostSummaryData = {
  totals: {
    inputTokens: 50000,
    outputTokens: 20000,
    cacheCreationTokens: 5000,
    cacheReadTokens: 1000,
    costUsd: 0.47,
    sessionCount: 3,
  },
  byModel: [
    { model: 'claude-sonnet-4-6-20260320', costUsd: 0.35, sessionCount: 2 },
    { model: 'claude-haiku-4-5-20251001',  costUsd: 0.12, sessionCount: 1 },
  ],
  topSessions: [
    { id: 'aaa-111-bbb', project: 'cast-desktop', startedAt: '2026-05-10T10:00:00Z', model: 'claude-sonnet-4-6-20260320', costUsd: 0.25 },
  ],
  windowDays: 30,
}

const EMPTY_COST_SUMMARY: CostSummaryData = {
  totals: {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    costUsd: 0,
    sessionCount: 0,
  },
  byModel: [],
  topSessions: [],
  windowDays: 30,
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useCostSummary', () => {
  beforeEach(() => {
    global.fetch = makeFetchOk(MOCK_COST_SUMMARY)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts in loading state before the fetch resolves', () => {
    const { result } = renderHook(() => useCostSummary(), { wrapper: makeWrapper() })
    expect(result.current.isLoading).toBe(true)
    expect(result.current.data).toBeUndefined()
  })

  it('fetches from /api/cast/cost-summary with days param', async () => {
    const { result } = renderHook(() => useCostSummary(30), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(global.fetch).toHaveBeenCalledWith('/api/cast/cost-summary?days=30')
  })

  it('returns the correct data shape on success', async () => {
    const { result } = renderHook(() => useCostSummary(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const data = result.current.data!
    expect(data.totals.sessionCount).toBe(3)
    expect(data.totals.costUsd).toBeCloseTo(0.47, 4)
    expect(data.byModel).toHaveLength(2)
    expect(data.byModel[0].model).toBe('claude-sonnet-4-6-20260320')
    expect(data.topSessions).toHaveLength(1)
    expect(data.windowDays).toBe(30)
  })

  it('returns an error when the fetch is not ok', async () => {
    global.fetch = makeFetchError()
    const { result } = renderHook(() => useCostSummary(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeTruthy()
  })

  it('returns empty arrays when API returns zero data', async () => {
    global.fetch = makeFetchOk(EMPTY_COST_SUMMARY)
    const { result } = renderHook(() => useCostSummary(), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data!.byModel).toHaveLength(0)
    expect(result.current.data!.topSessions).toHaveLength(0)
    expect(result.current.data!.totals.costUsd).toBe(0)
    expect(result.current.data!.totals.sessionCount).toBe(0)
  })

  it('uses the correct query key including days param', async () => {
    const { result } = renderHook(() => useCostSummary(7), { wrapper: makeWrapper() })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    // Verify it fetched with days=7
    expect(global.fetch).toHaveBeenCalledWith('/api/cast/cost-summary?days=7')
  })
})

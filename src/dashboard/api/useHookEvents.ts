import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useEvent } from '../../lib/SseManager'
import type { LiveEvent } from '../types'

export interface HookEvent {
  id: string
  timestamp: string
  hook_type: string
  tool_name: string | null
  result: string | null
  duration_ms: number | null
  payload: Record<string, unknown>
}

/**
 * useHookEventsStream — subscribes to hook_event SSE via shared SseManager.
 * Returns the live ring of received events (newest first, capped at maxEvents).
 */
export function useHookEventsStream(maxEvents = 50) {
  const [events, setEvents] = useState<HookEvent[]>([])
  const [connected, setConnected] = useState(false)

  useEvent<LiveEvent>('hook_event', (e) => {
    setConnected(true)
    const hookEvent: HookEvent = {
      id: e.hookAgentId ?? String(Date.now()),
      timestamp: e.timestamp,
      hook_type: e.hookEventName ?? '',
      tool_name: null,
      result: null,
      duration_ms: null,
      payload: {},
    }
    setEvents(prev => [hookEvent, ...prev].slice(0, maxEvents))
  })

  return { events, connected }
}

/**
 * useRecentHookEvents — TanStack Query fetch of /api/hook-events/recent.
 * Useful for initial load or when SSE is not needed.
 */
export function useRecentHookEvents(limit = 20) {
  return useQuery<{ events: HookEvent[]; total: number }>({
    queryKey: ['hook-events-recent', limit],
    queryFn: async () => {
      const res = await fetch(`/api/hook-events/recent?limit=${limit}`)
      if (!res.ok) throw new Error(`API error ${res.status}: /api/hook-events/recent`)
      return res.json()
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  })
}

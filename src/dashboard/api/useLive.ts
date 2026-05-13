import { useState } from 'react'
import type { LiveEvent } from '../types'
import { sseManager, useEvent } from '../../lib/SseManager'

export function useConnectionState() {
  const [connected, setConnected] = useState(
    () => sseManager.connectionState === EventSource.OPEN,
  )

  useEvent<LiveEvent>('heartbeat', () => {
    setConnected(true)
  })

  return connected
}

export function useLiveEvents(onEvent?: (e: LiveEvent) => void) {
  const [connected, setConnected] = useState(
    () => sseManager.connectionState === EventSource.OPEN,
  )
  const [lastDbEventMs, setLastDbEventMs] = useState<number | null>(null)

  useEvent<LiveEvent>('*', (event) => {
    setConnected(true)
    if (event.type.startsWith('db_change_')) {
      setLastDbEventMs(Date.now())
    }
    onEvent?.(event)
  })

  return { connected, lastDbEventMs }
}

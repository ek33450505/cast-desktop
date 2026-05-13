import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { LiveEvent } from '../types'
import { useEvent } from '../lib/SseManager'

export interface PaneBinding {
  sessionId: string | null
  projectPath: string | null
  endedAt: number | null
  bound: boolean
}

interface PaneBindingResponse {
  paneId: string
  sessionId: string
  startedAt: number
  endedAt: number | null
  projectPath: string
}

async function fetchPaneBinding(paneId: string): Promise<PaneBindingResponse | null> {
  const res = await fetch(`/api/pane-bindings/${encodeURIComponent(paneId)}`)
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`failed to query pane binding: HTTP ${res.status}`)
  }
  return res.json() as Promise<PaneBindingResponse>
}

const NULL_BINDING: PaneBinding = {
  sessionId: null,
  projectPath: null,
  endedAt: null,
  bound: false,
}

export function usePaneBinding(paneId: string | undefined): PaneBinding {
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['paneBinding', paneId],
    queryFn: () => fetchPaneBinding(paneId!),
    enabled: !!paneId,
    staleTime: 60_000,
  })

  useEvent<LiveEvent>('pane_binding_updated', (e) => {
    if (e.paneId === paneId) {
      void queryClient.invalidateQueries({ queryKey: ['paneBinding', paneId] })
    }
  })

  if (!paneId) return NULL_BINDING

  if (data === undefined) return NULL_BINDING

  if (data === null) {
    return NULL_BINDING
  }

  return {
    sessionId: data.sessionId,
    projectPath: data.projectPath,
    endedAt: data.endedAt,
    bound: true,
  }
}

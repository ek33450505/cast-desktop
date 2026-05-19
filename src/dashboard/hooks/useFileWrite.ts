import { useMutation, useQueryClient } from '@tanstack/react-query'

interface WritePayload { path: string; content: string }
interface WriteResponse { path: string }

async function writeFile({ path, content }: WritePayload): Promise<WriteResponse> {
  const res = await fetch('/api/cast-fs/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<WriteResponse>
}

export function useFileWrite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: writeFile,
    onSuccess: (_data, variables) => {
      // Invalidate the preview query so re-opening shows fresh content
      queryClient.invalidateQueries({ queryKey: ['preview-modal', variables.path] })
    },
  })
}

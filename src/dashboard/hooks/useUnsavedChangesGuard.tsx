/**
 * useUnsavedChangesGuard — returns a `promptGuard` function and a `modalElement`
 * the caller renders in their JSX tree. When promptGuard(paths) is called,
 * the modal renders; the returned Promise resolves on Save / Discard / Cancel.
 *
 * Pattern: state-driven render (not imperative createRoot) so React Testing
 * Library and React's update cycle behave normally.
 *
 * Usage:
 *   const { promptGuard, modalElement } = useUnsavedChangesGuard()
 *   // ...
 *   return (<>...{modalElement}</>)
 *   // on close attempt:
 *   const result = await promptGuard(['/foo/bar.ts'])
 */

import { useCallback, useRef, useState, type ReactElement } from 'react'
import { UnsavedChangesModal } from '../components/UnsavedChangesModal'

export type UnsavedAction = 'save' | 'discard' | 'cancel'

export interface UnsavedGuardResult {
  action: UnsavedAction
}

interface PendingPrompt {
  paths: string[]
  resolve: (result: UnsavedGuardResult) => void
}

export function useUnsavedChangesGuard(): {
  promptGuard: (dirtyPaths: string[]) => Promise<UnsavedGuardResult>
  modalElement: ReactElement | null
} {
  const [pending, setPending] = useState<PendingPrompt | null>(null)
  const promptingRef = useRef(false)

  const promptGuard = useCallback(
    (dirtyPaths: string[]): Promise<UnsavedGuardResult> => {
      if (dirtyPaths.length === 0) {
        return Promise.resolve({ action: 'discard' })
      }
      if (promptingRef.current) {
        return Promise.resolve({ action: 'cancel' })
      }

      promptingRef.current = true

      return new Promise<UnsavedGuardResult>((resolve) => {
        setPending({ paths: dirtyPaths, resolve })
      })
    },
    [],
  )

  const close = useCallback((action: UnsavedAction) => {
    if (!pending) return
    promptingRef.current = false
    const { resolve } = pending
    setPending(null)
    resolve({ action })
  }, [pending])

  const modalElement = pending ? (
    <UnsavedChangesModal
      dirtyPaths={pending.paths}
      onSave={() => close('save')}
      onDiscard={() => close('discard')}
      onCancel={() => close('cancel')}
    />
  ) : null

  return { promptGuard, modalElement }
}

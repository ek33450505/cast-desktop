import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useCallback, useState } from 'react'
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard'
import type { UnsavedAction } from './useUnsavedChangesGuard'

// useReducedMotion can error in jsdom; stub it.
vi.mock('framer-motion', async (importOriginal) => {
  const original = await importOriginal<typeof import('framer-motion')>()
  return { ...original, useReducedMotion: () => true }
})

// Minimal test harness that invokes the guard and records the result
function TestHarness({ paths }: { paths: string[] }) {
  const { promptGuard, modalElement } = useUnsavedChangesGuard()
  const [result, setResult] = useState<UnsavedAction | null>(null)

  const handleClick = useCallback(async () => {
    const r = await promptGuard(paths)
    setResult(r.action)
  }, [paths, promptGuard])

  return (
    <div>
      <button onClick={handleClick}>Trigger</button>
      {result && <div data-testid="result">{result}</div>}
      {modalElement}
    </div>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useUnsavedChangesGuard', () => {
  it('resolves immediately with "discard" when no dirty paths', async () => {
    render(<TestHarness paths={[]} />)
    fireEvent.click(screen.getByRole('button', { name: /trigger/i }))
    await waitFor(() => {
      expect(screen.getByTestId('result')).toHaveTextContent('discard')
    })
  })

  it('shows modal when there are dirty paths', async () => {
    render(<TestHarness paths={['/foo/a.ts']} />)
    fireEvent.click(screen.getByRole('button', { name: /trigger/i }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  it('resolves with "save" when Save is clicked', async () => {
    render(<TestHarness paths={['/foo/a.ts']} />)
    fireEvent.click(screen.getByRole('button', { name: /trigger/i }))
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('button', { name: /save changes and close/i }))
    await waitFor(() => {
      expect(screen.getByTestId('result')).toHaveTextContent('save')
    })
  })

  it('resolves with "discard" when Don\'t Save is clicked', async () => {
    render(<TestHarness paths={['/foo/a.ts']} />)
    fireEvent.click(screen.getByRole('button', { name: /trigger/i }))
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('button', { name: /discard changes/i }))
    await waitFor(() => {
      expect(screen.getByTestId('result')).toHaveTextContent('discard')
    })
  })

  it('resolves with "cancel" when Cancel is clicked', async () => {
    render(<TestHarness paths={['/foo/a.ts']} />)
    fireEvent.click(screen.getByRole('button', { name: /trigger/i }))
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('button', { name: /cancel.*keep editor open/i }))
    await waitFor(() => {
      expect(screen.getByTestId('result')).toHaveTextContent('cancel')
    })
  })

  it('resolves with "cancel" when Escape is pressed', async () => {
    render(<TestHarness paths={['/foo/a.ts']} />)
    fireEvent.click(screen.getByRole('button', { name: /trigger/i }))
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.getByTestId('result')).toHaveTextContent('cancel')
    })
  })

  it('removes modal from DOM after resolution', async () => {
    render(<TestHarness paths={['/foo/a.ts']} />)
    fireEvent.click(screen.getByRole('button', { name: /trigger/i }))
    await waitFor(() => screen.getByRole('dialog'))
    fireEvent.click(screen.getByRole('button', { name: /discard changes/i }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })
})

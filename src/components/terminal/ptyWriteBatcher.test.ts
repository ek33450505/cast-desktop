import { describe, it, expect, vi } from 'vitest'
import { createPtyWriteBatcher } from './ptyWriteBatcher'

// Synchronous rAF stand-ins for deterministic testing.
// schedule() records the callback; runPending() invokes it immediately.
function makeScheduler() {
  let pending: FrameRequestCallback | null = null
  let nextId = 1

  const schedule = vi.fn((cb: FrameRequestCallback): number => {
    pending = cb
    return nextId++
  })

  const cancel = vi.fn((id: number) => {
    // Only clear if the pending callback belongs to this id.
    // For our tests, a single outstanding rAF is sufficient.
    if (id === nextId - 1) pending = null
  })

  const runPending = () => {
    const cb = pending
    pending = null
    if (cb) cb(0)
  }

  return { schedule, cancel, runPending }
}

describe('createPtyWriteBatcher', () => {
  it('calls flushFn with a single chunk on the rAF tick', () => {
    const { schedule, cancel, runPending } = makeScheduler()
    const flushFn = vi.fn()
    const batcher = createPtyWriteBatcher(flushFn, schedule, cancel)

    batcher.push('hello')
    expect(flushFn).not.toHaveBeenCalled() // not flushed yet

    runPending()
    expect(flushFn).toHaveBeenCalledOnce()
    expect(flushFn).toHaveBeenCalledWith('hello')
  })

  it('coalesces multiple chunks pushed before the rAF tick into one flush call', () => {
    const { schedule, cancel, runPending } = makeScheduler()
    const flushFn = vi.fn()
    const batcher = createPtyWriteBatcher(flushFn, schedule, cancel)

    batcher.push('foo')
    batcher.push('bar')
    batcher.push('baz')

    runPending()
    expect(flushFn).toHaveBeenCalledOnce()
    expect(flushFn).toHaveBeenCalledWith('foobarbaz')
  })

  it('only schedules one rAF even when many chunks arrive before the tick', () => {
    const { schedule, cancel, runPending } = makeScheduler()
    const flushFn = vi.fn()
    const batcher = createPtyWriteBatcher(flushFn, schedule, cancel)

    batcher.push('a')
    batcher.push('b')
    batcher.push('c')

    expect(schedule).toHaveBeenCalledOnce()
    runPending()
  })

  it('re-schedules rAF for chunks pushed after a flush', () => {
    const { schedule, cancel, runPending } = makeScheduler()
    const flushFn = vi.fn()
    const batcher = createPtyWriteBatcher(flushFn, schedule, cancel)

    batcher.push('first')
    runPending()
    expect(flushFn).toHaveBeenCalledTimes(1)

    batcher.push('second')
    runPending()
    expect(flushFn).toHaveBeenCalledTimes(2)
    expect(flushFn).toHaveBeenLastCalledWith('second')
  })

  it('does not call flushFn if buffer is empty when rAF fires', () => {
    const { schedule, cancel, runPending } = makeScheduler()
    const flushFn = vi.fn()
    const batcher = createPtyWriteBatcher(flushFn, schedule, cancel)

    batcher.push('data')
    batcher.dispose() // clears buffer and cancels rAF

    // Manually fire the (now-cancelled) tick anyway to verify no flush
    runPending()
    expect(flushFn).not.toHaveBeenCalled()
  })

  it('dispose cancels the pending rAF', () => {
    const { schedule, cancel, runPending } = makeScheduler()
    const flushFn = vi.fn()
    const batcher = createPtyWriteBatcher(flushFn, schedule, cancel)

    batcher.push('queued')
    batcher.dispose()

    expect(cancel).toHaveBeenCalledOnce()
    runPending() // simulate late rAF callback firing despite cancel
    expect(flushFn).not.toHaveBeenCalled()
  })

  it('dispose is idempotent — second call does not throw', () => {
    const { schedule, cancel } = makeScheduler()
    const flushFn = vi.fn()
    const batcher = createPtyWriteBatcher(flushFn, schedule, cancel)

    batcher.push('data')
    batcher.dispose()
    expect(() => batcher.dispose()).not.toThrow()
  })

  it('clears the buffer after each flush', () => {
    const { schedule, cancel, runPending } = makeScheduler()
    const flushFn = vi.fn()
    const batcher = createPtyWriteBatcher(flushFn, schedule, cancel)

    batcher.push('batch1')
    runPending()
    // Only push 'batch2' now — buffer should not contain 'batch1'
    batcher.push('batch2')
    runPending()

    expect(flushFn).toHaveBeenNthCalledWith(1, 'batch1')
    expect(flushFn).toHaveBeenNthCalledWith(2, 'batch2')
  })
})

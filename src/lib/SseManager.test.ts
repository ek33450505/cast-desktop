import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SseManager } from './SseManager'

class MockEventSource {
  static instances: MockEventSource[] = []
  readyState = 1
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null

  constructor(public url: string) {
    MockEventSource.instances.push(this)
  }

  close() { this.readyState = 2 }
  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent)
  }
}

beforeEach(() => {
  MockEventSource.instances = []
  vi.stubGlobal('EventSource', MockEventSource)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('SseManager connection cap', () => {
  it('opens exactly ONE EventSource when 3 components subscribe to different types', () => {
    const mgr = new SseManager('/api/events')
    const unsub1 = mgr.subscribe('heartbeat', vi.fn())
    const unsub2 = mgr.subscribe('session_updated', vi.fn())
    const unsub3 = mgr.subscribe('pane_binding_updated', vi.fn())
    expect(MockEventSource.instances).toHaveLength(1)
    unsub1(); unsub2(); unsub3()
  })

  it('opens exactly ONE EventSource when usePaneBinding is called 5 times', () => {
    const mgr = new SseManager('/api/events')
    const unsubs = Array.from({ length: 5 }, () => mgr.subscribe('pane_binding_updated', vi.fn()))
    expect(MockEventSource.instances).toHaveLength(1)
    unsubs.forEach(u => u())
  })

  it('closes EventSource when all subscribers unsubscribe', () => {
    const mgr = new SseManager('/api/events')
    const unsub = mgr.subscribe('heartbeat', vi.fn())
    expect(mgr.connectionState).toBe(1)
    unsub()
    expect(mgr.connectionState).toBe(-1)
  })

  it('routes events to correct type handlers only', () => {
    const mgr = new SseManager('/api/events')
    const heartbeatFn = vi.fn()
    const planFn = vi.fn()
    mgr.subscribe('heartbeat', heartbeatFn)
    mgr.subscribe('plan_progress_updated', planFn)
    const es = MockEventSource.instances[0]!
    es.emit({ type: 'heartbeat', timestamp: 't' })
    expect(heartbeatFn).toHaveBeenCalledOnce()
    expect(planFn).not.toHaveBeenCalled()
  })
})

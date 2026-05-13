import { useEffect, useRef, useState } from 'react'
import type { LiveEvent } from '../types'

type EventHandler<T extends LiveEvent = LiveEvent> = (event: T) => void

export class SseManager {
  private es: EventSource | null = null
  private subscriberCount = 0
  private handlers = new Map<string, Set<EventHandler>>()
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private url: string

  constructor(url: string) {
    this.url = url
  }

  subscribe<T extends LiveEvent>(type: T['type'] | '*', handler: EventHandler<T>): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set())
    this.handlers.get(type)!.add(handler as EventHandler)
    this.subscriberCount++
    if (this.subscriberCount === 1) this.open()

    return () => {
      const set = this.handlers.get(type)
      set?.delete(handler as EventHandler)
      this.subscriberCount--
      if (this.subscriberCount === 0) this.close()
    }
  }

  private open() {
    if (this.es) return
    this.es = new EventSource(this.url)
    this.es.onmessage = (e: MessageEvent<string>) => {
      try {
        const event: LiveEvent = JSON.parse(e.data)
        this.handlers.get(event.type)?.forEach(h => h(event))
        this.handlers.get('*')?.forEach(h => h(event))
      } catch { /* skip malformed */ }
    }
    this.es.onerror = () => {
      this.es?.close()
      this.es = null
      if (this.subscriberCount > 0) {
        this.retryTimer = setTimeout(() => this.open(), 3000)
      }
    }
  }

  private close() {
    if (this.retryTimer) { clearTimeout(this.retryTimer); this.retryTimer = null }
    this.es?.close()
    this.es = null
  }

  get connectionState() { return this.es ? this.es.readyState : -1 }
  get activeSubscribers() { return this.subscriberCount }
}

export const sseManager = new SseManager('/api/events')

// useEvent — fires handler on each matching event; uses handlerRef to avoid stale closures
export function useEvent<T extends LiveEvent>(
  type: T['type'] | '*',
  handler: (event: T) => void
): void {
  const handlerRef = useRef(handler)
  useEffect(() => { handlerRef.current = handler })
  useEffect(() => {
    return sseManager.subscribe<T>(type as T['type'], e => handlerRef.current(e))
  }, [type])
}

// useEventValue — derives reactive state from events
export function useEventValue<T extends LiveEvent, V>(
  type: T['type'],
  initial: V,
  selector: (event: T) => V
): V {
  const [value, setValue] = useState<V>(initial)
  useEvent<T>(type, e => setValue(selector(e)))
  return value
}

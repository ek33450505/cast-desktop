import { useState, useCallback, useEffect } from 'react'

const OPEN_KEY = 'cast-desktop:rail-state'
const LEFT_WIDTH_KEY = 'cast-desktop:left-rail-width'
const RIGHT_WIDTH_KEY = 'cast-desktop:right-rail-width'

// Default expanded widths in px (spec §Q1)
export const LEFT_RAIL_DEFAULT_PX = 260
export const RIGHT_RAIL_DEFAULT_PX = 240

interface OpenState {
  leftRailOpen: boolean
  rightRailOpen: boolean
}

function readOpenState(): OpenState {
  try {
    const raw = localStorage.getItem(OPEN_KEY)
    if (!raw) return { leftRailOpen: true, rightRailOpen: false }
    const parsed = JSON.parse(raw) as Partial<OpenState>
    return {
      leftRailOpen: parsed.leftRailOpen ?? true,
      // right rail defaults to collapsed — terminal-first (spec Ed's call #1)
      rightRailOpen: parsed.rightRailOpen ?? false,
    }
  } catch {
    return { leftRailOpen: true, rightRailOpen: false }
  }
}

function writeOpenState(state: OpenState): void {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify(state))
  } catch {
    // localStorage may be unavailable (private browsing, quota exceeded)
  }
}

function readWidth(key: string, defaultPx: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return defaultPx
    const n = parseFloat(raw)
    return Number.isFinite(n) && n > 0 ? n : defaultPx
  } catch {
    return defaultPx
  }
}

function writeWidth(key: string, px: number): void {
  try {
    localStorage.setItem(key, String(px))
  } catch {
    // ignore quota / private browsing errors
  }
}

export function useRailState() {
  const [openState, setOpenState] = useState<OpenState>(readOpenState)
  const [leftWidthPx, setLeftWidthPxRaw] = useState<number>(() =>
    readWidth(LEFT_WIDTH_KEY, LEFT_RAIL_DEFAULT_PX),
  )
  const [rightWidthPx, setRightWidthPxRaw] = useState<number>(() =>
    readWidth(RIGHT_WIDTH_KEY, RIGHT_RAIL_DEFAULT_PX),
  )

  // Persist open/closed on every change
  useEffect(() => {
    writeOpenState(openState)
  }, [openState])

  const setLeftWidthPx = useCallback((px: number) => {
    setLeftWidthPxRaw(px)
    writeWidth(LEFT_WIDTH_KEY, px)
  }, [])

  const setRightWidthPx = useCallback((px: number) => {
    setRightWidthPxRaw(px)
    writeWidth(RIGHT_WIDTH_KEY, px)
  }, [])

  const setLeftRailOpen = useCallback((value: boolean) => {
    setOpenState((prev) => ({ ...prev, leftRailOpen: value }))
  }, [])

  const setRightRailOpen = useCallback((value: boolean) => {
    setOpenState((prev) => ({ ...prev, rightRailOpen: value }))
  }, [])

  return {
    leftRailOpen: openState.leftRailOpen,
    rightRailOpen: openState.rightRailOpen,
    leftWidthPx,
    rightWidthPx,
    setLeftRailOpen,
    setRightRailOpen,
    setLeftWidthPx,
    setRightWidthPx,
  }
}

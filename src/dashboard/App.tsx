import { lazy, Suspense, useCallback, useState } from 'react'
import { Routes, Route, Navigate, Link, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { MotionConfig, motion, useReducedMotion } from 'framer-motion'
import { useHotkeys } from 'react-hotkeys-hook'

import { useDbChangeInvalidation } from './api/useDbChangeInvalidation'
import ErrorBoundary from './components/ErrorBoundary'
import TopBar from './components/TopBar'
import LeftRail from './components/LeftRail'
import RightRail from './components/RightRail'
import { useRailState, LEFT_RAIL_DEFAULT_PX, RIGHT_RAIL_DEFAULT_PX } from './hooks/useRailState'
import { TerminalTabs } from '../components/terminal/TerminalTabs'
import CommandPalette from '../components/CommandPalette'
import { EditorShellLayout } from './components/EditorShellLayout'
import {
  HooksPage,
  PlansPage,
  MemoryPage,
  DbPage,
  SettingsPage,
  ThemesPage,
  SkillsPage,
  AboutPage,
} from './pages/StubPages'

// ── Lazy-loaded route views ───────────────────────────────────────────────────

const HomeView = lazy(() => import('./views/HomeView'))
const SessionsView = lazy(() => import('./views/SessionsView'))
const SessionDetailView = lazy(() => import('./views/SessionDetailView'))
const AnalyticsView = lazy(() => import('./views/AnalyticsView'))
const AnalyticsAgentDetailView = lazy(() => import('./views/AnalyticsAgentDetailView'))
const SystemView = lazy(() => import('./views/SystemView'))
const DocsView = lazy(() => import('./views/DocsView'))
const AgentsView = lazy(() => import('./views/AgentsView'))
const SwarmView = lazy(() => import('./views/SwarmView'))
const WorkLogView = lazy(() => import('./views/WorkLogView'))

// Collapsed icon strip is always 48px (spec §Q1 + §Q3).
const COLLAPSED_PX = 48

// ── Shell layout ─────────────────────────────────────────────────────────────

function ShellLayout() {
  const {
    leftRailOpen,
    rightRailOpen,
    leftWidthPx,
    rightWidthPx,
    setLeftRailOpen,
    setRightRailOpen,
  } = useRailState()

  const shouldReduceMotion = useReducedMotion()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // Toggle handlers — pure state flips, the DOM follows via width animation
  const handleToggleLeft = useCallback(() => setLeftRailOpen(!leftRailOpen),
    [leftRailOpen, setLeftRailOpen])
  const handleToggleRight = useCallback(() => setRightRailOpen(!rightRailOpen),
    [rightRailOpen, setRightRailOpen])

  // ⌘B toggles left rail (VS Code precedent)
  useHotkeys('mod+b', (e) => { e.preventDefault(); handleToggleLeft() }, { enableOnFormTags: false })
  // ⌘⌥B toggles right rail (spec Ed's call #5)
  useHotkeys('mod+alt+b', (e) => { e.preventDefault(); handleToggleRight() }, { enableOnFormTags: false })
  // ⌘K opens command palette
  useHotkeys('mod+k', (e) => { e.preventDefault(); setPaletteOpen(true) }, { enableOnFormTags: true, enableOnContentEditable: true })
  // ⌘E — open editor (checked for conflicts: no existing Cmd+E bindings in codebase)
  useHotkeys(
    'mod+e',
    (e) => {
      e.preventDefault()
      if (location.pathname !== '/editor') {
        navigate('/editor')
      }
      // If already on /editor, focus is handled by the editor component itself
    },
    { enableOnFormTags: false, enableOnContentEditable: false },
  )

  const leftTargetPx = leftRailOpen ? (leftWidthPx || LEFT_RAIL_DEFAULT_PX) : COLLAPSED_PX
  const rightTargetPx = rightRailOpen ? (rightWidthPx || RIGHT_RAIL_DEFAULT_PX) : COLLAPSED_PX

  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: 'easeInOut' as const }

  return (
    <div className="h-screen flex flex-col overflow-hidden"
         style={{ background: 'var(--system-canvas)' }}>
      <TopBar
        leftRailOpen={leftRailOpen}
        rightRailOpen={rightRailOpen}
        onToggleLeft={handleToggleLeft}
        onToggleRight={handleToggleRight}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <div className="flex-1 min-h-0 flex">
        {/* ── Left Rail ─────────────────────────────────────────────── */}
        <motion.div
          initial={false}
          animate={{ width: leftTargetPx }}
          transition={transition}
          className="shrink-0 overflow-hidden"
          style={{ borderRight: '1px solid var(--stroke-regular)' }}
        >
          <LeftRail open={leftRailOpen} onExpand={() => setLeftRailOpen(true)} />
        </motion.div>

        {/* ── Center ────────────────────────────────────────────────── */}
        <main id="main-content" className="flex-1 min-w-0 overflow-auto"
              style={{ background: 'var(--system-canvas)' }}>
          <Suspense fallback={
            <div className="flex items-center justify-center h-full text-[var(--text-muted)] text-sm">
              Loading…
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>

        {/* ── Right Rail ────────────────────────────────────────────── */}
        <motion.div
          initial={false}
          animate={{ width: rightTargetPx }}
          transition={transition}
          className="shrink-0 overflow-hidden"
          style={{ borderLeft: '1px solid var(--stroke-regular)' }}
        >
          <RightRail open={rightRailOpen} onExpand={() => setRightRailOpen(true)} />
        </motion.div>
      </div>
    </div>
  )
}

// ── App (router root) ─────────────────────────────────────────────────────────

export default function App() {
  useDbChangeInvalidation()

  return (
    <MotionConfig reducedMotion="user">
      <Routes>
        {/* ── Editor route — no Cast rails (sibling of ShellLayout) ── */}
        <Route path="/editor" element={<ErrorBoundary><EditorShellLayout /></ErrorBoundary>} />

        {/* ── Shell wraps all other routes ── */}
        <Route element={<ShellLayout />}>
          <Route path="/" element={<ErrorBoundary><TerminalTabs /></ErrorBoundary>} />
          <Route path="/sessions" element={<ErrorBoundary><SessionsView /></ErrorBoundary>} />
          <Route path="/sessions/:project/:sessionId" element={<ErrorBoundary><SessionDetailView /></ErrorBoundary>} />
          <Route path="/analytics" element={<ErrorBoundary><AnalyticsView /></ErrorBoundary>} />
          <Route path="/analytics/agents/:agent" element={<ErrorBoundary><AnalyticsAgentDetailView /></ErrorBoundary>} />
          <Route path="/system" element={<ErrorBoundary><SystemView /></ErrorBoundary>} />
          <Route path="/docs" element={<ErrorBoundary><DocsView /></ErrorBoundary>} />
          <Route path="/agents" element={<ErrorBoundary><AgentsView /></ErrorBoundary>} />
          <Route path="/swarm" element={<ErrorBoundary><SwarmView /></ErrorBoundary>} />
          <Route path="/work-log" element={<ErrorBoundary><WorkLogView /></ErrorBoundary>} />

          {/* ── Wave 2.11 stub routes ── */}
          <Route path="/hooks" element={<ErrorBoundary><HooksPage /></ErrorBoundary>} />
          <Route path="/plans" element={<ErrorBoundary><PlansPage /></ErrorBoundary>} />
          <Route path="/memory" element={<ErrorBoundary><MemoryPage /></ErrorBoundary>} />
          <Route path="/db" element={<ErrorBoundary><DbPage /></ErrorBoundary>} />
          <Route path="/settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
          <Route path="/themes" element={<ErrorBoundary><ThemesPage /></ErrorBoundary>} />
          <Route path="/skills" element={<ErrorBoundary><SkillsPage /></ErrorBoundary>} />
          <Route path="/about" element={<ErrorBoundary><AboutPage /></ErrorBoundary>} />

          {/* ── Consolidation redirects ── */}
          <Route path="/commands" element={<Navigate to="/docs" replace />} />
          <Route path="/activity" element={<Navigate to="/sessions" replace />} />
          <Route path="/dispatch-log" element={<Navigate to="/sessions" replace />} />
          <Route path="/routing" element={<Navigate to="/sessions" replace />} />
          <Route path="/agent-runs" element={<Navigate to="/sessions" replace />} />
          <Route path="/task-queue" element={<Navigate to="/sessions" replace />} />
          <Route path="/token-spend" element={<Navigate to="/analytics" replace />} />
          <Route path="/quality-gates" element={<Navigate to="/analytics" replace />} />
          <Route path="/privacy" element={<Navigate to="/system" replace />} />
          <Route path="/castd" element={<Navigate to="/system" replace />} />
          <Route path="/rules" element={<Navigate to="/system" replace />} />
          <Route path="/knowledge" element={<Navigate to="/system" replace />} />
          <Route path="/knowledge/*" element={<Navigate to="/system" replace />} />
          <Route path="/agents/*" element={<Navigate to="/agents" replace />} />

          {/* ── Backwards compatibility ── */}
          <Route path="/local-os/token-spend" element={<Navigate to="/analytics" replace />} />
          <Route path="/local-os/agent-runs" element={<Navigate to="/sessions" replace />} />
          <Route path="/local-os/task-queue" element={<Navigate to="/sessions" replace />} />
          <Route path="/local-os/memory-browser" element={<Navigate to="/system" replace />} />
          <Route path="/local-os/castd" element={<Navigate to="/system" replace />} />
          <Route path="/local-os/sqlite-explorer" element={<Navigate to="/system" replace />} />

          {/* ── 404 catch-all ── */}
          <Route path="*" element={
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
              <span className="text-5xl font-bold text-[var(--text-muted)]">404</span>
              <p className="text-[var(--text-secondary)]">Page not found</p>
              <Link to="/" className="text-sm text-[var(--accent)] hover:underline">Back to Home</Link>
            </div>
          } />
        </Route>
      </Routes>
    </MotionConfig>
  )
}

import { Router } from 'express'
import { agentsRouter } from './agents.js'
import { sessionsRouter } from './sessions.js'
import { memoryRouter } from './memory.js'
import { plansRouter } from './plans.js'
import { configRouter } from './config.js'
import { outputsRouter } from './outputs.js'
import { rulesRouter } from './rules.js'
import { skillsRouter } from './skills.js'
import { commandsRouter } from './commands.js'
import { searchRouter } from './search.js'
import { analyticsRouter } from './analytics.js'
import { routingRouter } from './routing.js'
import { hooksRouter } from './hooks.js'
import { scriptsRouter } from './scripts.js'
import { keybindingsRouter } from './keybindings.js'
import { tasksRouter } from './tasks.js'
import { debugRouter } from './debug.js'
import { agentsLiveRouter } from './agentsLive.js'
import { controlRouter } from './control.js'
import { tokenSpendRouter } from './tokenSpend.js'
import { agentRunsRouter, activeAgentsRouter, sessionAgentsRouter, worktreesRouter, liveAgentsRouter } from './agentRuns.js'
import { taskQueueRouter } from './taskQueue.js'
import { agentMemoriesDbRouter } from './agentMemoriesDb.js'
import { castdControlRouter } from './castdControl.js'
import { sqliteExplorerRouter } from './sqliteExplorer.js'
import { seedRouter } from './seed.js'
import { budgetStatusRouter } from './budgetStatus.js'
import { castExecRouter } from './castExec.js'
import { qualityGatesRouter, dispatchDecisionsRouter } from './qualityGates.js'
import { parryGuardRouter } from './parryGuard.js'
import { agentTruncationsRouter } from './agentTruncations.js'
import { injectionLogRouter } from './injectionLog.js'
import { unstagedWarningsRouter } from './unstagedWarnings.js'
import { compactionEventsRouter } from './compactionEvents.js'
import { toolFailuresRouter } from './toolFailures.js'
import { castEventsRouter } from './castEvents.js'
import { researchCacheRouter } from './researchCache.js'
import { hookEventsRouter } from './hookEvents.js'
import { swarmRouter } from './swarm.js'
import { workLogStreamRouter } from './workLogStream.js'
import { stopFailureEventsRouter, agentProtocolViolationsRouter } from './telemetryRoutes.js'
import { castFsRouter } from './castFs.js'
import { projectFsRouter } from './projectFs.js'
import { paneBindingsRouter } from './paneBindings.js'

export const router = Router()

router.use('/agents/live', agentsLiveRouter)
// Wave 2.6 — Live agents panel (mounted BEFORE agentsRouter so /running, /stream, /runs/:id
// match before agentsRouter's /:name parameterized route shadows them)
router.use('/agents', liveAgentsRouter)
router.use('/agents', agentsRouter)
router.use('/sessions', sessionsRouter)
router.use('/memory', memoryRouter)
router.use('/plans', plansRouter)
router.use('/config', configRouter)
router.use('/outputs', outputsRouter)
router.use('/rules', rulesRouter)
router.use('/skills', skillsRouter)
router.use('/commands', commandsRouter)
router.use('/search', searchRouter)
router.use('/analytics', analyticsRouter)
// USED BY: src/api/useRouting.ts, useRoutingEventsByType.ts (Analytics/routing pages)
router.use('/routing', routingRouter)
router.use('/hooks', hooksRouter)
// TODO(alignment): no UI consumer confirmed — safe to delete if no CLI consumer
router.use('/scripts', scriptsRouter)
// TODO(alignment): no UI consumer confirmed — safe to delete if no CLI consumer
router.use('/keybindings', keybindingsRouter)
// TODO(alignment): no UI consumer confirmed — safe to delete if no CLI consumer
router.use('/tasks', tasksRouter)
// TODO(alignment): no UI consumer confirmed — safe to delete if no CLI consumer
router.use('/debug', debugRouter)
// USED BY: src/components/ControlPanel/DispatchModal.tsx + SystemView.tsx (dispatch panel)
router.use('/control', controlRouter)
router.use('/cast/token-spend', tokenSpendRouter)
router.use('/cast/active-agents', activeAgentsRouter)
router.use('/cast/agent-runs', agentRunsRouter)
router.use('/cast/session-agents', sessionAgentsRouter)
// USED BY: src/api/useSessionAgents.ts (session agents page worktree display)
router.use('/cast/worktrees', worktreesRouter)
router.use('/cast/task-queue', taskQueueRouter)
router.use('/cast/memories', agentMemoriesDbRouter)
router.use('/castd', castdControlRouter)
router.use('/cast/explore', sqliteExplorerRouter)
// USED BY: src/api/useSeed.ts (seed panel in frontend)
if (process.env.NODE_ENV === 'development') {
  router.use('/cast/seed', seedRouter)
}

if (process.env.NODE_ENV === 'development') {
  router.use('/budget', budgetStatusRouter)
}
router.use('/cast', castExecRouter)

router.use('/quality-gates', qualityGatesRouter)
router.use('/dispatch-decisions', dispatchDecisionsRouter)
router.use('/parry-guard', parryGuardRouter)
router.use('/agent-truncations', agentTruncationsRouter)
router.use('/injection-log', injectionLogRouter)
router.use('/unstaged-warnings', unstagedWarningsRouter)
router.use('/cast/compaction-events', compactionEventsRouter)
router.use('/cast/tool-failures', toolFailuresRouter)
router.use('/cast/events', castEventsRouter)
// USED BY: src/api/useCastData.ts (research cache stats panel)
router.use('/cast/research-cache', researchCacheRouter)
router.use('/hook-events', hookEventsRouter)
router.use('/swarm', swarmRouter)
// Phase 2 — work-log feed backend
router.use('/work-log-stream', workLogStreamRouter)
// Phase 3 prep — governance annotation data sources
router.use('/stop-failure-events', stopFailureEventsRouter)
router.use('/agent-protocol-violations', agentProtocolViolationsRouter)
// Wave 2.3a — Cast filesystem tree (read-only access to ~/.claude/)
router.use('/cast-fs', castFsRouter)
// Wave 2.3b — Project filesystem tree (read-only access to process.cwd())
router.use('/project-fs', projectFsRouter)
// Wave 2.4 — PTY pane session bindings
router.use('/pane-bindings', paneBindingsRouter)

// Top-level health shortcut
router.get('/health', (req, res, next) => {
  req.url = '/health'
  configRouter(req, res, next)
})

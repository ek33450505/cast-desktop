import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Database, ChevronRight, ArrowUp, ArrowDown, Search } from 'lucide-react'
import { useSqliteTables, useSqliteTable, useSqliteTableSchema } from '../api/useSqliteExplorer'
import type { SqliteTableMeta, SqliteColumnInfo } from '../api/useSqliteExplorer'
import RowDetailModal from '../components/RowDetailModal'

// ── Group map ─────────────────────────────────────────────────────────────────

const GROUP_MAP: Record<string, string> = {
  // Sessions
  sessions: 'Sessions',
  session_context: 'Sessions',
  // Agents
  agent_runs: 'Agents',
  dispatch_decisions: 'Agents',
  routing_events: 'Agents',
  // Hooks — hook_failures is first in the group (see GROUPS order)
  hook_failures: 'Hooks',
  stop_failure_events: 'Hooks',
  parry_guard_events: 'Hooks',
  // Memory
  agent_memories: 'Memory',
  injection_log: 'Memory',
  agent_hallucinations: 'Memory',
  // Quality
  quality_gates: 'Quality',
  quality_gate_results: 'Quality',
  // Routing
  swarm_sessions: 'Routing',
  // System
  worktree_anomalies: 'System',
  agent_truncations: 'System',
}

// Canonical group order; hook_failures sorts to top within Hooks (see sort logic)
const GROUPS = ['Sessions', 'Agents', 'Hooks', 'Memory', 'Quality', 'Routing', 'System', 'Other']

// ── Sidebar ───────────────────────────────────────────────────────────────────

interface SidebarProps {
  tables: SqliteTableMeta[]
  selectedTable: string | null
  onSelect: (name: string) => void
}

function Sidebar({ tables, selectedTable, onSelect }: SidebarProps) {
  // Group tables
  const grouped = useMemo(() => {
    const map = new Map<string, SqliteTableMeta[]>()
    for (const group of GROUPS) map.set(group, [])

    for (const tbl of tables) {
      const group = GROUP_MAP[tbl.name] ?? 'Other'
      map.get(group)!.push(tbl)
    }

    // Within Hooks: hook_failures first
    const hooksGroup = map.get('Hooks')!
    hooksGroup.sort((a, b) => {
      if (a.name === 'hook_failures') return -1
      if (b.name === 'hook_failures') return 1
      return a.name.localeCompare(b.name)
    })

    return map
  }, [tables])

  function handleKeyDown(e: React.KeyboardEvent, name: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(name)
    }
  }

  return (
    <nav
      aria-label="Database tables"
      className="h-full overflow-y-auto py-2"
      style={{ background: 'var(--system-panel)', borderRight: '1px solid var(--border)' }}
    >
      {GROUPS.map(group => {
        const groupTables = grouped.get(group) ?? []
        if (groupTables.length === 0) return null
        const headingId = `db-group-${group.toLowerCase()}`
        return (
          <div key={group} className="mb-3">
            <h3
              id={headingId}
              className="px-3 py-1 text-[10px] uppercase tracking-widest font-semibold"
              style={{ color: 'var(--content-muted)' }}
            >
              {group}
            </h3>
            <ul role="group" aria-labelledby={headingId}>
              {groupTables.map(tbl => {
                const isActive = tbl.name === selectedTable
                return (
                  <li key={tbl.name}>
                    <button
                      type="button"
                      onClick={() => onSelect(tbl.name)}
                      onKeyDown={(e) => handleKeyDown(e, tbl.name)}
                      className={[
                        'w-full flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-left motion-safe:transition-colors',
                        'min-h-[44px]',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-[-2px]',
                        isActive
                          ? 'text-[var(--accent)] font-medium'
                          : 'text-[var(--content-secondary)] hover:text-[var(--content-primary)] hover:bg-[var(--system-elevated)]',
                      ].join(' ')}
                      aria-current={isActive ? 'true' : undefined}
                      aria-label={`Select table ${tbl.name}, ${tbl.rowCount} rows`}
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        {isActive && <ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />}
                        <span className="font-mono truncate">{tbl.name}</span>
                      </span>
                      <span
                        className="text-[10px] shrink-0 tabular-nums"
                        style={{ color: 'var(--content-muted)' }}
                      >
                        {tbl.rowCount.toLocaleString()}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )
}

// ── Sort direction type ───────────────────────────────────────────────────────

type SortDir = 'asc' | 'desc'

// ── Rows tab ──────────────────────────────────────────────────────────────────

const LIMIT = 50

interface RowsTabProps {
  tableName: string
  totalRows: number
}

function RowsTab({ tableName, totalRows }: RowsTabProps) {
  const [page, setPage] = useState(0)
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [filterText, setFilterText] = useState('')
  const [selectedRow, setSelectedRow] = useState<Record<string, unknown> | null>(null)
  const lastClickedRowRef = useRef<HTMLTableRowElement | null>(null)

  // Reset page + sort when table changes
  useEffect(() => {
    setPage(0)
    setSortCol(null)
    setSortDir('asc')
    setFilterText('')
  }, [tableName])

  const { data, isLoading, error } = useSqliteTable(tableName, {
    limit: LIMIT,
    offset: page * LIMIT,
    sort: sortCol ?? undefined,
    dir: sortDir,
  })

  const columns = data?.columns ?? []
  const rows = data?.rows ?? []
  const total = data?.total ?? totalRows

  // Client-side filter over visible page rows
  const filteredRows = useMemo(() => {
    if (!filterText.trim()) return rows
    const q = filterText.toLowerCase()
    return rows.filter(row =>
      Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q))
    )
  }, [rows, filterText])

  const totalPages = Math.max(1, Math.ceil(total / LIMIT))

  function handleSortClick(col: string) {
    if (sortCol === col) {
      if (sortDir === 'asc') {
        setSortDir('desc')
      } else {
        // cycle: asc → desc → none
        setSortCol(null)
        setSortDir('asc')
      }
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
    setPage(0)
  }

  function ariaSortValue(col: string): 'ascending' | 'descending' | 'none' {
    if (sortCol !== col) return 'none'
    return sortDir === 'asc' ? 'ascending' : 'descending'
  }

  function handleRowClick(row: Record<string, unknown>, rowEl: HTMLTableRowElement) {
    lastClickedRowRef.current = rowEl
    setSelectedRow(row)
  }

  function handleRowKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>, row: Record<string, unknown>, rowEl: HTMLTableRowElement) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleRowClick(row, rowEl)
    }
  }

  function handleModalClose() {
    setSelectedRow(null)
    lastClickedRowRef.current?.focus()
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <label
          htmlFor="db-filter"
          className="text-xs font-medium shrink-0"
          style={{ color: 'var(--content-muted)' }}
        >
          Filter
        </label>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" aria-hidden="true" style={{ color: 'var(--content-muted)' }} />
          <input
            id="db-filter"
            type="text"
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            placeholder="Filter visible rows…"
            aria-describedby="db-filter-hint"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
            style={{
              background: 'var(--system-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--content-primary)',
            }}
          />
        </div>
        <span id="db-filter-hint" className="sr-only">
          Filters the currently visible page of rows
        </span>
        <span className="text-[11px] ml-auto" style={{ color: 'var(--content-muted)' }}>
          {total.toLocaleString()} rows total
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-32 text-xs" style={{ color: 'var(--content-muted)' }}>
            Loading…
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center h-32 text-xs" style={{ color: 'var(--content-muted)' }}>
            Failed to load rows
          </div>
        )}
        {!isLoading && !error && (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ background: 'var(--system-panel)', borderBottom: '1px solid var(--border)' }}>
                {columns.map(col => (
                  <th
                    key={col}
                    scope="col"
                    aria-sort={ariaSortValue(col)}
                    className="text-left px-3 py-2 font-medium whitespace-nowrap"
                    style={{ color: 'var(--content-muted)' }}
                  >
                    <button
                      type="button"
                      onClick={() => handleSortClick(col)}
                      aria-label={`Sort by ${col}`}
                      className={[
                        'flex items-center gap-1 min-h-[44px] min-w-[44px] px-1 rounded motion-safe:transition-colors',
                        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
                        'hover:text-[var(--content-primary)]',
                      ].join(' ')}
                      style={{ color: 'var(--content-muted)' }}
                    >
                      {col}
                      {sortCol === col && sortDir === 'asc' && <ArrowUp className="w-3 h-3 shrink-0" aria-hidden="true" />}
                      {sortCol === col && sortDir === 'desc' && <ArrowDown className="w-3 h-3 shrink-0" aria-hidden="true" />}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length || 1}
                    className="px-3 py-8 text-center"
                    style={{ color: 'var(--content-muted)' }}
                  >
                    {filterText ? 'No rows match filter' : 'No rows'}
                  </td>
                </tr>
              )}
              {filteredRows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  tabIndex={0}
                  role="row"
                  onClick={(e) => handleRowClick(row, e.currentTarget)}
                  onKeyDown={(e) => handleRowKeyDown(e, row, e.currentTarget)}
                  aria-label={`Row ${rowIdx + 1} of ${filteredRows.length}`}
                  className={[
                    'cursor-pointer motion-safe:transition-colors',
                    'hover:bg-[var(--system-elevated)]',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-[-2px]',
                  ].join(' ')}
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  {columns.map(col => (
                    <td
                      key={col}
                      className="px-3 py-2 max-w-[240px] truncate"
                      style={{ color: 'var(--content-secondary)' }}
                      title={String(row[col] ?? '')}
                    >
                      {row[col] == null
                        ? <span style={{ color: 'var(--content-muted)', fontStyle: 'italic' }}>null</span>
                        : String(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div
        className="flex items-center justify-center gap-3 px-4 py-2"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <button
          type="button"
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
          aria-label="Previous page"
          className={[
            'flex items-center justify-center min-h-[44px] min-w-[44px] px-3 rounded-lg text-xs font-medium motion-safe:transition-colors',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
            page === 0
              ? 'opacity-40 cursor-not-allowed'
              : 'hover:bg-[var(--system-elevated)] cursor-pointer',
          ].join(' ')}
          style={{ color: 'var(--content-secondary)' }}
        >
          ← Prev
        </button>
        <span className="text-xs" style={{ color: 'var(--content-muted)' }}>
          Page {page + 1} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
          aria-label="Next page"
          className={[
            'flex items-center justify-center min-h-[44px] min-w-[44px] px-3 rounded-lg text-xs font-medium motion-safe:transition-colors',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)]',
            page >= totalPages - 1
              ? 'opacity-40 cursor-not-allowed'
              : 'hover:bg-[var(--system-elevated)] cursor-pointer',
          ].join(' ')}
          style={{ color: 'var(--content-secondary)' }}
        >
          Next →
        </button>
      </div>

      {/* Row detail modal */}
      {selectedRow && (
        <RowDetailModal
          table={tableName}
          row={selectedRow}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}

// ── Schema tab ────────────────────────────────────────────────────────────────

interface SchemaTabProps {
  tableName: string
}

function SchemaTab({ tableName }: SchemaTabProps) {
  const { data: schema, isLoading, error } = useSqliteTableSchema(tableName)
  const columns = (schema ?? []) as SqliteColumnInfo[]

  return (
    <div className="flex-1 min-h-0 overflow-auto">
      {isLoading && (
        <div className="flex items-center justify-center h-32 text-xs" style={{ color: 'var(--content-muted)' }}>
          Loading schema…
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center h-32 text-xs" style={{ color: 'var(--content-muted)' }}>
          Failed to load schema
        </div>
      )}
      {!isLoading && !error && (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ background: 'var(--system-panel)', borderBottom: '1px solid var(--border)' }}>
              {(['Name', 'Type', 'Nullable', 'Default', 'PK'] as const).map(col => (
                <th
                  key={col}
                  scope="col"
                  className="text-left px-3 py-2 font-medium"
                  style={{ color: 'var(--content-muted)' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {columns.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center" style={{ color: 'var(--content-muted)' }}>
                  No schema data
                </td>
              </tr>
            )}
            {columns.map(col => (
              <tr
                key={col.cid}
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <td className="px-3 py-2 font-mono font-medium" style={{ color: 'var(--content-primary)' }}>
                  {col.name}
                  {col.pk > 0 && (
                    <span className="ml-1.5 text-[10px] px-1 py-0.5 rounded" style={{ background: 'var(--accent)22', color: 'var(--accent)' }}>
                      PK
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 font-mono" style={{ color: 'var(--content-secondary)' }}>{col.type}</td>
                <td className="px-3 py-2" style={{ color: 'var(--content-secondary)' }}>
                  {col.notnull ? 'No' : 'Yes'}
                </td>
                <td className="px-3 py-2 font-mono" style={{ color: 'var(--content-muted)' }}>
                  {col.dflt_value ?? <span style={{ fontStyle: 'italic' }}>null</span>}
                </td>
                <td className="px-3 py-2 text-center" style={{ color: 'var(--content-muted)' }}>
                  {col.pk > 0 ? '✓' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// ── Tab switcher ──────────────────────────────────────────────────────────────

type ActiveTab = 'rows' | 'schema'

interface TabSwitcherProps {
  activeTab: ActiveTab
  onChange: (tab: ActiveTab) => void
}

function TabSwitcher({ activeTab, onChange }: TabSwitcherProps) {
  const tabs: { id: ActiveTab; label: string }[] = [
    { id: 'rows', label: 'Rows' },
    { id: 'schema', label: 'Schema' },
  ]

  return (
    <div
      role="tablist"
      aria-label="Table view"
      className="flex"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {tabs.map(tab => (
        <button
          key={tab.id}
          role="tab"
          type="button"
          id={`db-tab-${tab.id}`}
          aria-selected={activeTab === tab.id}
          aria-controls={`db-tabpanel-${tab.id}`}
          onClick={() => onChange(tab.id)}
          className={[
            'px-4 py-2.5 text-sm font-medium relative motion-safe:transition-colors',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-[-2px]',
            'min-h-[44px] min-w-[44px]',
            activeTab === tab.id
              ? 'text-[var(--accent)]'
              : 'hover:text-[var(--content-primary)]',
          ].join(' ')}
          style={{ color: activeTab === tab.id ? 'var(--accent)' : 'var(--content-muted)' }}
        >
          {tab.label}
          {activeTab === tab.id && (
            <span
              className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
              style={{ background: 'var(--accent)' }}
            />
          )}
        </button>
      ))}
    </div>
  )
}

// ── DbPage ────────────────────────────────────────────────────────────────────

export function DbPage() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('rows')

  const { data, isLoading, error } = useSqliteTables()
  const tables = data?.tables ?? []

  const selectedMeta = tables.find(t => t.name === selectedTable)

  // When the selected table changes, reset to Rows tab
  const handleSelectTable = useCallback((name: string) => {
    setSelectedTable(name)
    setActiveTab('rows')
  }, [])

  const handleTabChange = useCallback((tab: ActiveTab) => {
    setActiveTab(tab)
  }, [])

  return (
    <div
      className="flex h-full min-h-0"
      style={{ background: 'var(--system-canvas)' }}
    >
      {/* ── Left sidebar ── */}
      <div
        className="w-56 shrink-0 min-h-0 flex flex-col"
        style={{ borderRight: '1px solid var(--border)' }}
      >
        {/* Sidebar header */}
        <div
          className="flex items-center gap-2 px-3 py-3"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <Database className="w-4 h-4 shrink-0" aria-hidden="true" style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--content-primary)' }}>
            cast.db
          </span>
        </div>

        {/* Table list */}
        {isLoading && (
          <div className="flex items-center justify-center flex-1 text-xs" style={{ color: 'var(--content-muted)' }}>
            Loading…
          </div>
        )}
        {error && (
          <div className="flex items-center justify-center flex-1 text-xs" style={{ color: 'var(--content-muted)' }}>
            Failed to load tables
          </div>
        )}
        {!isLoading && !error && (
          <Sidebar
            tables={tables}
            selectedTable={selectedTable}
            onSelect={handleSelectTable}
          />
        )}
      </div>

      {/* ── Center pane ── */}
      <main
        className="flex-1 min-w-0 flex flex-col min-h-0"
        style={{ background: 'var(--system-canvas)' }}
      >
        {!selectedTable ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Database className="w-10 h-10" aria-hidden="true" style={{ color: 'var(--content-muted)', opacity: 0.4 }} />
            <p className="text-sm" style={{ color: 'var(--content-muted)' }}>
              Select a table to browse
            </p>
          </div>
        ) : (
          <>
            {/* Table heading */}
            <div
              className="flex items-center gap-2 px-4 py-2.5"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--system-panel)' }}
            >
              <span className="font-mono text-sm font-medium" style={{ color: 'var(--content-primary)' }}>
                {selectedTable}
              </span>
              {selectedMeta && (
                <span className="text-xs tabular-nums" style={{ color: 'var(--content-muted)' }}>
                  {selectedMeta.rowCount.toLocaleString()} rows
                </span>
              )}
            </div>

            {/* Tab switcher */}
            <TabSwitcher activeTab={activeTab} onChange={handleTabChange} />

            {/* Tab panels */}
            <div
              id="db-tabpanel-rows"
              role="tabpanel"
              tabIndex={0}
              aria-labelledby="db-tab-rows"
              className={[
                'flex-1 min-h-0 flex flex-col',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-[-2px]',
              ].join(' ')}
              hidden={activeTab !== 'rows'}
            >
              {activeTab === 'rows' && (
                <RowsTab
                  tableName={selectedTable}
                  totalRows={selectedMeta?.rowCount ?? 0}
                />
              )}
            </div>

            <div
              id="db-tabpanel-schema"
              role="tabpanel"
              tabIndex={0}
              aria-labelledby="db-tab-schema"
              className={[
                'flex-1 min-h-0 flex flex-col overflow-auto',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-[-2px]',
              ].join(' ')}
              hidden={activeTab !== 'schema'}
            >
              {activeTab === 'schema' && (
                <SchemaTab tableName={selectedTable} />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

// Re-export as default for lazy loading compatibility
export default DbPage

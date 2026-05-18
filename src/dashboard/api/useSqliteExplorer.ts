import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './apiFetch'

export interface SqliteTableMeta {
  name: string
  rowCount: number
}

export interface SqliteTablesData {
  tables: SqliteTableMeta[]
}

export interface SqliteTableData {
  columns: string[]
  rows: Record<string, unknown>[]
  total: number
  nullColumns: string[]
}

// PRAGMA table_info row shape returned by GET /cast/explore/schema/:table
export interface SqliteColumnInfo {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: string | null
  pk: number
}

export interface SqliteTableParams {
  limit?: number
  offset?: number
  sort?: string
  dir?: 'asc' | 'desc'
}

async function fetchSqliteTables(): Promise<SqliteTablesData> {
  return apiFetch<SqliteTablesData>('/api/cast/explore/tables')
}

async function fetchSqliteTable(table: string, params: SqliteTableParams): Promise<SqliteTableData> {
  const searchParams = new URLSearchParams()
  if (params.limit) searchParams.set('limit', String(params.limit))
  if (params.offset) searchParams.set('offset', String(params.offset))
  // Only include sort/dir when sort is defined — backend ignores missing sort param
  if (params.sort) {
    searchParams.set('sort', params.sort)
    searchParams.set('dir', params.dir ?? 'asc')
  }
  const url = `/api/cast/explore/${table}${searchParams.toString() ? `?${searchParams}` : ''}`
  return apiFetch<SqliteTableData>(url)
}

async function fetchSqliteTableSchema(table: string): Promise<SqliteColumnInfo[]> {
  return apiFetch<SqliteColumnInfo[]>(`/api/cast/explore/schema/${table}`)
}

// Verification: useSqliteTables calls /api/cast/explore/tables — this is correct.
// The backend now returns the dynamic table list (from getAllowedTables via sqlite_master)
// rather than the old hardcoded 7-table allowlist. No URL change needed here.
export const useSqliteTables = () =>
  useQuery({
    queryKey: ['cast', 'explore', 'tables'],
    queryFn: fetchSqliteTables,
    staleTime: 10_000,
  })

export const useSqliteTable = (
  table: string | null,
  options: { limit?: number; offset?: number; sort?: string; dir?: 'asc' | 'desc' } = {}
) => {
  const { limit = 50, offset = 0, sort, dir = 'asc' } = options
  // Include sort + dir in queryKey so React Query re-fetches when sort changes
  return useQuery({
    queryKey: ['cast', 'explore', 'table', table, limit, offset, sort, dir],
    queryFn: () => fetchSqliteTable(table!, { limit, offset, sort, dir }),
    enabled: !!table,
    staleTime: 30_000,
  })
}

export const useSqliteTableSchema = (table: string) =>
  useQuery({
    queryKey: ['cast', 'explore', 'schema', table],
    queryFn: () => fetchSqliteTableSchema(table),
    staleTime: 60_000, // schema changes rarely
    enabled: !!table,
  })

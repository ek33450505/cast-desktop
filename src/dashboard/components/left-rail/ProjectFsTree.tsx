import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEvent } from '../../../lib/SseManager'
import type { LiveEvent } from '../../../types'
import { Folder, FolderOpen, File, ChevronRight, ChevronDown } from 'lucide-react'
import type { PreviewTarget } from './CastFsTree'

// ── types ─────────────────────────────────────────────────────────────────────

interface TreeNode {
  name: string
  path: string
  type: 'dir' | 'file'
  mtime: number
  size: number
  children?: TreeNode[]
}

interface ProjectFsTreeProps {
  onPreview: (target: PreviewTarget, triggerEl?: HTMLElement) => void
}

// ── fetcher ───────────────────────────────────────────────────────────────────

async function fetchTreeNode(dir: string): Promise<TreeNode> {
  const res = await fetch(`/api/project-fs/tree?dir=${encodeURIComponent(dir)}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<TreeNode>
}

// ── SSE for invalidation ──────────────────────────────────────────────────────

// Exported so tests can verify it's used
export function useProjectFsStream(rootPath: string) {
  const queryClient = useQueryClient()

  useEvent<LiveEvent>('project_fs_change', (e) => {
    if (e.fsPath) {
      const dir = e.fsPath.split('/').slice(0, -1).join('/')
      if (dir) {
        void queryClient.invalidateQueries({ queryKey: ['projectFs', dir] })
        const parent = dir.split('/').slice(0, -1).join('/')
        if (parent && parent.length >= rootPath.length) {
          void queryClient.invalidateQueries({ queryKey: ['projectFs', parent] })
        }
      }
    }
  })
}

// ── FolderNode component ──────────────────────────────────────────────────────

interface FolderNodeProps {
  dirPath: string
  name: string
  depth: number
  onPreview: (target: PreviewTarget, triggerEl?: HTMLElement) => void
  initialExpanded?: boolean
}

function FolderNode({ dirPath, name, depth, onPreview, initialExpanded = false }: FolderNodeProps) {
  const [expanded, setExpanded] = useState(initialExpanded)
  const childrenId = `project-dir-${dirPath.replace(/[^a-zA-Z0-9]/g, '-')}`

  const { data, isLoading } = useQuery({
    queryKey: ['projectFs', dirPath],
    queryFn: () => fetchTreeNode(dirPath),
    enabled: expanded,
    staleTime: 30_000,
  })

  const children = data?.children ?? []

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
        aria-controls={expanded ? childrenId : undefined}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} folder ${name}`}
        className="w-full flex items-center gap-1.5 text-left hover:bg-[var(--bg-tertiary)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cast-accent)] focus-visible:outline-offset-[-2px] rounded-sm"
        style={{
          paddingLeft: `${8 + depth * 12}px`,
          paddingRight: '8px',
          minHeight: '32px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <span className="flex-shrink-0 text-[var(--text-muted)]">
          {expanded
            ? <ChevronDown className="w-3 h-3" aria-hidden="true" />
            : <ChevronRight className="w-3 h-3" aria-hidden="true" />
          }
        </span>
        <span className="flex-shrink-0 text-[var(--text-muted)]">
          {expanded
            ? <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
            : <Folder className="w-3.5 h-3.5" aria-hidden="true" />
          }
        </span>
        <span className="text-xs text-[var(--text-secondary)] truncate select-none">
          {name}
        </span>
        {isLoading && expanded && (
          <span className="ml-auto text-[10px] text-[var(--text-muted)]" aria-hidden="true">…</span>
        )}
      </button>

      {expanded && (
        <div id={childrenId} role="list">
          {children.map(child => (
            <div key={child.path} role="listitem">
              {child.type === 'dir' ? (
                <FolderNode
                  dirPath={child.path}
                  name={child.name}
                  depth={depth + 1}
                  onPreview={onPreview}
                />
              ) : (
                <FileNode
                  node={child}
                  depth={depth + 1}
                  onPreview={onPreview}
                />
              )}
            </div>
          ))}
          {!isLoading && children.length === 0 && (
            <p
              className="text-[10px] text-[var(--text-muted)] select-none"
              style={{ paddingLeft: `${8 + (depth + 1) * 12}px` }}
            >
              Empty
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── FileNode component ────────────────────────────────────────────────────────

interface FileNodeProps {
  node: TreeNode
  depth: number
  onPreview: (target: PreviewTarget, triggerEl?: HTMLElement) => void
}

function FileNode({ node, depth, onPreview }: FileNodeProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        onPreview(
          { section: 'plans', name: node.name, path: node.path, source: 'project' },
          e.currentTarget,
        )
      }}
      aria-label={`Preview project file: ${node.name}`}
      title={node.path}
      className="w-full flex items-center gap-1.5 text-left hover:bg-[var(--bg-tertiary)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cast-accent)] focus-visible:outline-offset-[-2px] rounded-sm"
      style={{
        paddingLeft: `${8 + depth * 12}px`,
        paddingRight: '8px',
        minHeight: '32px',
        display: 'flex',
        alignItems: 'center',
        color: 'var(--text-secondary)',
      }}
    >
      <File className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" aria-hidden="true" />
      <span className="text-xs truncate">{node.name}</span>
    </button>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export default function ProjectFsTree({ onPreview }: ProjectFsTreeProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['projectFs', '__root__'],
    queryFn: () => fetchTreeNode(''),
    staleTime: 30_000,
  })

  const rootPath = data?.path ?? ''
  useProjectFsStream(rootPath)

  if (isLoading) {
    return (
      <div className="px-3 py-2 space-y-1" aria-label="Loading project tree">
        {[1, 2, 3].map(i => (
          <div
            key={i}
            className="h-4 rounded bg-[var(--bg-tertiary)] animate-pulse"
            style={{ width: `${40 + i * 14}%` }}
            aria-hidden="true"
          />
        ))}
      </div>
    )
  }

  if (!data) return null

  const children = data.children ?? []

  return (
    <div role="list">
      {children.map(child => (
        <div key={child.path} role="listitem">
          {child.type === 'dir' ? (
            <FolderNode
              dirPath={child.path}
              name={child.name}
              depth={0}
              onPreview={onPreview}
            />
          ) : (
            <FileNode
              node={child}
              depth={0}
              onPreview={onPreview}
            />
          )}
        </div>
      ))}
      {children.length === 0 && (
        <p className="px-3 py-1 text-xs text-[var(--text-muted)] select-none">
          No files
        </p>
      )}
    </div>
  )
}

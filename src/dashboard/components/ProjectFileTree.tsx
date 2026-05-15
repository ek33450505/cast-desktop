import { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react'

// ── Tauri fs integration ───────────────────────────────────────────────────────
// readDir is wrapped in a try/catch so the component degrades gracefully in
// browser dev mode (no Tauri) — shows an error message instead of crashing.
//
// Tauri plugin-fs DirEntry has: { name, isDirectory, isFile, isSymlink }
// It does NOT include a `path` field — we construct the full path from the
// parent directory path + entry.name.

interface FileNode {
  name: string
  fullPath: string
  isDirectory: boolean
}

async function readDirectory(dirPath: string): Promise<FileNode[]> {
  const { readDir } = await import('@tauri-apps/plugin-fs')
  const entries = await readDir(dirPath)
  return entries.map((e) => ({
    name: e.name,
    fullPath: dirPath.replace(/\/$/, '') + '/' + e.name,
    isDirectory: e.isDirectory,
  }))
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FileTreeNode {
  name: string
  path: string
  isDir: boolean
  children?: FileTreeNode[]
}

interface ProjectFileTreeProps {
  rootPath: string
  onOpenFile: (path: string) => void
}

// ── TreeItem ──────────────────────────────────────────────────────────────────
// Renders a single file or directory node with keyboard navigation.

interface TreeItemProps {
  node: FileTreeNode
  level: number
  onOpenFile: (path: string) => void
  isSelected: boolean
  onSelect: (path: string) => void
}

function TreeItem({ node, level, onOpenFile, isSelected, onSelect }: TreeItemProps) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<FileTreeNode[] | null>(null)
  const [loading, setLoading] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const loadChildren = useCallback(async () => {
    if (!node.isDir || children !== null) return
    setLoading(true)
    try {
      const entries = await readDirectory(node.path)
      const nodes: FileTreeNode[] = entries
        .filter((e) => e.name && !e.name.startsWith('.'))
        .map((e) => ({
          name: e.name,
          path: e.fullPath,
          isDir: e.isDirectory,
        }))
        .sort((a, b) => {
          // Directories first, then alphabetical
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
          return a.name.localeCompare(b.name)
        })
      setChildren(nodes)
    } catch (err) {
      console.error('[ProjectFileTree] failed to read dir', node.path, err)
      setChildren([])
    } finally {
      setLoading(false)
    }
  }, [node.isDir, node.path, children])

  const handleClick = useCallback(() => {
    onSelect(node.path)
    if (node.isDir) {
      const willExpand = !expanded
      setExpanded(willExpand)
      if (willExpand) loadChildren()
    } else {
      onOpenFile(node.path)
    }
  }, [node.isDir, node.path, expanded, onOpenFile, onSelect, loadChildren])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault()
          if (node.isDir) {
            handleClick()
          } else {
            onOpenFile(node.path)
          }
          break
        case ' ':
          e.preventDefault()
          if (node.isDir) {
            handleClick()
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          if (node.isDir && !expanded) {
            setExpanded(true)
            loadChildren()
          }
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (node.isDir && expanded) {
            setExpanded(false)
          }
          break
      }
    },
    [node.isDir, node.path, expanded, handleClick, onOpenFile, loadChildren],
  )

  const indentPx = level * 12 + 8

  return (
    <li
      role="treeitem"
      aria-expanded={node.isDir ? expanded : undefined}
      aria-level={level}
      aria-selected={isSelected}
    >
      <button
        ref={buttonRef}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        aria-label={node.isDir ? `${node.name}, folder, ${expanded ? 'expanded' : 'collapsed'}` : node.name}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          width: '100%',
          paddingLeft: indentPx,
          paddingRight: 8,
          paddingTop: 3,
          paddingBottom: 3,
          border: 'none',
          background: isSelected ? 'var(--accent-subtle, rgba(0,255,194,0.08))' : 'transparent',
          color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
          cursor: 'pointer',
          fontSize: '0.8125rem',
          textAlign: 'left',
          outline: 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minHeight: 28,
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--cast-accent)'
          e.currentTarget.style.outlineOffset = '-2px'
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none'
        }}
        onMouseEnter={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'var(--bg-tertiary)'
        }}
        onMouseLeave={(e) => {
          if (!isSelected) e.currentTarget.style.background = 'transparent'
        }}
      >
        {/* Chevron for directories */}
        {node.isDir ? (
          expanded ? (
            <ChevronDown size={12} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
          ) : (
            <ChevronRight size={12} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
          )
        ) : (
          <span style={{ width: 12, flexShrink: 0 }} aria-hidden="true" />
        )}

        {/* Icon */}
        {node.isDir
          ? expanded
            ? <FolderOpen size={14} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--cast-accent, #00FFC2)' }} />
            : <Folder size={14} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
          : <File size={14} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
        }

        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
          {loading ? `${node.name} …` : node.name}
        </span>
      </button>

      {/* Children */}
      {node.isDir && expanded && children && children.length > 0 && (
        <ul role="group" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              level={level + 1}
              onOpenFile={onOpenFile}
              isSelected={isSelected && child.path === node.path}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}

      {node.isDir && expanded && children && children.length === 0 && (
        <li
          role="treeitem"
          aria-level={level + 1}
          style={{
            paddingLeft: indentPx + 16,
            paddingTop: 2,
            paddingBottom: 2,
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            listStyle: 'none',
            userSelect: 'none',
          }}
        >
          Empty folder
        </li>
      )}
    </li>
  )
}

// ── ProjectFileTree ───────────────────────────────────────────────────────────
// Recursive collapsible file tree rooted at rootPath.
// Uses Tauri's @tauri-apps/plugin-fs readDir. Degrades gracefully in browser.

export function ProjectFileTree({ rootPath, onOpenFile }: ProjectFileTreeProps) {
  const [rootChildren, setRootChildren] = useState<FileTreeNode[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setRootChildren(null)
    setError(null)

    readDirectory(rootPath)
      .then((entries) => {
        if (cancelled) return
        const nodes: FileTreeNode[] = entries
          .filter((e) => e.name && !e.name.startsWith('.'))
          .map((e) => ({
            name: e.name,
            path: e.fullPath,
            isDir: e.isDirectory,
          }))
          .sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
            return a.name.localeCompare(b.name)
          })
        setRootChildren(nodes)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[ProjectFileTree] failed to read root', rootPath, err)
        setError('Could not read directory. Run in Tauri desktop app.')
      })

    return () => { cancelled = true }
  }, [rootPath])

  if (error) {
    return (
      <div
        role="region"
        aria-label="Project file tree — error"
        style={{
          padding: '12px 8px',
          color: 'var(--text-muted)',
          fontSize: '0.75rem',
          lineHeight: 1.4,
        }}
      >
        {error}
      </div>
    )
  }

  if (!rootChildren) {
    return (
      <div
        role="region"
        aria-label="Project file tree — loading"
        aria-busy="true"
        style={{ padding: '12px 8px', color: 'var(--text-muted)', fontSize: '0.75rem' }}
      >
        Loading…
      </div>
    )
  }

  return (
    <nav aria-label="Project file tree">
      <ul
        role="tree"
        aria-label={`Files in ${rootPath.split('/').pop() ?? rootPath}`}
        style={{ listStyle: 'none', margin: 0, padding: 0 }}
      >
        {rootChildren.map((node) => (
          <TreeItem
            key={node.path}
            node={node}
            level={1}
            onOpenFile={onOpenFile}
            isSelected={selectedPath === node.path}
            onSelect={setSelectedPath}
          />
        ))}
      </ul>
    </nav>
  )
}

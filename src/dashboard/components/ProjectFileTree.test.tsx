import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { ProjectFileTree } from './ProjectFileTree'

// Mock Tauri fs plugin — plugin-fs is not available in the npm registry
// (it's injected by Tauri at runtime). We mock the module factory so tests
// run in jsdom without a Tauri binary.
const mockReadDir = vi.fn()

vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: (...args: unknown[]) => mockReadDir(...args),
}))

// Matches Tauri plugin-fs DirEntry shape: { name, isDirectory, isFile, isSymlink }
// Note: no `path` field — readDirectory() constructs the full path from parent + name.
const MOCK_ENTRIES = [
  { name: 'src', isDirectory: true, isFile: false, isSymlink: false },
  { name: 'README.md', isDirectory: false, isFile: true, isSymlink: false },
  { name: '.git', isDirectory: true, isFile: false, isSymlink: false },
]

beforeEach(() => {
  mockReadDir.mockResolvedValue(MOCK_ENTRIES)
})

describe('ProjectFileTree', () => {
  it('renders loading state initially', () => {
    render(<ProjectFileTree rootPath="/proj" onOpenFile={() => {}} />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders tree items after data loads', async () => {
    render(<ProjectFileTree rootPath="/proj" onOpenFile={() => {}} />)
    await waitFor(() => {
      expect(screen.getByText('src')).toBeInTheDocument()
      expect(screen.getByText('README.md')).toBeInTheDocument()
    })
  })

  it('filters hidden files (dot-prefixed)', async () => {
    render(<ProjectFileTree rootPath="/proj" onOpenFile={() => {}} />)
    await waitFor(() => {
      expect(screen.queryByText('.git')).not.toBeInTheDocument()
    })
  })

  it('calls onOpenFile when a file is clicked', async () => {
    const onOpenFile = vi.fn()
    render(<ProjectFileTree rootPath="/proj" onOpenFile={onOpenFile} />)
    await waitFor(() => screen.getByText('README.md'))
    fireEvent.click(screen.getByText('README.md'))
    expect(onOpenFile).toHaveBeenCalledWith('/proj/README.md')
  })

  it('does NOT call onOpenFile when a directory is clicked', async () => {
    const onOpenFile = vi.fn()
    // First call: root. Second call (when src is expanded): children
    mockReadDir
      .mockResolvedValueOnce(MOCK_ENTRIES)
      .mockResolvedValueOnce([])
    render(<ProjectFileTree rootPath="/proj" onOpenFile={onOpenFile} />)
    await waitFor(() => screen.getByText('src'))
    fireEvent.click(screen.getByText('src'))
    expect(onOpenFile).not.toHaveBeenCalled()
  })

  it('shows error when readDir fails', async () => {
    mockReadDir.mockRejectedValueOnce(new Error('no permission'))
    render(<ProjectFileTree rootPath="/proj" onOpenFile={() => {}} />)
    await waitFor(() => {
      expect(screen.getByText(/could not read directory/i)).toBeInTheDocument()
    })
  })

  it('renders with role="tree" for a11y', async () => {
    render(<ProjectFileTree rootPath="/proj" onOpenFile={() => {}} />)
    await waitFor(() => screen.getByText('src'))
    expect(screen.getByRole('tree')).toBeInTheDocument()
  })

  it('tree items have role="treeitem"', async () => {
    render(<ProjectFileTree rootPath="/proj" onOpenFile={() => {}} />)
    await waitFor(() => screen.getByText('src'))
    const items = screen.getAllByRole('treeitem')
    expect(items.length).toBeGreaterThan(0)
  })
})

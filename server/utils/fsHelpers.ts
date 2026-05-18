/**
 * Shared filesystem types and helpers used by castFs and projectFs routes.
 */

export interface TreeNode {
  name: string
  path: string
  type: 'dir' | 'file'
  mtime: number
  size: number
  children?: TreeNode[]
}

// Re-export safeResolve so callers only need one import
export { safeResolve } from './safeResolve.js'

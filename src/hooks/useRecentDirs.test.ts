import { describe, it, expect } from 'vitest'
import { pushRecentDir, MAX_RECENT } from './useRecentDirs'

describe('pushRecentDir', () => {
  it('prepends new entry to empty list', () => {
    expect(pushRecentDir([], '/a')).toEqual(['/a'])
  })

  it('moves existing entry to front (deduplication)', () => {
    const result = pushRecentDir(['/a', '/b'], '/a')
    expect(result).toEqual(['/a', '/b'])
  })

  it('evicts oldest entry when list reaches MAX_RECENT', () => {
    const dirs = Array.from({ length: MAX_RECENT }, (_, i) => `/${i + 1}`)
    // dirs = ['/1', '/2', ..., '/10']
    const result = pushRecentDir(dirs, '/new')
    expect(result).toHaveLength(MAX_RECENT)
    expect(result[0]).toBe('/new')
    expect(result).not.toContain('/10')
  })

  it('does not mutate the input array', () => {
    const original = ['/a', '/b']
    pushRecentDir(original, '/c')
    expect(original).toEqual(['/a', '/b'])
  })
})

import { describe, it, expect } from 'vitest'
import { normalizeFrontmatter } from './PreviewBody'

describe('normalizeFrontmatter', () => {
  it('passes through content with no frontmatter unchanged', () => {
    const input = '# Heading\n\nBody text with: colon inside.'
    expect(normalizeFrontmatter(input)).toBe(input)
  })

  it('passes through frontmatter values that contain no colons', () => {
    const input = '---\nname: foo\ntype: agent\n---\nBody'
    expect(normalizeFrontmatter(input)).toBe(input)
  })

  it('quotes unquoted values that contain colons', () => {
    const input = '---\ndescription: A note: with a colon\n---\nBody'
    const out = normalizeFrontmatter(input)
    expect(out).toContain('description: "A note: with a colon"')
    expect(out).toContain('---\n')
    expect(out).toContain('\nBody')
  })

  it('leaves already-quoted values alone', () => {
    const input = '---\ndescription: "Already: quoted"\n---\nBody'
    expect(normalizeFrontmatter(input)).toBe(input)
  })

  it('leaves block-scalar values (> and |) alone', () => {
    const inputFolded = '---\ndescription: >\n  Long: folded value\n---\nBody'
    expect(normalizeFrontmatter(inputFolded)).toBe(inputFolded)

    const inputLiteral = '---\ndescription: |\n  Long: literal value\n---\nBody'
    expect(normalizeFrontmatter(inputLiteral)).toBe(inputLiteral)
  })

  it('escapes embedded double quotes when quoting', () => {
    const input = '---\ndescription: He said: "hello"\n---\nBody'
    const out = normalizeFrontmatter(input)
    expect(out).toContain('description: "He said: \\"hello\\""')
  })
})

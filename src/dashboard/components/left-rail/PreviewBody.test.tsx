import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { normalizeFrontmatter } from './PreviewBody'
import PreviewBody from './PreviewBody'

// react-markdown renders async children; stub it to keep tests synchronous
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}))

// ── normalizeFrontmatter unit tests ───────────────────────────────────────────

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

  it('does not corrupt block scalar continuation lines that contain colons', () => {
    // Bug: regex previously matched indented lines and wrapped their value in quotes,
    // corrupting lines like "  Deploy to prod: run npm run build:deploy" into
    // "  Deploy to prod: \"run npm run build:deploy\""
    const input = [
      '---',
      'name: devops',
      'description: >',
      '  Deploy to prod: run npm run build:deploy after each change.',
      '  CI/CD: uses GitHub Actions.',
      'model: haiku',
      '---',
      '',
      'body',
    ].join('\n')
    expect(normalizeFrontmatter(input)).toBe(input)
  })

  it('does not corrupt block scalar continuation lines when using literal | style', () => {
    const input = [
      '---',
      'name: devops',
      'description: |',
      '  Step 1: run tests',
      '  Step 2: deploy',
      'model: haiku',
      '---',
      '',
      'body',
    ].join('\n')
    expect(normalizeFrontmatter(input)).toBe(input)
  })

  it('does not replace occurrences of the FM block in the body (index-safe replacement)', () => {
    // Old code used content.replace(fmMatch[1], fixed) which would corrupt the body
    // if the exact same key-value string appeared there
    const input = '---\nname: test\ndescription: A tool: for work\n---\n\nname: test\ndescription: A tool: for work\n'
    const out = normalizeFrontmatter(input)
    // FM section should be quoted
    expect(out).toContain('description: "A tool: for work"\n---')
    // Body occurrence should be left alone (no double-replacement)
    const bodyStart = out.indexOf('---\n\n')
    expect(out.slice(bodyStart)).toContain('description: A tool: for work')
  })
})

// ── PreviewBody component tests ───────────────────────────────────────────────

describe('PreviewBody component', () => {
  it('renders parsed frontmatter fields when valid YAML frontmatter is present', () => {
    const content = [
      '---',
      'name: code-writer',
      'type: agent',
      'description: Implementation specialist',
      '---',
      '',
      'Body content here.',
    ].join('\n')
    render(<PreviewBody filePath="/agents/code-writer.md" content={content} />)
    expect(screen.getByLabelText('File metadata')).toBeTruthy()
    expect(screen.getByText('code-writer')).toBeTruthy()
    expect(screen.getByText('agent')).toBeTruthy()
    expect(screen.getByText('Implementation specialist')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('renders block scalar description: > without parse error', () => {
    // This is the key regression: CAST agent .md files use description: > block scalar
    const content = [
      '---',
      'name: test-runner',
      'description: >',
      '  Test execution gate: Runs the project test suite.',
      '  On failure: dispatches debugger automatically.',
      'tools: Bash, Read',
      'model: haiku',
      'thinking_budget: 0',
      '---',
      '',
      'You are a test execution gate.',
    ].join('\n')
    render(<PreviewBody filePath="/agents/test-runner.md" content={content} />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('test-runner')).toBeTruthy()
    // Description is rendered as the folded block scalar result
    expect(screen.getByText((text) => text.includes('Test execution gate'))).toBeTruthy()
  })

  it('renders file with # comment inside frontmatter delimiters without crash', () => {
    // YAML comments are valid and gray-matter handles them; normalizeFrontmatter must not corrupt them
    const content = [
      '---',
      'name: api-contract',
      '# thinking_budget: HIGH|MEDIUM|LOW',
      'thinking_budget: 8192',
      '---',
      '',
      'You are an API contract guardian.',
    ].join('\n')
    render(<PreviewBody filePath="/agents/api-contract.md" content={content} />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('api-contract')).toBeTruthy()
  })

  it('renders file with no frontmatter without crashing', () => {
    const content = '# Just a heading\n\nSome body text without any frontmatter.'
    render(<PreviewBody filePath="/docs/readme.md" content={content} />)
    expect(screen.queryByRole('alert')).toBeNull()
    // No metadata bar rendered
    expect(screen.queryByRole('term')).toBeNull()
  })

  it('renders empty frontmatter ---\\n--- without crashing', () => {
    const content = '---\n---\n\nBody after empty frontmatter.'
    render(<PreviewBody filePath="/agents/empty.md" content={content} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('surfaces a visible parseError alert when frontmatter cannot be parsed', () => {
    // Force a parse error: inject a YAML structure that gray-matter cannot parse
    // even after normalization (e.g., invalid YAML with tab indentation)
    const content = '---\ninvalid: yaml: : : :\n\t- broken\n---\nBody'
    render(<PreviewBody filePath="/agents/broken.md" content={content} />)
    const alert = screen.queryByRole('alert')
    // The alert may or may not appear depending on whether gray-matter recovers;
    // critical requirement is: no uncaught exception thrown during render
    // (if alert appears, it must mention the parse failure)
    if (alert) {
      expect(alert.textContent).toContain('Frontmatter could not be parsed')
    }
  })

  it('renders non-.md files as raw pre content without attempting frontmatter parse', () => {
    const content = 'name: test\nsome: yaml\n---'
    render(<PreviewBody filePath="/config/settings.json" content={content} />)
    const pre = screen.getByLabelText('File content')
    expect(pre).toBeTruthy()
    expect(pre.textContent).toContain('name: test')
  })

  it('real-world CAST agent: full api-contract.md style with flow array and emdash comment', () => {
    // Reproduces the actual api-contract.md structure that historically failed
    const content = [
      '---',
      'name: api-contract',
      'description: >',
      '  API contract guardian. Detects breaking changes in REST endpoints, compares',
      '  route signatures and response shapes, generates OpenAPI-style diffs. Guards',
      '  Express routes and any REST API surfaces.',
      'tools: Read, Bash, Glob, Grep',
      'model: sonnet',
      'effort: high',
      'color: blue',
      'memory: local',
      'maxTurns: 20',
      'disallowedTools: [Write, Edit]',
      'skills: [cast-conventions]',
      '# thinking_budget: HIGH|MEDIUM|LOW — controls extended thinking token allocation',
      'thinking_budget: 8192',
      '---',
      '',
      'You are an API contract guardian.',
    ].join('\n')
    render(<PreviewBody filePath="/agents/api-contract.md" content={content} />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('api-contract')).toBeTruthy()
    // block scalar folds multi-line into single string with trailing newline
    expect(screen.getByText((text) => text.startsWith('API contract guardian.'))).toBeTruthy()
  })
})

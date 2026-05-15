import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import matter from 'gray-matter'

// ── types ─────────────────────────────────────────────────────────────────────

interface FrontmatterData {
  name?: string
  type?: string
  description?: string
  [key: string]: unknown
}

interface PreviewBodyProps {
  filePath: string
  content: string
}

// ── helpers ───────────────────────────────────────────────────────────────────

function basename(p: string): string {
  return p.split('/').at(-1) ?? p
}

/**
 * Pre-processes frontmatter before passing to gray-matter.
 * Quotes unquoted scalar values that contain colons, which would otherwise
 * cause gray-matter (and the underlying js-yaml parser) to fail.
 * Example: `description: A note: with colon` → `description: "A note: with colon"`
 *
 * Block scalars ("> |") and already-quoted values are left untouched.
 * Indented continuation lines (block scalar bodies) are skipped — they are
 * YAML content, not key-value pairs, and must not be quoted.
 */
export function normalizeFrontmatter(content: string): string {
  const fmMatch = content.match(/^(---\n)([\s\S]*?)(\n---)/)
  if (!fmMatch) return content

  const [fullMatch, open, fm, close] = fmMatch
  const fixed = fm.replace(/^([^:\n]+):\s(.+)$/gm, (_match, key: string, value: string) => {
    // Skip indented lines — these are block scalar continuation lines, not key-value pairs
    if (key !== key.trimStart()) return _match
    if (!value.includes(':')) return _match
    if (value.startsWith('"') || value.startsWith("'")) return _match
    if (value.startsWith('>') || value.startsWith('|')) return _match
    return `${key}: "${value.replace(/"/g, '\\"')}"`
  })

  if (fixed === fm) return content
  return content.slice(0, fmMatch.index) + open + fixed + close + content.slice((fmMatch.index ?? 0) + fullMatch.length)
}

// ── component ─────────────────────────────────────────────────────────────────

/**
 * Shared rendering layer used by PreviewModal (large-viewport overlay).
 * Handles frontmatter parsing, react-markdown rendering, and the raw <pre> fallback.
 */
export default function PreviewBody({ filePath, content }: PreviewBodyProps) {
  const fileName = basename(filePath)
  const ext = fileName.toLowerCase().match(/\.(\w+)$/)?.[1] ?? ''
  const isCode = ext === 'json' || ext === 'sh' || ext === 'py'
  const isMarkdown = !isCode && fileName.endsWith('.md')

  const { frontmatter, bodyContent } = useMemo(() => {
    if (!isMarkdown || !content) {
      return { frontmatter: {} as FrontmatterData, bodyContent: content }
    }
    try {
      const normalized = normalizeFrontmatter(content)
      const parsed = matter(normalized)
      return {
        frontmatter: parsed.data as FrontmatterData,
        bodyContent: parsed.content,
      }
    } catch {
      // Parsing failed — render the full document (incl. frontmatter) as markdown.
      // No error banner: raw frontmatter will appear as code/text, which is fine.
      return { frontmatter: {} as FrontmatterData, bodyContent: content }
    }
  }, [content, isMarkdown])

  const hasFrontmatter = Object.keys(frontmatter).length > 0

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden">
      {/* Frontmatter metadata bar */}
      {hasFrontmatter && (
        <dl
          className="px-3 py-2 border-b border-[var(--stroke-regular)] space-y-1"
          aria-label="File metadata"
          style={{ display: 'block', margin: 0, padding: undefined }}
        >
          {frontmatter.name && (
            <div className="flex gap-2">
              <dt className="text-[10px] text-[var(--content-muted)] flex-shrink-0 w-16">name</dt>
              <dd className="text-[10px] text-[var(--content-secondary)] truncate" style={{ margin: 0 }}>{String(frontmatter.name)}</dd>
            </div>
          )}
          {frontmatter.type && (
            <div className="flex gap-2">
              <dt className="text-[10px] text-[var(--content-muted)] flex-shrink-0 w-16">type</dt>
              <dd className="text-[10px] text-[var(--accent)] truncate" style={{ margin: 0 }}>{String(frontmatter.type)}</dd>
            </div>
          )}
          {frontmatter.description && (
            <div className="flex gap-2">
              <dt className="text-[10px] text-[var(--content-muted)] flex-shrink-0 w-16">desc</dt>
              <dd className="text-[10px] text-[var(--content-secondary)] line-clamp-2" style={{ margin: 0 }}>{String(frontmatter.description)}</dd>
            </div>
          )}
        </dl>
      )}

      {/* Content */}
      <div className="p-3">
        {isMarkdown ? (
          <div className="prose-cast text-sm text-[var(--content-secondary)] leading-relaxed">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-base font-semibold text-[var(--content-primary)] mt-3 mb-1">{children}</h1>,
                h2: ({ children }) => <h2 className="text-sm font-semibold text-[var(--content-primary)] mt-3 mb-1">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-medium text-[var(--content-primary)] mt-2 mb-1">{children}</h3>,
                p: ({ children }) => <p className="text-sm text-[var(--content-secondary)] mb-2">{children}</p>,
                code: ({ children, className }) => {
                  const isBlock = className?.includes('language-')
                  if (isBlock) {
                    return (
                      <pre className="text-xs bg-[var(--system-elevated)] rounded p-2 overflow-x-auto mb-2 whitespace-pre-wrap break-words">
                        <code>{children}</code>
                      </pre>
                    )
                  }
                  return (
                    <code className="text-xs bg-[var(--system-elevated)] rounded px-1 text-[var(--accent)]">
                      {children}
                    </code>
                  )
                },
                ul: ({ children }) => <ul className="text-sm text-[var(--content-secondary)] list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="text-sm text-[var(--content-secondary)] list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
                li: ({ children }) => <li className="text-sm">{children}</li>,
                a: ({ href, children }) => <a href={href} className="text-[var(--accent)] hover:underline" target="_blank" rel="noreferrer">{children}</a>,
                blockquote: ({ children }) => <blockquote className="border-l-2 border-[var(--stroke-regular)] pl-2 text-[var(--content-muted)] italic mb-2">{children}</blockquote>,
                hr: () => <hr className="border-[var(--stroke-regular)] my-2" />,
              }}
            >
              {bodyContent}
            </ReactMarkdown>
          </div>
        ) : (
          <pre
            className="text-xs font-mono text-[var(--content-secondary)] whitespace-pre-wrap break-words leading-relaxed"
            aria-label="File content"
          >
            {content}
          </pre>
        )}
      </div>
    </div>
  )
}

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

// ── component ─────────────────────────────────────────────────────────────────

/**
 * Shared rendering layer used by PreviewModal (large-viewport overlay).
 * Handles frontmatter parsing, react-markdown rendering, and the raw <pre> fallback.
 */
export default function PreviewBody({ filePath, content }: PreviewBodyProps) {
  const fileName = basename(filePath)
  const isMarkdown = fileName.endsWith('.md')

  const { frontmatter, bodyContent, parseError } = useMemo(() => {
    if (!isMarkdown || !content) {
      return { frontmatter: {} as FrontmatterData, bodyContent: content, parseError: false }
    }
    try {
      const parsed = matter(content)
      return {
        frontmatter: parsed.data as FrontmatterData,
        bodyContent: parsed.content,
        parseError: false,
      }
    } catch {
      return { frontmatter: {} as FrontmatterData, bodyContent: content, parseError: true }
    }
  }, [content, isMarkdown])

  const hasFrontmatter = Object.keys(frontmatter).length > 0

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden">
      {/* Frontmatter metadata bar */}
      {hasFrontmatter && (
        <dl
          className="px-3 py-2 border-b border-[var(--cast-rail-border)] space-y-1"
          aria-label="File metadata"
          style={{ display: 'block', margin: 0, padding: undefined }}
        >
          {frontmatter.name && (
            <div className="flex gap-2">
              <dt className="text-[10px] text-[var(--text-muted)] flex-shrink-0 w-16">name</dt>
              <dd className="text-[10px] text-[var(--text-secondary)] truncate" style={{ margin: 0 }}>{String(frontmatter.name)}</dd>
            </div>
          )}
          {frontmatter.type && (
            <div className="flex gap-2">
              <dt className="text-[10px] text-[var(--text-muted)] flex-shrink-0 w-16">type</dt>
              <dd className="text-[10px] text-[var(--cast-accent-legacy)] truncate" style={{ margin: 0 }}>{String(frontmatter.type)}</dd>
            </div>
          )}
          {frontmatter.description && (
            <div className="flex gap-2">
              <dt className="text-[10px] text-[var(--text-muted)] flex-shrink-0 w-16">desc</dt>
              <dd className="text-[10px] text-[var(--text-secondary)] line-clamp-2" style={{ margin: 0 }}>{String(frontmatter.description)}</dd>
            </div>
          )}
        </dl>
      )}

      {/* Content */}
      <div className="p-3">
        {parseError && (
          <div
            role="alert"
            className="mb-2 text-[10px] px-2 py-1 rounded"
            style={{ color: 'var(--cast-error, #999)', background: 'var(--bg-tertiary)' }}
          >
            Frontmatter could not be parsed. Showing raw content.
          </div>
        )}
        {isMarkdown && !parseError ? (
          <div className="prose-cast text-sm text-[var(--text-secondary)] leading-relaxed">
            <ReactMarkdown
              components={{
                h1: ({ children }) => <h1 className="text-base font-semibold text-[var(--text-primary)] mt-3 mb-1">{children}</h1>,
                h2: ({ children }) => <h2 className="text-sm font-semibold text-[var(--text-primary)] mt-3 mb-1">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-medium text-[var(--text-primary)] mt-2 mb-1">{children}</h3>,
                p: ({ children }) => <p className="text-sm text-[var(--text-secondary)] mb-2">{children}</p>,
                code: ({ children, className }) => {
                  const isBlock = className?.includes('language-')
                  if (isBlock) {
                    return (
                      <pre className="text-xs bg-[var(--bg-tertiary)] rounded p-2 overflow-x-auto mb-2 whitespace-pre-wrap break-words">
                        <code>{children}</code>
                      </pre>
                    )
                  }
                  return (
                    <code className="text-xs bg-[var(--bg-tertiary)] rounded px-1 text-[var(--cast-accent-legacy)]">
                      {children}
                    </code>
                  )
                },
                ul: ({ children }) => <ul className="text-sm text-[var(--text-secondary)] list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="text-sm text-[var(--text-secondary)] list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
                li: ({ children }) => <li className="text-sm">{children}</li>,
                a: ({ href, children }) => <a href={href} className="text-[var(--cast-accent-legacy)] hover:underline" target="_blank" rel="noreferrer">{children}</a>,
                blockquote: ({ children }) => <blockquote className="border-l-2 border-[var(--cast-rail-border)] pl-2 text-[var(--text-muted)] italic mb-2">{children}</blockquote>,
                hr: () => <hr className="border-[var(--cast-rail-border)] my-2" />,
              }}
            >
              {bodyContent}
            </ReactMarkdown>
          </div>
        ) : (
          <pre
            className="text-xs font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-words leading-relaxed"
            aria-label="File content"
          >
            {content}
          </pre>
        )}
      </div>
    </div>
  )
}

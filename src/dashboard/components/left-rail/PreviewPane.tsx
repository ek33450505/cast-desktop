import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useReducedMotion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import matter from 'gray-matter'

function basename(filePath: string): string {
  return filePath.split('/').at(-1) ?? filePath
}

// ── types ─────────────────────────────────────────────────────────────────────

interface PreviewResponse {
  path: string
  content: string
  mtime: number
}

interface FrontmatterData {
  name?: string
  type?: string
  description?: string
  [key: string]: unknown
}

// ── fetcher ───────────────────────────────────────────────────────────────────

async function fetchPreview(filePath: string): Promise<PreviewResponse> {
  const res = await fetch(`/api/cast-fs/preview?path=${encodeURIComponent(filePath)}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<PreviewResponse>
}

// ── component ─────────────────────────────────────────────────────────────────

interface PreviewPaneProps {
  path: string
  onClose: () => void
}

export default function PreviewPane({ path: filePath, onClose }: PreviewPaneProps) {
  const shouldReduceMotion = useReducedMotion()

  const { data, isLoading, error } = useQuery({
    queryKey: ['preview', filePath],
    queryFn: () => fetchPreview(filePath),
    staleTime: 60_000,
    retry: false,
  })

  // Escape key closes
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const fileName = basename(filePath)
  const isMarkdown = fileName.endsWith('.md')

  // Parse frontmatter for markdown files — memoized to avoid re-running on every render
  const { frontmatter, bodyContent, parseError } = useMemo(() => {
    if (!isMarkdown || !data?.content) {
      return { frontmatter: {} as FrontmatterData, bodyContent: data?.content ?? '', parseError: false }
    }
    try {
      const parsed = matter(data.content)
      return {
        frontmatter: parsed.data as FrontmatterData,
        bodyContent: parsed.content,
        parseError: false,
      }
    } catch {
      // gray-matter threw — render raw content as <pre> with an alert banner
      return { frontmatter: {} as FrontmatterData, bodyContent: data.content, parseError: true }
    }
  }, [data?.content, isMarkdown])

  const hasFrontmatter = Object.keys(frontmatter).length > 0

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{
        // Slide-in from left if reduced motion off — handled by parent AnimatePresence
        willChange: shouldReduceMotion ? 'auto' : 'transform, opacity',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-2 border-b border-[var(--cast-rail-border)] flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to file tree"
          className="flex items-center justify-center rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--cast-accent)] focus-visible:outline-offset-1 flex-shrink-0"
          style={{ width: '28px', height: '28px', minWidth: '28px', minHeight: '28px' }}
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--text-primary)] truncate" title={fileName}>
            {fileName}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] truncate" title={filePath}>
            {filePath}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {isLoading && (
          <div className="p-3 space-y-2" aria-label="Loading preview">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="h-4 rounded bg-[var(--bg-tertiary)] animate-pulse"
                style={{ width: `${40 + i * 15}%` }}
                aria-hidden="true"
              />
            ))}
          </div>
        )}

        {error && (
          <div className="p-3 text-xs text-[var(--error)]" role="alert">
            Failed to load file: {error instanceof Error ? error.message : 'Unknown error'}
          </div>
        )}

        {data && (
          <>
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
                    <dd className="text-[10px] text-[var(--accent)] truncate" style={{ margin: 0 }}>{String(frontmatter.type)}</dd>
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
                <div className="prose-cast text-xs text-[var(--text-secondary)] leading-relaxed">
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => <h1 className="text-sm font-semibold text-[var(--text-primary)] mt-3 mb-1">{children}</h1>,
                      h2: ({ children }) => <h2 className="text-xs font-semibold text-[var(--text-primary)] mt-3 mb-1">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-xs font-medium text-[var(--text-primary)] mt-2 mb-1">{children}</h3>,
                      p: ({ children }) => <p className="text-xs text-[var(--text-secondary)] mb-2">{children}</p>,
                      code: ({ children, className }) => {
                        const isBlock = className?.includes('language-')
                        if (isBlock) {
                          return (
                            <pre className="text-[10px] bg-[var(--bg-tertiary)] rounded p-2 overflow-x-auto mb-2 whitespace-pre-wrap break-words">
                              <code>{children}</code>
                            </pre>
                          )
                        }
                        return (
                          <code className="text-[10px] bg-[var(--bg-tertiary)] rounded px-1 text-[var(--accent)]">
                            {children}
                          </code>
                        )
                      },
                      ul: ({ children }) => <ul className="text-xs text-[var(--text-secondary)] list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
                      ol: ({ children }) => <ol className="text-xs text-[var(--text-secondary)] list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
                      li: ({ children }) => <li className="text-xs">{children}</li>,
                      a: ({ href, children }) => <a href={href} className="text-[var(--accent)] hover:underline" target="_blank" rel="noreferrer">{children}</a>,
                      blockquote: ({ children }) => <blockquote className="border-l-2 border-[var(--cast-rail-border)] pl-2 text-[var(--text-muted)] italic mb-2">{children}</blockquote>,
                      hr: () => <hr className="border-[var(--cast-rail-border)] my-2" />,
                    }}
                  >
                    {bodyContent}
                  </ReactMarkdown>
                </div>
              ) : (
                <pre
                  className="text-[10px] font-mono text-[var(--text-secondary)] whitespace-pre-wrap break-words leading-relaxed"
                  aria-label="File content"
                >
                  {data.content}
                </pre>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

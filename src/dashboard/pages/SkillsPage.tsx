import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Zap } from 'lucide-react'
import PreviewModal from '../components/left-rail/PreviewModal'
import { formatShortDate } from '../utils/time'

interface SkillFile {
  name: string
  description: string
  path: string
  modifiedAt: string
}

async function fetchSkills(): Promise<SkillFile[]> {
  const res = await fetch('/api/skills')
  if (!res.ok) throw new Error('Failed to fetch skills')
  return res.json()
}

function useSkills() {
  return useQuery({
    queryKey: ['skills'],
    queryFn: fetchSkills,
    staleTime: 60_000,
  })
}

function SkeletonRows() {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--system-panel)', border: '1px solid var(--border)' }}>
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="px-4 py-3 animate-pulse space-y-1.5"
          style={{ borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}
          aria-hidden="true"
        >
          <div className="h-4 rounded font-mono" style={{ background: 'var(--system-elevated)', width: `${30 + i * 6}%` }} />
          <div className="h-3 rounded" style={{ background: 'var(--system-elevated)', width: `${50 + i * 8}%` }} />
        </div>
      ))}
    </div>
  )
}

interface SkillRowProps {
  skill: SkillFile
  onClick: (skill: SkillFile, ref: React.RefObject<HTMLButtonElement | null>) => void
}

function SkillRow({ skill, onClick }: SkillRowProps) {
  const btnRef = useRef<HTMLButtonElement>(null)
  return (
    <button
      ref={btnRef}
      type="button"
      className="w-full text-left px-4 py-3 transition-colors hover:bg-[var(--system-elevated)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-[-2px]"
      style={{ minHeight: '44px' }}
      onClick={() => onClick(skill, btnRef)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium font-mono truncate" style={{ color: 'var(--content-primary)' }}>
            {skill.name}
          </p>
          {skill.description && (
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--content-muted)' }}>
              {skill.description}
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs" style={{ color: 'var(--content-muted)' }}>
          {formatShortDate(skill.modifiedAt)}
        </span>
      </div>
    </button>
  )
}

export default function SkillsPage() {
  const { data: skills = [], isLoading, error } = useSkills()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  function handleRowClick(skill: SkillFile, ref: React.RefObject<HTMLButtonElement | null>) {
    triggerRef.current = ref.current
    setSelectedPath(skill.path)
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2.5">
        <Zap className="w-5 h-5" aria-hidden="true" style={{ color: 'var(--accent)' }} />
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--content-primary)' }}>Skills</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--content-muted)' }}>~/.claude/skills/</p>
        </div>
      </div>

      {isLoading && <SkeletonRows />}

      {error && (
        <div className="rounded-xl p-4 text-sm" role="alert" style={{ background: 'var(--system-panel)', border: '1px solid var(--border)', color: 'var(--content-muted)' }}>
          Failed to load skills.
        </div>
      )}

      {!isLoading && !error && skills.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Zap className="w-10 h-10 opacity-20" aria-hidden="true" style={{ color: 'var(--content-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--content-muted)' }}>No skills found</p>
        </div>
      )}

      {!isLoading && !error && skills.length > 0 && (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--system-panel)', border: '1px solid var(--border)' }}>
          {skills.map((skill, i) => (
            <div key={skill.path} style={{ borderBottom: i < skills.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <SkillRow skill={skill} onClick={handleRowClick} />
            </div>
          ))}
        </div>
      )}

      {selectedPath && (
        <PreviewModal
          path={selectedPath}
          source="cast"
          onClose={() => setSelectedPath(null)}
          triggerRef={triggerRef as React.RefObject<HTMLElement | null>}
        />
      )}
    </div>
  )
}

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  message?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 text-center py-6 px-3',
        className
      )}
    >
      <span aria-hidden="true">
        <Icon
          className="w-6 h-6"
          style={{ color: 'var(--content-muted)' }}
        />
      </span>
      <h3
        className="text-sm font-medium"
        style={{ color: 'var(--content-primary)' }}
      >
        {title}
      </h3>
      {message && (
        <p
          className="text-xs"
          style={{ color: 'var(--content-muted)' }}
        >
          {message}
        </p>
      )}
      {action && (
        <div className="mt-1">
          {action}
        </div>
      )}
    </div>
  )
}

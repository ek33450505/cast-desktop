import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import Skeleton from '@/components/Skeleton'

const pageSkeletonVariants = cva('', {
  variants: {
    variant: {
      grid: 'grid gap-4',
      list: 'flex flex-col gap-3',
      table: 'flex flex-col gap-2',
    },
  },
  defaultVariants: {
    variant: 'list',
  },
})

export interface PageSkeletonProps extends VariantProps<typeof pageSkeletonVariants> {
  variant: 'grid' | 'list' | 'table'
  cols?: number
  rows?: number
  className?: string
}

export function PageSkeleton({
  variant,
  cols = 4,
  rows = 4,
  className,
}: PageSkeletonProps) {
  if (variant === 'grid') {
    const totalCells = cols * rows
    return (
      <div
        role="status"
        aria-label="Loading"
        className={cn(
          pageSkeletonVariants({ variant }),
          className
        )}
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: totalCells }).map((_, i) => (
          <div key={i} aria-hidden="true">
            <Skeleton height="6rem" className="w-full rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  if (variant === 'table') {
    return (
      <div
        role="status"
        aria-label="Loading"
        className={cn(pageSkeletonVariants({ variant }), className)}
      >
        {Array.from({ length: rows }).map((_, rowIdx) => (
          <div
            key={rowIdx}
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }).map((_, colIdx) => (
              <div key={colIdx} aria-hidden="true">
                <Skeleton shape="line" className="h-4" />
              </div>
            ))}
          </div>
        ))}
      </div>
    )
  }

  // list variant
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(pageSkeletonVariants({ variant }), className)}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} aria-hidden="true">
          <Skeleton shape="line" className="h-8 w-full" />
        </div>
      ))}
    </div>
  )
}

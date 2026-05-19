import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageSkeleton } from './PageSkeleton'

describe('PageSkeleton — list variant', () => {
  it('renders without throwing', () => {
    expect(() => render(<PageSkeleton variant="list" />)).not.toThrow()
  })

  it('has role="status" and aria-label="Loading" on wrapper', () => {
    render(<PageSkeleton variant="list" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading')
  })

  it('renders the correct number of rows', () => {
    const { container } = render(<PageSkeleton variant="list" rows={5} />)
    const ariaHiddenItems = container.querySelectorAll('[aria-hidden="true"]')
    expect(ariaHiddenItems.length).toBe(5)
  })

  it('all pulse blocks have aria-hidden="true"', () => {
    const { container } = render(<PageSkeleton variant="list" rows={3} />)
    const wrapper = screen.getByRole('status')
    const ariaHiddenItems = wrapper.querySelectorAll('[aria-hidden="true"]')
    expect(ariaHiddenItems.length).toBe(3)
    ariaHiddenItems.forEach((el) => {
      expect(el).toHaveAttribute('aria-hidden', 'true')
    })
  })
})

describe('PageSkeleton — grid variant', () => {
  it('renders without throwing', () => {
    expect(() => render(<PageSkeleton variant="grid" cols={3} rows={2} />)).not.toThrow()
  })

  it('renders cols * rows cells', () => {
    const { container } = render(<PageSkeleton variant="grid" cols={3} rows={2} />)
    const ariaHiddenItems = container.querySelectorAll('[aria-hidden="true"]')
    expect(ariaHiddenItems.length).toBe(6)
  })

  it('has role="status" and aria-label="Loading"', () => {
    render(<PageSkeleton variant="grid" cols={2} rows={2} />)
    const wrapper = screen.getByRole('status')
    expect(wrapper).toHaveAttribute('aria-label', 'Loading')
  })

  it('all pulse blocks have aria-hidden="true"', () => {
    const { container } = render(<PageSkeleton variant="grid" cols={2} rows={2} />)
    const wrapper = screen.getByRole('status')
    const ariaHiddenItems = wrapper.querySelectorAll('[aria-hidden="true"]')
    expect(ariaHiddenItems.length).toBe(4)
    ariaHiddenItems.forEach((el) => {
      expect(el).toHaveAttribute('aria-hidden', 'true')
    })
  })
})

describe('PageSkeleton — table variant', () => {
  it('renders without throwing', () => {
    expect(() => render(<PageSkeleton variant="table" cols={4} rows={3} />)).not.toThrow()
  })

  it('renders cols * rows cells', () => {
    const { container } = render(<PageSkeleton variant="table" cols={4} rows={3} />)
    const ariaHiddenItems = container.querySelectorAll('[aria-hidden="true"]')
    expect(ariaHiddenItems.length).toBe(12)
  })

  it('has role="status" and aria-label="Loading"', () => {
    render(<PageSkeleton variant="table" cols={2} rows={2} />)
    const wrapper = screen.getByRole('status')
    expect(wrapper).toHaveAttribute('aria-label', 'Loading')
  })

  it('all pulse blocks have aria-hidden="true"', () => {
    const { container } = render(<PageSkeleton variant="table" cols={3} rows={2} />)
    const wrapper = screen.getByRole('status')
    const ariaHiddenItems = wrapper.querySelectorAll('[aria-hidden="true"]')
    expect(ariaHiddenItems.length).toBe(6)
    ariaHiddenItems.forEach((el) => {
      expect(el).toHaveAttribute('aria-hidden', 'true')
    })
  })
})

describe('PageSkeleton — className prop', () => {
  it('applies custom className to wrapper', () => {
    const { container } = render(<PageSkeleton variant="list" className="my-custom-class" />)
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.className).toContain('my-custom-class')
  })
})

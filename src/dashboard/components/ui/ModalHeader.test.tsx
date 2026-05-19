import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FileText } from 'lucide-react'
import { ModalHeader } from './ModalHeader'

describe('ModalHeader — title', () => {
  it('renders the title text', () => {
    render(<ModalHeader title="My Modal" />)
    expect(screen.getByText('My Modal')).toBeInTheDocument()
  })
})

describe('ModalHeader — icon', () => {
  it('renders icon when icon prop is provided', () => {
    const { container } = render(<ModalHeader icon={FileText} title="With Icon" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('omits icon when icon prop is not provided', () => {
    const { container } = render(<ModalHeader title="No Icon" />)
    // No aria-hidden span wrapping the icon
    const hiddenSpan = container.querySelector('span[aria-hidden="true"]')
    expect(hiddenSpan).not.toBeInTheDocument()
  })

  it('icon span is aria-hidden="true"', () => {
    const { container } = render(<ModalHeader icon={FileText} title="With Icon" />)
    const hiddenSpan = container.querySelector('span[aria-hidden="true"]')
    expect(hiddenSpan).toBeInTheDocument()
    // The svg is inside the aria-hidden span
    const svg = hiddenSpan?.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})

describe('ModalHeader — close button', () => {
  it('renders close button when onClose is provided', () => {
    render(<ModalHeader title="Closeable" onClose={() => {}} />)
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('omits close button when onClose is not provided', () => {
    render(<ModalHeader title="No Close" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('close button has aria-label="Close"', () => {
    render(<ModalHeader title="Closeable" onClose={() => {}} />)
    const btn = screen.getByRole('button', { name: 'Close' })
    expect(btn).toHaveAttribute('aria-label', 'Close')
  })

  it('clicking close button calls onClose', async () => {
    const onClose = vi.fn()
    render(<ModalHeader title="Closeable" onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('ModalHeader — structure', () => {
  it('renders a <header> element', () => {
    const { container } = render(<ModalHeader title="Test" />)
    const header = container.querySelector('header')
    expect(header).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(<ModalHeader title="Test" className="extra-class" />)
    const header = container.querySelector('header') as HTMLElement
    expect(header.className).toContain('extra-class')
  })
})

describe('ModalHeader — id prop', () => {
  it('applies id to the title element when provided', () => {
    render(<ModalHeader title="Labelled Header" id="my-heading-id" />)
    const titleEl = document.getElementById('my-heading-id')
    expect(titleEl).toBeInTheDocument()
    expect(titleEl?.textContent).toBe('Labelled Header')
  })

  it('omits id attribute on title element when not provided', () => {
    const { container } = render(<ModalHeader title="No Id" />)
    // The title paragraph should not carry any id
    const titleEl = container.querySelector('p')
    expect(titleEl?.getAttribute('id')).toBeNull()
  })
})

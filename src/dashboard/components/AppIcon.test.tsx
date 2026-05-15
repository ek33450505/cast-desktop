import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AppIconSVG } from './AppIcon'

describe('AppIconSVG', () => {
  it('renders an svg element', () => {
    const { container } = render(<AppIconSVG size={32} />)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('applies the size prop as width and height', () => {
    const { container } = render(<AppIconSVG size={64} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '64')
    expect(svg).toHaveAttribute('height', '64')
  })

  it('has default role="img" and aria-label', () => {
    const { container } = render(<AppIconSVG size={32} />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('role', 'img')
    expect(svg).toHaveAttribute('aria-label', 'Cast Desktop')
  })

  it('accepts aria-hidden="true" for decorative usage', () => {
    const { container } = render(<AppIconSVG size={32} aria-hidden="true" />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('renders the amber accent dot', () => {
    const { container } = render(<AppIconSVG size={32} />)
    // The amber accent circle is the only <circle> in the icon
    const circle = container.querySelector('circle')
    expect(circle).toBeInTheDocument()
    expect(circle).toHaveAttribute('fill', '#E6A532')
  })
})

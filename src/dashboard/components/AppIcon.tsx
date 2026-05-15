/**
 * AppIconSVG — the canonical Cast Desktop badge icon (>_ rounded square).
 *
 * Inlined as a React component so there's no runtime asset dependency.
 * Mirrors the artwork from src-tauri/icons/icon.svg.
 *
 * Usage:
 *   <AppIconSVG size={56} aria-hidden="true" />   // decorative
 *   <AppIconSVG size={32} role="img" aria-label="Cast Desktop" />  // semantic
 */

interface AppIconSVGProps {
  size: number
  'aria-hidden'?: 'true' | boolean
  'aria-label'?: string
  role?: string
}

export function AppIconSVG({ size, ...rest }: AppIconSVGProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      role="img"
      aria-label="Cast Desktop"
      {...rest}
    >
      <defs>
        <linearGradient id="cast-icon-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#13171B" />
          <stop offset="1" stopColor="#080A0D" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" ry="112" fill="url(#cast-icon-bg)" />
      <rect
        x="14"
        y="14"
        width="484"
        height="484"
        rx="100"
        ry="100"
        fill="none"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="1.5"
      />
      <g
        fontFamily="'JetBrains Mono', 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
        fontWeight="700"
      >
        <text x="118" y="338" fontSize="240" fill="#E6A532" letterSpacing="-6">
          &gt;_
        </text>
      </g>
      <circle cx="402" cy="208" r="14" fill="#E6A532" />
    </svg>
  )
}

export default AppIconSVG

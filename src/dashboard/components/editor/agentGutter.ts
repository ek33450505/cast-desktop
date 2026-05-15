/**
 * agentGutter — CodeMirror 6 gutter extension.
 *
 * Renders a small colored dot in the left gutter margin when agent touches
 * exist for the open file. For v1, the dot appears at line 1 only (since
 * line_range data isn't populated yet). Click opens the AgentTouchPopover.
 *
 * a11y: gutter marker has role="button", aria-label, tabIndex=0, keyboard.
 */

import { gutter, GutterMarker } from '@codemirror/view'
import { StateField, StateEffect, EditorState } from '@codemirror/state'

// ── State Effect for updating touch availability ───────────────────────────────

export const setHasTouches = StateEffect.define<boolean>()

/** StateField tracking whether the current file has any agent touches. */
export const hasTouchesField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setHasTouches)) {
        return effect.value
      }
    }
    return value
  },
})

// ── Gutter marker ─────────────────────────────────────────────────────────────

class AgentDotMarker extends GutterMarker {
  private onClick: (anchor: HTMLElement) => void
  private filename: string

  constructor(onClick: (anchor: HTMLElement) => void, filename: string) {
    super()
    this.onClick = onClick
    this.filename = filename
  }

  toDOM(_view: unknown): HTMLElement {
    const dot = document.createElement('button')
    dot.setAttribute('role', 'button')
    dot.setAttribute(
      'aria-label',
      `View agent edit history for ${this.filename}`,
    )
    dot.setAttribute('tabindex', '0')
    dot.title = `Agent touched ${this.filename}`

    Object.assign(dot.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      height: '100%',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      padding: 0,
      outline: 'none',
    })

    // The dot itself
    const inner = document.createElement('span')
    Object.assign(inner.style, {
      display: 'block',
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      background: 'var(--cast-accent, #00FFC2)',
      opacity: '0.85',
      transition: 'opacity 0.15s',
    })
    dot.appendChild(inner)

    dot.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.onClick(dot)
    })

    dot.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        this.onClick(dot)
      }
    })

    dot.addEventListener('focus', () => {
      dot.style.outline = '2px solid var(--cast-accent)'
      dot.style.outlineOffset = '-2px'
    })

    dot.addEventListener('blur', () => {
      dot.style.outline = 'none'
    })

    dot.addEventListener('mouseenter', () => {
      inner.style.opacity = '1'
    })

    dot.addEventListener('mouseleave', () => {
      inner.style.opacity = '0.85'
    })

    return dot
  }
}

// ── Factory: creates the gutter extension ─────────────────────────────────────

/**
 * Creates the agent gutter extension.
 * @param onOpenPopover — callback invoked when the gutter dot is clicked.
 * @param filename — display name for the current file (for aria-label).
 */
export function agentGutter(onOpenPopover: (anchor: HTMLElement) => void, filename: string) {
  return [
    hasTouchesField,
    gutter({
      class: 'cm-agent-gutter',
      lineMarker(view, line) {
        const hasTouches = view.state.field(hasTouchesField)
        // v1: render dot only on line 1
        if (!hasTouches) return null
        const pos = line.from
        const lineNo = view.state.doc.lineAt(pos).number
        if (lineNo !== 1) return null
        return new AgentDotMarker(onOpenPopover, filename)
      },
      lineMarkerChange(update) {
        // Re-render gutter when hasTouchesField changes
        for (const effect of update.transactions.flatMap((t) => t.effects)) {
          if (effect.is(setHasTouches)) return true
        }
        return false
      },
      initialSpacer: () => {
        const spacer = new AgentDotMarker(() => {}, '')
        return spacer
      },
    }),
    // Gutter width CSS
    EditorState.transactionExtender.of((_tr) => null),
  ]
}

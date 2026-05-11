import { useRef } from 'react';
import '@xterm/xterm/css/xterm.css';
import { useTerminal } from '../hooks/useTerminal';
import { TerminalSearch } from './TerminalSearch';
import { ErrorAnnotation } from './ErrorAnnotation';
import { ErrorBoundary } from './ErrorBoundary';
import { useErrorDetection } from '../hooks/useErrorDetection';
import { useCompletionNotifier } from '../hooks/useCompletionNotifier';

interface TerminalPaneProps {
  paneId: string;
  sessionId: string;
  isActive: boolean;
  onFocus: () => void;
}

// AIConversationView and AI session-type branching intentionally removed.
// Phase 0 decision: AI output parsers are superseded by dashboard's cast.db
// agent data via the Express API layer. Always render the raw terminal.
export function TerminalPane({ paneId, sessionId, isActive, onFocus }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useTerminal(containerRef, sessionId);
  useErrorDetection(sessionId);
  useCompletionNotifier(sessionId, paneId);

  const xtermDiv = (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
  );

  return (
    <div
      onMouseDown={onFocus}
      className={isActive ? 'pane--active' : undefined}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderLeft: isActive
          ? '2px solid var(--accent)'
          : '2px solid transparent',
      }}
    >
      <ErrorBoundary paneId={paneId}>
        <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
          {xtermDiv}
          <TerminalSearch sessionId={sessionId} />
          <ErrorAnnotation sessionId={sessionId} />
        </div>
      </ErrorBoundary>
    </div>
  );
}

import { useFlameState } from '../hooks/useFlameState';

export function Flame() {
  const state = useFlameState();
  return (
    <span
      className={`forge-flame forge-flame--${state}`}
      aria-hidden="true"
      title="Forge"
    >
      {'\uD83D\uDD25'}
    </span>
  );
}

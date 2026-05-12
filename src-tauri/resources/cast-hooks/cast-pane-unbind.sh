#!/usr/bin/env bash
# cast-pane-unbind.sh — SessionStop hook for PTY ↔ Claude session binding
#
# Fires when a Claude session ends. Reads CAST_DESKTOP_PANE_ID from the
# environment and marks the pane binding as ended in the pane_bindings table.
#
# Exit codes:
#   0 = success or graceful no-op
#
# Error handling: logs to cast-desktop-hooks.log, never crashes the hook pipeline

# Subprocess guard: if running as a subagent, exit early
if [ "${CLAUDE_SUBPROCESS:-}" != "" ]; then
  exit 0
fi

set -euo pipefail

# Helper: escape single quotes for SQL interpolation
_escape_sql() {
  local value="$1"
  # Replace each ' with '\''
  printf '%s\n' "${value//\'/\'\'}"
}

# Helper: log errors
_log_error() {
  local msg="$1"
  local log_dir="${CAST_LOG_DIR:-$HOME/.claude/logs}"
  mkdir -p "$log_dir"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] cast-pane-unbind.sh: $msg" >> "$log_dir/cast-desktop-hooks.log"
}

# Read environment
PANE_ID="${CAST_DESKTOP_PANE_ID:-}"
DB_PATH="${CAST_DB_PATH:-$HOME/.claude/cast.db}"

# If pane_id is not set, exit silently
if [[ -z "$PANE_ID" ]]; then
  exit 0
fi

# Escape pane_id for SQL
PANE_ID_ESCAPED=$(_escape_sql "$PANE_ID")

# Ensure DB directory exists
DB_DIR=$(dirname "$DB_PATH")
mkdir -p "$DB_DIR" || true

# Update the binding to mark it ended
# If the table doesn't exist, the UPDATE is a no-op (sqlite returns clean)
if ! sqlite3 "$DB_PATH" <<SQLEOF 2>/dev/null
UPDATE pane_bindings
SET ended_at = strftime('%s','now')
WHERE pane_id = '$PANE_ID_ESCAPED';
SQLEOF
then
  _log_error "Failed to unbind pane_id=$PANE_ID (sqlite3 error)"
  exit 0
fi

exit 0

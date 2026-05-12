#!/usr/bin/env bash
# cast-pane-bind.sh — SessionStart hook for PTY ↔ Claude session binding
#
# Fires when a Claude session starts. Reads CAST_DESKTOP_PANE_ID from the
# environment and binds it to CLAUDE_SESSION_ID in the pane_bindings table.
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
  # Replace each ' with ''
  echo "$value" | sed "s/'/''/g"
}

# Helper: log errors
_log_error() {
  local msg="$1"
  local log_dir="${CAST_LOG_DIR:-$HOME/.claude/logs}"
  mkdir -p "$log_dir"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] cast-pane-bind.sh: $msg" >> "$log_dir/cast-desktop-hooks.log"
}

# Read environment
PANE_ID="${CAST_DESKTOP_PANE_ID:-}"
SESSION_ID="${CLAUDE_SESSION_ID:-}"
PROJECT_PATH="${CAST_DESKTOP_PROJECT_PATH:-${PWD:-}}"
DB_PATH="${CAST_DB_PATH:-$HOME/.claude/cast.db}"

# If pane_id is not set, exit silently
if [[ -z "$PANE_ID" ]]; then
  exit 0
fi

# Escape values for SQL
PANE_ID_ESCAPED=$(_escape_sql "$PANE_ID")
SESSION_ID_ESCAPED=$(_escape_sql "$SESSION_ID")
PROJECT_PATH_ESCAPED=$(_escape_sql "$PROJECT_PATH")

# Ensure DB directory exists
DB_DIR=$(dirname "$DB_PATH")
mkdir -p "$DB_DIR" || true

# Create table if it doesn't exist, then upsert the binding
if ! sqlite3 "$DB_PATH" <<SQLEOF 2>/dev/null
CREATE TABLE IF NOT EXISTS pane_bindings (
  pane_id       TEXT PRIMARY KEY,
  session_id    TEXT,
  started_at    INTEGER,
  ended_at      INTEGER,
  project_path  TEXT
);

INSERT OR REPLACE INTO pane_bindings
  (pane_id, session_id, started_at, project_path, ended_at)
VALUES
  ('$PANE_ID_ESCAPED', '$SESSION_ID_ESCAPED', strftime('%s','now'), '$PROJECT_PATH_ESCAPED', NULL);
SQLEOF
then
  _log_error "Failed to bind pane_id=$PANE_ID to session (sqlite3 error)"
  exit 0
fi

exit 0

#!/usr/bin/env bats
# cast-pane-bind.bats — Tests for PTY ↔ Claude session binding hooks
#
# Tests both cast-pane-bind.sh (SessionStart) and cast-pane-unbind.sh (SessionStop)

HOOKS_DIR="$(cd "$(dirname "$BATS_TEST_FILENAME")" && pwd)"

# ---------------------------------------------------------------------------
# Setup / Teardown
# ---------------------------------------------------------------------------

setup() {
    # Create temp directories for test isolation
    TEST_DB="$BATS_TMPDIR/test-pane-bind-$RANDOM.db"
    TEST_LOG_DIR="$BATS_TMPDIR/test-logs-$RANDOM"

    # Export test env vars
    export CAST_DB_PATH="$TEST_DB"
    export CAST_LOG_DIR="$TEST_LOG_DIR"
    export CAST_DESKTOP_PANE_ID="test-pane-$(uuidgen | tr '[:upper:]' '[:lower:]')"
    export CLAUDE_SESSION_ID="test-session-$(uuidgen | tr '[:upper:]' '[:lower:]')"
    export PWD="/tmp/test-project"
    unset CLAUDE_SUBPROCESS 2>/dev/null || true

    # Create log directory
    mkdir -p "$TEST_LOG_DIR"
}

teardown() {
    # Clean up test DB and logs
    rm -f "$TEST_DB"
    rm -rf "$TEST_LOG_DIR"
}

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

# Query a single value from the test DB
db_query() {
    local sql="$1"
    if [[ ! -f "$TEST_DB" ]]; then
        echo ""
        return 0
    fi
    sqlite3 "$TEST_DB" "$sql" 2>/dev/null || echo ""
}

# Count rows in pane_bindings
db_count_rows() {
    db_query "SELECT COUNT(*) FROM pane_bindings WHERE pane_id = '$CAST_DESKTOP_PANE_ID';"
}

# Get a field value from pane_bindings
db_get_field() {
    local field="$1"
    # Escape single quotes in pane_id for the query
    local pane_id_escaped="${CAST_DESKTOP_PANE_ID//\'/\'\'}"
    db_query "SELECT $field FROM pane_bindings WHERE pane_id = '$pane_id_escaped' LIMIT 1;"
}

# ---------------------------------------------------------------------------
# Tests: cast-pane-bind.sh
# ---------------------------------------------------------------------------

@test "cast-pane-bind: inserts row when env is set" {
    bash "$HOOKS_DIR/cast-pane-bind.sh"

    # Assert success
    [[ $? -eq 0 ]]

    # Assert one row was inserted
    row_count=$(db_count_rows)
    [[ "$row_count" -eq 1 ]]

    # Assert session_id was stored
    stored_session=$(db_get_field "session_id")
    [[ "$stored_session" == "$CLAUDE_SESSION_ID" ]]
}

@test "cast-pane-bind: idempotent (INSERT OR REPLACE)" {
    # Run script twice
    bash "$HOOKS_DIR/cast-pane-bind.sh"
    bash "$HOOKS_DIR/cast-pane-bind.sh"

    # Should still be only one row (INSERT OR REPLACE, not duplicate)
    row_count=$(db_count_rows)
    [[ "$row_count" -eq 1 ]]
}

@test "cast-pane-bind: exits 0 when CAST_DESKTOP_PANE_ID is unset" {
    unset CAST_DESKTOP_PANE_ID

    bash "$HOOKS_DIR/cast-pane-bind.sh"

    # Should exit successfully
    [[ $? -eq 0 ]]

    # No DB row should exist (DB may not even be created)
    if [[ -f "$TEST_DB" ]]; then
        row_count=$(db_count_rows)
        [[ "$row_count" -eq 0 ]]
    fi
}

@test "cast-pane-bind: CLAUDE_SUBPROCESS guard" {
    export CLAUDE_SUBPROCESS=1

    bash "$HOOKS_DIR/cast-pane-bind.sh"

    # Should exit successfully
    [[ $? -eq 0 ]]

    # No DB row should exist
    if [[ -f "$TEST_DB" ]]; then
        row_count=$(db_count_rows)
        [[ "$row_count" -eq 0 ]]
    fi
}

@test "cast-pane-bind: escapes single quotes in project path" {
    # Use CAST_DESKTOP_PROJECT_PATH override — bash subshells reset PWD to
    # actual cwd, so we can't rely on inherited PWD to test a fictional path
    export CAST_DESKTOP_PROJECT_PATH="/tmp/it's a test"

    bash "$HOOKS_DIR/cast-pane-bind.sh"

    # Should succeed
    [[ $? -eq 0 ]]

    # Assert the project path was stored correctly with the single quote
    stored_path=$(db_get_field "project_path")
    [[ "$stored_path" == "/tmp/it's a test" ]]
}

@test "cast-pane-bind: stores project_path from override or PWD" {
    export CAST_DESKTOP_PROJECT_PATH="/tmp/test-project-explicit"

    bash "$HOOKS_DIR/cast-pane-bind.sh"

    # Assert project_path matches the override
    stored_path=$(db_get_field "project_path")
    [[ "$stored_path" == "/tmp/test-project-explicit" ]]
}

@test "cast-pane-bind: started_at is set to current time" {
    before=$(date +%s)
    bash "$HOOKS_DIR/cast-pane-bind.sh"
    after=$(date +%s)

    # Assert started_at is within the time range
    started_at=$(db_get_field "started_at")
    [[ -n "$started_at" ]]
    [[ "$started_at" -ge "$before" ]]
    [[ "$started_at" -le "$after" ]]
}

@test "cast-pane-bind: handles empty CLAUDE_SESSION_ID gracefully" {
    export CLAUDE_SESSION_ID=""

    bash "$HOOKS_DIR/cast-pane-bind.sh"

    # Should succeed
    [[ $? -eq 0 ]]

    # Row should exist but with empty session_id
    row_count=$(db_count_rows)
    [[ "$row_count" -eq 1 ]]
    stored_session=$(db_get_field "session_id")
    [[ -z "$stored_session" ]]
}

# ---------------------------------------------------------------------------
# Tests: cast-pane-unbind.sh
# ---------------------------------------------------------------------------

@test "cast-pane-unbind: sets ended_at when row exists" {
    # First bind the pane
    bash "$HOOKS_DIR/cast-pane-bind.sh"

    # Verify ended_at is NULL after bind
    ended_at_before=$(db_get_field "ended_at")
    [[ -z "$ended_at_before" ]]

    # Now unbind
    bash "$HOOKS_DIR/cast-pane-unbind.sh"

    # Assert ended_at is now set
    ended_at_after=$(db_get_field "ended_at")
    [[ -n "$ended_at_after" ]]
}

@test "cast-pane-unbind: exits 0 when CAST_DESKTOP_PANE_ID is unset" {
    unset CAST_DESKTOP_PANE_ID

    bash "$HOOKS_DIR/cast-pane-unbind.sh"

    # Should exit successfully
    [[ $? -eq 0 ]]
}

@test "cast-pane-unbind: CLAUDE_SUBPROCESS guard" {
    export CLAUDE_SUBPROCESS=1

    bash "$HOOKS_DIR/cast-pane-unbind.sh"

    # Should exit successfully
    [[ $? -eq 0 ]]
}

@test "cast-pane-unbind: no-op when row does not exist (table empty)" {
    # Don't call bind first — DB is pristine

    bash "$HOOKS_DIR/cast-pane-unbind.sh"

    # Should still exit successfully (no-op)
    [[ $? -eq 0 ]]
}

@test "cast-pane-unbind: escapes single quotes in pane_id" {
    # Create a pane ID with a single quote (rare, but test the escaping)
    export CAST_DESKTOP_PANE_ID="pane-with-'quote-test-$(date +%s)"

    bash "$HOOKS_DIR/cast-pane-bind.sh"

    bash "$HOOKS_DIR/cast-pane-unbind.sh"

    # Should have succeeded
    [[ $? -eq 0 ]]

    # ended_at should be set
    ended_at=$(db_get_field "ended_at")
    [[ -n "$ended_at" ]]
}

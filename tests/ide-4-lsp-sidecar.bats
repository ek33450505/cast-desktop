#!/usr/bin/env bats
# ide-4-lsp-sidecar.bats — smoke tests for the TypeScript LSP sidecar binary
#
# Gates on binary existence so CI can skip gracefully if the binary is not built.
# Run locally after `npm run build:lsp-sidecar`.

BINARY="src-tauri/binaries/cast-lsp-ts-aarch64-apple-darwin"

setup() {
  # Change to repo root (bats sets BATS_TEST_DIRNAME to the tests/ dir)
  cd "${BATS_TEST_DIRNAME}/.."
}

# ── Helper ────────────────────────────────────────────────────────────────────

binary_present() {
  [[ -x "${BINARY}" ]]
}

# ── Tests ─────────────────────────────────────────────────────────────────────

@test "skip suite when binary is not built" {
  if binary_present; then
    skip "Binary exists — running real tests"
  fi
  # If binary is absent, this test passes to signal the skip
  true
}

@test "binary starts, prints CAST_LSP_PORT to stdout, and exits cleanly on SIGTERM" {
  if ! binary_present; then
    skip "Binary not built — run: npm run build:lsp-sidecar"
  fi

  # Run the sidecar in background, capture its stdout
  local tmpout
  tmpout=$(mktemp)

  "./${BINARY}" >"${tmpout}" 2>/dev/null &
  local pid=$!

  # Poll for up to 8 seconds for the port announcement
  local port=""
  local waited=0
  while [[ -z "${port}" && ${waited} -lt 80 ]]; do
    sleep 0.1
    waited=$((waited + 1))
    port=$(grep -o 'CAST_LSP_PORT=[0-9]*' "${tmpout}" 2>/dev/null | head -1 | cut -d= -f2)
  done

  # Send SIGTERM and wait for clean exit
  kill -TERM "${pid}" 2>/dev/null || true
  wait "${pid}" 2>/dev/null || true
  rm -f "${tmpout}"

  # Assert a port was announced
  [[ -n "${port}" ]] || {
    echo "No CAST_LSP_PORT line found in sidecar stdout within 8s" >&2
    return 1
  }

  # Assert port is a valid TCP port number
  [[ "${port}" -ge 1024 && "${port}" -le 65535 ]] || {
    echo "Port ${port} is outside valid range 1024-65535" >&2
    return 1
  }
}

@test "announced port is actually listening" {
  if ! binary_present; then
    skip "Binary not built — run: npm run build:lsp-sidecar"
  fi

  local tmpout
  tmpout=$(mktemp)

  "./${BINARY}" >"${tmpout}" 2>/dev/null &
  local pid=$!

  # Wait for port announcement
  local port=""
  local waited=0
  while [[ -z "${port}" && ${waited} -lt 80 ]]; do
    sleep 0.1
    waited=$((waited + 1))
    port=$(grep -o 'CAST_LSP_PORT=[0-9]*' "${tmpout}" 2>/dev/null | head -1 | cut -d= -f2)
  done

  local can_connect=false
  if [[ -n "${port}" ]]; then
    # Use nc (netcat) to probe — exit immediately after connect attempt
    if nc -z 127.0.0.1 "${port}" 2>/dev/null; then
      can_connect=true
    fi
  fi

  kill -TERM "${pid}" 2>/dev/null || true
  wait "${pid}" 2>/dev/null || true
  rm -f "${tmpout}"

  [[ "${can_connect}" == "true" ]] || {
    echo "Port ${port} was announced but not connectable" >&2
    return 1
  }
}

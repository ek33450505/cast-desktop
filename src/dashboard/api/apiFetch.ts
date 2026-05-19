/**
 * Shared fetch utility for API hooks.
 * Throws a descriptive error on non-OK responses so callers don't need
 * to repeat the `if (!res.ok) throw new Error(...)` pattern.
 *
 * Accepts an optional RequestInit for non-GET requests (POST, PUT, DELETE, etc.).
 */
export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = init === undefined ? await fetch(url) : await fetch(url, init)
  if (!res.ok) throw new Error(`API error ${res.status}: ${url}`)
  try {
    return (await res.json()) as T
  } catch {
    // Empty body (e.g. some DELETE responses) — return null as T.
    return null as T
  }
}

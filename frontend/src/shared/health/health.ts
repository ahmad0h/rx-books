export interface HealthReport {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  database: 'up' | 'down';
  time: string;
}

/**
 * Calls the backend health check. A 503 still carries a report (database down),
 * so only other failures are treated as "backend unreachable".
 */
export async function fetchHealth(signal?: AbortSignal): Promise<HealthReport> {
  const res = await fetch('/api/health', { signal, headers: { Accept: 'application/json' } })
  if (res.status !== 200 && res.status !== 503) {
    throw new Error(`Backend answered with HTTP ${res.status}`)
  }
  return (await res.json()) as HealthReport
}

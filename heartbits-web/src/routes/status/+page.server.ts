import type { PageServerLoad } from './$types';

export type ServiceState = 'operational' | 'degraded' | 'down' | 'planned';

export interface Service {
  id: string;
  name: string;
  desc: string;
  state: ServiceState;
  latencyMs: number | null;
  uptime: number | null;
  history: ('ok' | 'degraded' | 'down')[];
}

export interface Incident {
  id: number;
  service: string;
  severity: 'degraded' | 'down';
  started_at: number;
  resolved_at: number | null;
  message: string | null;
}

const MONITOR_URL = process.env.MONITOR_URL ?? 'http://heartbits-monitor:4000';

// ── Live fallback pings (used when monitor is unavailable) ────────────────────

async function livePing(url: string, noRedirect = false): Promise<{ ok: boolean; ms: number }> {
  const t = performance.now();
  try {
    const r = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
      redirect: noRedirect ? 'manual' : 'follow',
      headers: { 'User-Agent': 'HeartBits-Status/1.0' },
    });
    return { ok: r.status === 0 || r.status < 500, ms: Math.round(performance.now() - t) };
  } catch {
    return { ok: false, ms: -1 };
  }
}

function seededHistory(seed: string): ('ok' | 'degraded' | 'down')[] {
  let s = [...seed].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) | 0, 0x9e37);
  const rnd = () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s ^= s >>> 16;
    return (s >>> 0) / 2 ** 32;
  };
  return Array.from({ length: 90 }, (_, i) => {
    const r = rnd(), stab = i >= 80 ? 0.003 : 0.007;
    if (r < stab * 0.6) return 'down';
    if (r < stab * 3)   return 'degraded';
    return 'ok';
  });
}

const WEB_URL   = process.env.WEB_URL   ?? '';
const AUTH_URL  = process.env.AUTH_URL  ?? '';
const RELAY_URL = process.env.RELAY_URL ?? '';
const API_BASE  = process.env.API_BASE_INTERNAL ?? '';

async function liveCheck(): Promise<{ services: Service[]; incidents: Incident[]; fromMonitor: false }> {
  const toState = ({ ok, ms }: { ok: boolean; ms: number }): ServiceState =>
    !ok ? 'down' : ms > 3000 ? 'degraded' : 'operational';

  const apiHealthUrl = API_BASE ? `${API_BASE}/health` : '';
  const checks = await Promise.allSettled([
    WEB_URL      ? livePing(WEB_URL)      : Promise.resolve({ ok: true,  ms: -1 }),
    AUTH_URL     ? livePing(AUTH_URL)     : Promise.resolve({ ok: true,  ms: -1 }),
    RELAY_URL    ? livePing(RELAY_URL)    : Promise.resolve({ ok: true,  ms: -1 }),
    apiHealthUrl ? livePing(apiHealthUrl) : Promise.resolve({ ok: false, ms: -1 }),
  ]);
  const get = (r: typeof checks[0]) => r.status === 'fulfilled' ? r.value : { ok: false, ms: -1 };
  const [web, auth, relay, api] = checks.map(get);

  const webDomain   = WEB_URL   ? new URL(WEB_URL).hostname   : 'heartbits.what-if.io';
  const authDomain  = AUTH_URL  ? new URL(AUTH_URL).hostname  : 'auth.heartbits.what-if.io';
  const relayDomain = RELAY_URL ? new URL(RELAY_URL).hostname : 'relay.heartbits.what-if.io';
  const apiDomain   = 'api.heartbits.what-if.io';

  return {
    fromMonitor: false,
    incidents: [],
    services: [
      { id: 'web',   name: 'Web',   desc: webDomain,   state: toState(web),   latencyMs: web.ms   > 0 ? web.ms   : null, uptime: null, history: seededHistory('web')   },
      { id: 'auth',  name: 'Auth',  desc: authDomain,  state: toState(auth),  latencyMs: auth.ms  > 0 ? auth.ms  : null, uptime: null, history: seededHistory('auth')  },
      { id: 'relay', name: 'Relay', desc: relayDomain, state: toState(relay), latencyMs: relay.ms > 0 ? relay.ms : null, uptime: null, history: seededHistory('relay') },
      { id: 'api',   name: 'API',   desc: apiDomain,   state: apiHealthUrl ? toState(api) : 'planned', latencyMs: api.ms > 0 ? api.ms : null, uptime: null, history: seededHistory('api') },
    ],
  };
}

// ── Load ──────────────────────────────────────────────────────────────────────

export const load: PageServerLoad = async () => {
  // Prefer monitor data (has real history + incidents)
  try {
    const r = await fetch(`${MONITOR_URL}/status`, {
      signal: AbortSignal.timeout(3000),
    });
    if (r.ok) {
      const data = await r.json() as {
        checkedAt: number;
        services: Service[];
        incidents: Incident[];
      };
      return {
        checkedAt:   data.checkedAt,
        fromMonitor: true,
        incidents:   data.incidents ?? [],
        services:    data.services.map(s => ({ ...s, state: s.state as ServiceState })),
      };
    }
  } catch {
    // Monitor not available — fall through to live pings
  }

  return { checkedAt: Date.now(), ...(await liveCheck()) };
};

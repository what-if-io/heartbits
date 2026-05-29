/**
 * HeartBits Monitor — standalone Bun service
 *
 * Polls services every 60s, writes results to SQLite, detects incidents,
 * and exposes a read-only JSON API on :4000 for the status page.
 *
 * DB_PATH  — path to SQLite file   (default /data/heartbits.db)
 * PORT     — HTTP listen port      (default 4000)
 * INTERVAL — check interval in ms  (default 60000)
 */

import { Database } from 'bun:sqlite';
import { mkdirSync } from 'fs';

const DB_PATH  = process.env.DB_PATH  ?? '/data/heartbits.db';
const PORT     = parseInt(process.env.PORT     ?? '4000');
const INTERVAL = parseInt(process.env.INTERVAL ?? '60000');

mkdirSync(DB_PATH.replace(/\/[^/]+$/, ''), { recursive: true });

// ── Database ─────────────────────────────────────────────────────────────────

const db = new Database(DB_PATH);
db.run('PRAGMA journal_mode=WAL');
db.run('PRAGMA synchronous=NORMAL');
db.run('PRAGMA foreign_keys=ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS checks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    service    TEXT    NOT NULL,
    checked_at INTEGER NOT NULL,
    status     TEXT    NOT NULL CHECK(status IN ('operational','degraded','down')),
    latency_ms INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_checks_svc_time ON checks(service, checked_at DESC);

  CREATE TABLE IF NOT EXISTS incidents (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    service     TEXT    NOT NULL,
    severity    TEXT    NOT NULL CHECK(severity IN ('degraded','down')),
    started_at  INTEGER NOT NULL,
    resolved_at INTEGER,
    message     TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_incidents_open ON incidents(service, resolved_at);
`);

// ── Services — URLs from environment ────────────────────────────────────────

const WEB_URL    = process.env.WEB_URL   ?? 'http://heartbits-web:3000';
const AUTH_URL   = process.env.AUTH_URL  ?? '';
const RELAY_URL  = process.env.RELAY_URL ?? '';
const API_URL    = process.env.API_URL   ?? '';

// Public display names (shown on status page instead of internal Docker hostnames)
const APP_DOMAIN   = process.env.APP_DOMAIN   ?? '';
const AUTH_DOMAIN  = process.env.AUTH_DOMAIN  ?? '';
const RELAY_DOMAIN = process.env.RELAY_DOMAIN ?? '';
const API_DOMAIN   = process.env.API_DOMAIN   ?? '';

interface ServiceDef {
  id: string; name: string; url: string;
  desc: string | null; noRedirect: boolean;
}

const SERVICES: ServiceDef[] = [
  { id: 'web',   name: 'Web',   url: WEB_URL,  desc: APP_DOMAIN   || null, noRedirect: false },
  ...(AUTH_URL  ? [{ id: 'auth',  name: 'Auth',  url: AUTH_URL,  desc: AUTH_DOMAIN  || null, noRedirect: false }] : []),
  ...(RELAY_URL ? [{ id: 'relay', name: 'Relay', url: RELAY_URL, desc: RELAY_DOMAIN || null, noRedirect: false }] : []),
  ...(API_URL   ? [{ id: 'api',   name: 'API',   url: API_URL,   desc: API_DOMAIN   || null, noRedirect: false }] : []),
];

// ── Ping ─────────────────────────────────────────────────────────────────────

type Status = 'operational' | 'degraded' | 'down';

async function ping(url: string, noRedirect: boolean): Promise<{ status: Status; ms: number | null }> {
  const t = performance.now();
  try {
    const r = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
      redirect: noRedirect ? 'manual' : 'follow',
      headers: { 'User-Agent': 'HeartBits-Monitor/1.0' },
    });
    const ms = Math.round(performance.now() - t);
    if (r.status === 0 || r.status < 500) {
      return { status: ms > 3000 ? 'degraded' : 'operational', ms };
    }
    return { status: 'down', ms };
  } catch {
    return { status: 'down', ms: null };
  }
}

// ── Prepared statements ───────────────────────────────────────────────────────

const q = {
  insertCheck:   db.prepare('INSERT INTO checks (service, checked_at, status, latency_ms) VALUES (?, ?, ?, ?)'),
  lastStatus:    db.prepare('SELECT status FROM checks WHERE service = ? ORDER BY checked_at DESC LIMIT 1'),
  openIncident:  db.prepare('INSERT INTO incidents (service, severity, started_at, message) VALUES (?, ?, ?, ?)'),
  closeIncident: db.prepare('UPDATE incidents SET resolved_at = ? WHERE service = ? AND resolved_at IS NULL'),
  trimChecks:    db.prepare('DELETE FROM checks WHERE service = ? AND checked_at < ?'),
};

// ── Check loop ────────────────────────────────────────────────────────────────

async function runChecks() {
  const now    = Date.now();
  const cutoff = now - 90 * 86_400_000;

  for (const svc of SERVICES) {
    try {
      const { status, ms } = await ping(svc.url, svc.noRedirect);
      const prev = (q.lastStatus.get(svc.id) as { status: Status } | null)?.status ?? 'operational';

      q.insertCheck.run(svc.id, now, status, ms);
      q.trimChecks.run(svc.id, cutoff);

      if (prev === 'operational' && status !== 'operational') {
        q.openIncident.run(svc.id, status, now, `${svc.name} is ${status}`);
        console.log(`[${ts()}] INCIDENT OPENED  ${svc.id} → ${status}`);
      } else if (prev !== 'operational' && status === 'operational') {
        q.closeIncident.run(now, svc.id);
        console.log(`[${ts()}] INCIDENT RESOLVED ${svc.id}`);
      }
    } catch (e) {
      console.error(`[${ts()}] Error checking ${svc.id}:`, e);
    }
  }
}

// ── Read queries for HTTP API ─────────────────────────────────────────────────

function buildServicesPayload() {
  const today  = Math.floor(Date.now() / 86_400_000);
  const since90 = Date.now() - 90 * 86_400_000;
  const since30 = Date.now() - 30 * 86_400_000;

  return SERVICES.map(svc => {
    const latest = db.query(
      'SELECT status, latency_ms FROM checks WHERE service = ? ORDER BY checked_at DESC LIMIT 1'
    ).get(svc.id) as { status: string; latency_ms: number | null } | null;

    const uptimeRow = db.query(`
      SELECT ROUND(
        100.0 * SUM(CASE WHEN status='operational' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0),
        3
      ) AS pct
      FROM checks WHERE service = ? AND checked_at > ?
    `).get(svc.id, since30) as { pct: number | null } | null;

    // Aggregate checks into daily worst-case buckets
    const dayRows = db.query(`
      SELECT
        (checked_at / 86400000) AS day,
        CASE
          WHEN SUM(CASE WHEN status='down'     THEN 1 ELSE 0 END) > 0 THEN 'down'
          WHEN SUM(CASE WHEN status='degraded' THEN 1 ELSE 0 END) > 0 THEN 'degraded'
          ELSE 'ok'
        END AS worst
      FROM checks
      WHERE service = ? AND checked_at > ?
      GROUP BY day
    `).all(svc.id, since90) as { day: number; worst: string }[];

    const byDay = new Map(dayRows.map(r => [r.day, r.worst]));
    const history = Array.from({ length: 90 }, (_, i) =>
      (byDay.get(today - (89 - i)) ?? 'ok') as 'ok' | 'degraded' | 'down'
    );

    return {
      id:        svc.id,
      name:      svc.name,
      desc:      svc.desc ?? svc.url.replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
      state:     latest?.status ?? 'unknown',
      latencyMs: latest?.latency_ms ?? null,
      uptime:    uptimeRow?.pct ?? null,
      history,
    };
  });
}

function buildIncidentsPayload(days = 90) {
  return db.query(`
    SELECT id, service, severity, started_at, resolved_at, message
    FROM incidents
    WHERE started_at > ?
    ORDER BY started_at DESC
    LIMIT 100
  `).all(Date.now() - days * 86_400_000);
}

// ── HTTP server ───────────────────────────────────────────────────────────────

Bun.serve({
  port: PORT,
  fetch(req) {
    const path = new URL(req.url).pathname;

    if (path === '/healthz') {
      return new Response('ok', { headers: { 'Content-Type': 'text/plain' } });
    }

    if (path === '/status') {
      try {
        const body = JSON.stringify({
          checkedAt: Date.now(),
          services:  buildServicesPayload(),
          incidents: buildIncidentsPayload(),
        });
        return new Response(body, {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (e) {
        console.error(`[${ts()}] /status error:`, e);
        return new Response('Internal error', { status: 500 });
      }
    }

    return new Response('Not found', { status: 404 });
  },
});

// ── Boot ──────────────────────────────────────────────────────────────────────

function ts() { return new Date().toISOString(); }

console.log(`[${ts()}] HeartBits monitor starting — db: ${DB_PATH}, port: ${PORT}, interval: ${INTERVAL}ms`);
runChecks().then(() => {
  setInterval(runChecks, INTERVAL);
});

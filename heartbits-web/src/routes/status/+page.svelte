<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import HeartLogo from '$lib/components/HeartLogo.svelte';
  import type { PageData } from './$types';

  const { data }: { data: PageData } = $props();

  let elapsed = $state(0);
  let ticker: ReturnType<typeof setInterval>;

  onMount(() => {
    ticker = setInterval(() => {
      elapsed = Math.round((Date.now() - data.checkedAt) / 1000);
    }, 1000);
  });
  onDestroy(() => clearInterval(ticker));

  // ── ECG point generation ────────────────────────────────────────────────────
  // Base QRS cycle, period=80, height=48 (baseline=24)
  const BASE: [number, number][] = [
    [0,24],[13,24],[16,20.5],[18.5,24],[20,24],[21,28.5],
    [22.5,3.5],[24.5,38],[27,24],[40,24],[43.5,20],[47,16.5],[50.5,20],[54,24],[80,24],
  ];

  function tileEcg(n: number, xp: number, ys: number): string {
    const xs = xp / 80;
    const pts: string[] = [];
    for (let i = 0; i < n; i++) {
      for (const [px, py] of BASE) {
        pts.push(`${+(i * xp + px * xs).toFixed(1)},${+(py * ys).toFixed(1)}`);
      }
    }
    return pts.join(' ');
  }

  // Hero strip: 48 cycles × 80px = 3840px (doubled for seamless loop → 7680px)
  // We animate translateX(-3840px)
  const HERO_PTS  = tileEcg(96, 80, 1);    // 96 cycles = 7680px

  // Mini card ECG: 20 cycles × 52px = 1040px (loop at -520px)
  const MINI_PTS  = tileEcg(40, 52, 0.583); // 40 cycles = 2080px; loop at -1040px

  // ── Status helpers ──────────────────────────────────────────────────────────
  const overallState = $derived.by(() => {
    const live = data.services.filter(s => s.state !== 'planned').map(s => s.state);
    if (live.includes('down')) return 'down';
    if (live.includes('degraded')) return 'degraded';
    return 'operational';
  });

  const STATUS_TEXT: Record<string, string> = {
    operational: 'All Systems Operational',
    degraded: 'Partial Degradation',
    down: 'Active Incident',
  };

  const STATE_COLOR: Record<string, string> = {
    operational: '#00e87a',
    degraded: '#ffb547',
    down:      '#ff4466',
    planned:   'rgba(255,255,255,0.2)',
  };

  const STATE_LABEL: Record<string, string> = {
    operational: 'Operational',
    degraded:    'Degraded',
    down:        'Outage',
    planned:     'Planned',
  };

  const CARD_SPEED: Record<string, string> = {
    web:   '9s',
    auth:  '11s',
    relay: '7s',
    api:   '10s',
  };

  const opCount   = $derived(data.services.filter(s => s.state === 'operational').length);
  const liveCount = $derived(data.services.filter(s => s.state !== 'planned').length);

  const openIncidents     = $derived((data.incidents ?? []).filter(i => i.resolved_at == null));
  const resolvedIncidents = $derived((data.incidents ?? []).filter(i => i.resolved_at != null));

  function elapsedStr(s: number): string {
    if (s < 5)  return 'just now';
    if (s < 60) return `${s}s ago`;
    return `${Math.round(s / 60)}m ago`;
  }

  function fmtDate(ms: number): string {
    return new Date(ms).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }

  function duration(start: number, end: number | null): string {
    const d = ((end ?? Date.now()) - start) / 1000;
    if (d < 60)   return `${Math.round(d)}s`;
    if (d < 3600) return `${Math.round(d / 60)}m`;
    return `${(d / 3600).toFixed(1)}h`;
  }
</script>

<svelte:head>
  <title>HeartBits — System Status</title>
  <meta name="description" content="Real-time health for HeartBits services.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=JetBrains+Mono:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet">
</svelte:head>

<div class="page" style:--sc={STATE_COLOR[overallState]}>

  <!-- ── AMBIENT GLOW ─────────────────────────────────────────────────────── -->
  <div class="ambient" aria-hidden="true"></div>

  <!-- ── HERO ECG STRIP ──────────────────────────────────────────────────── -->
  <div class="ecg-strip" aria-hidden="true">
    <div class="ecg-runner">
      <svg width="7680" height="48" viewBox="0 0 7680 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="hg" x1="0" x2="7680" y1="0" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stop-color="var(--sc)" stop-opacity="0"/>
            <stop offset="12%"  stop-color="var(--sc)" stop-opacity="0.5"/>
            <stop offset="50%"  stop-color="var(--sc)" stop-opacity="0.85"/>
            <stop offset="88%"  stop-color="var(--sc)" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="var(--sc)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <!-- Phosphor glow layer -->
        <polyline points={HERO_PTS} stroke="url(#hg)" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.07"/>
        <!-- Primary trace -->
        <polyline points={HERO_PTS} stroke="url(#hg)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <!-- Fade edges -->
    <div class="ecg-fade-l" aria-hidden="true"></div>
    <div class="ecg-fade-r" aria-hidden="true"></div>
  </div>

  <!-- ── HEADER ───────────────────────────────────────────────────────────── -->
  <header class="header">
    <div class="wrap">
      <a href="/" class="brand" aria-label="HeartBits home">
        <HeartLogo size={26} />
        <span class="brand-name">HeartBits</span>
        <span class="brand-divider">/</span>
        <span class="brand-page">Status</span>
      </a>
      <div class="header-badge" style:--c={STATE_COLOR[overallState]}>
        <span class="badge-dot"></span>
        <span>{opCount}/{liveCount} operational</span>
      </div>
    </div>
  </header>

  <main class="main">
    <div class="wrap">

      <!-- ── STATUS HERO ───────────────────────────────────────────────────── -->
      <section class="hero" aria-label="Overall system status">
        <div class="hero-ring" aria-hidden="true">
          <div class="ring ring-1"></div>
          <div class="ring ring-2"></div>
          <div class="ring ring-3"></div>
        </div>
        <div class="hero-icon" aria-hidden="true">
          <svg width="54" height="54" viewBox="0 0 54 54" fill="none">
            <circle cx="27" cy="27" r="26" stroke="currentColor" stroke-width="1" stroke-opacity="0.12"/>
            <circle cx="27" cy="27" r="19" stroke="currentColor" stroke-width="0.75" stroke-opacity="0.07"/>
            <path d="M7,27 L15,27 L17.5,23 L20,27 L21,30.5 L22.5,13 L24.5,39.5 L27,27 L37,27 L39.5,23.5 L42,20 L44.5,23.5 L47,27" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          </svg>
        </div>
        <h1 class="hero-headline" style:color={STATE_COLOR[overallState]}>
          {STATUS_TEXT[overallState]}
        </h1>
        <p class="hero-meta">
          Checked {elapsedStr(elapsed)}
          <span class="meta-sep">·</span>
          {data.services.filter(s => s.state !== 'planned').length} services monitored
          <span class="meta-sep">·</span>
          {#if data.fromMonitor}
            <span class="meta-monitor">● live monitoring</span>
          {:else}
            <span class="meta-live">◌ live check</span>
          {/if}
        </p>
      </section>

      <!-- ── SERVICES ──────────────────────────────────────────────────────── -->
      <section class="services" aria-label="Service health">
        <h2 class="section-label">Services</h2>
        <div class="svc-grid">
          {#each data.services as svc (svc.id)}
            <article class="svc-card" class:planned={svc.state === 'planned'}>

              <div class="svc-header">
                <div class="svc-meta">
                  <span class="svc-name">{svc.name}</span>
                  <span class="svc-desc">{svc.desc}</span>
                </div>
                <div class="svc-pill" style:--c={STATE_COLOR[svc.state]}>
                  <span
                    class="pill-dot"
                    class:pulse={svc.state === 'operational'}
                    style:background={STATE_COLOR[svc.state]}
                    style:--dc={STATE_COLOR[svc.state]}
                  ></span>
                  {STATE_LABEL[svc.state]}
                </div>
              </div>

              {#if svc.state !== 'planned'}
                <!-- Mini ECG trace -->
                <div class="svc-ecg" aria-hidden="true">
                  <div
                    class="svc-ecg-runner"
                    style:animation-duration={CARD_SPEED[svc.id]}
                    style:--trace-color={STATE_COLOR[svc.state]}
                  >
                    <svg width="2080" height="28" viewBox="0 0 2080 28" fill="none">
                      <polyline
                        points={MINI_PTS}
                        stroke="var(--trace-color)"
                        stroke-width="1.2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-opacity="0.65"
                      />
                    </svg>
                  </div>
                </div>

                <!-- Stats row -->
                <div class="svc-stats">
                  <div class="svc-stat">
                    <span class="stat-num">
                      {svc.latencyMs ?? '—'}<span class="stat-unit">{svc.latencyMs != null ? 'ms' : ''}</span>
                    </span>
                    <span class="stat-label">latency</span>
                  </div>
                  <div class="svc-stat">
                    <span class="stat-num">
                      {svc.uptime?.toFixed(2) ?? '—'}<span class="stat-unit">{svc.uptime != null ? '%' : ''}</span>
                    </span>
                    <span class="stat-label">30d uptime</span>
                  </div>
                </div>

              {:else}
                <p class="planned-note">Pending deployment</p>
              {/if}

            </article>
          {/each}
        </div>
      </section>

      <!-- ── 90-DAY HISTORY ─────────────────────────────────────────────────── -->
      <section class="history" aria-label="90-day uptime history">
        <h2 class="section-label">Uptime — 90 Days</h2>
        <div class="hist-list">
          {#each data.services as svc (svc.id)}
            <div class="hist-row">
              <span class="hist-name">{svc.name}</span>
              <div class="hist-bars" role="img" aria-label="{svc.name} uptime history">
                {#each svc.history as day, i}
                  <div
                    class="hist-bar bar-{day}"
                    class:recent={i >= 83}
                    style:animation-delay="{i * 5}ms"
                    title="{day} — {90 - i}d ago"
                  ></div>
                {/each}
              </div>
              <span class="hist-pct">
                {svc.uptime != null ? `${svc.uptime.toFixed(2)}%` : '—'}
              </span>
            </div>
          {/each}
          <div class="hist-axis">
            <span>90 days ago</span>
            <span>Today</span>
          </div>
        </div>
      </section>

      <!-- ── INCIDENTS ──────────────────────────────────────────────────────── -->
      <section class="incidents" aria-label="Incident history">
        <h2 class="section-label">Incidents — 90 Days</h2>

        {#if openIncidents.length > 0}
          <div class="incidents-open">
            {#each openIncidents as inc (inc.id)}
              <div class="incident-active" style:--ic={STATE_COLOR[inc.severity]}>
                <div class="inc-dot"></div>
                <div class="inc-body">
                  <div class="inc-title">{inc.message ?? `${inc.service} ${inc.severity}`}</div>
                  <div class="inc-meta">
                    {fmtDate(inc.started_at)}
                    <span class="meta-sep">·</span>
                    ongoing for {duration(inc.started_at, null)}
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}

        {#if resolvedIncidents.length > 0}
          <div class="incident-list">
            {#each resolvedIncidents as inc (inc.id)}
              <div class="incident-row">
                <div class="inc-severity-dot" style:background={STATE_COLOR[inc.severity]}></div>
                <div class="inc-row-body">
                  <span class="inc-row-title">{inc.message ?? `${inc.service} ${inc.severity}`}</span>
                  <span class="inc-row-meta">
                    {fmtDate(inc.started_at)}
                    <span class="meta-sep">·</span>
                    resolved after {duration(inc.started_at, inc.resolved_at)}
                  </span>
                </div>
                <span class="inc-resolved-badge">Resolved</span>
              </div>
            {/each}
          </div>
        {:else if openIncidents.length === 0}
          <div class="incidents-empty">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <circle cx="9" cy="9" r="8" stroke="currentColor" stroke-width="1.2" stroke-opacity="0.25"/>
              <path d="M5.5 9L7.5 11L12.5 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {#if data.fromMonitor}
              No incidents reported in the last 90 days
            {:else}
              Incident history available once monitoring starts
            {/if}
          </div>
        {/if}
      </section>

    </div><!-- /wrap -->
  </main>

  <!-- ── FOOTER ────────────────────────────────────────────────────────────── -->
  <footer class="footer">
    <a href="/" class="footer-brand">
      <HeartLogo size={16} />
      HeartBits
    </a>
    <span class="foot-sep">·</span>
    <a href="/pitch" class="foot-link">About</a>
    <span class="foot-sep">·</span>
    <span class="foot-note">Refreshes on page load</span>
  </footer>

</div>

<style>
  /* ── TYPOGRAPHY ─────────────────────────────────────────── */
  :global(body) { background: #04040e; }

  .page {
    --font-display: 'Syne', system-ui, sans-serif;
    --font-mono: 'JetBrains Mono', 'Cascadia Code', monospace;

    min-height: 100svh;
    background:
      linear-gradient(rgba(255,255,255,0.011) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.011) 1px, transparent 1px),
      #04040e;
    background-size: 44px 44px, 44px 44px, auto;
    color: rgba(255,255,255,0.85);
    position: relative;
    overflow: hidden;
  }

  /* ── AMBIENT ────────────────────────────────────────────── */
  .ambient {
    position: fixed;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(
      ellipse 80% 55% at 50% -5%,
      color-mix(in srgb, var(--sc) 7%, transparent),
      transparent 65%
    );
    transition: background 1.2s ease;
  }

  /* ── ECG STRIP ──────────────────────────────────────────── */
  .ecg-strip {
    position: relative;
    height: 48px;
    overflow: hidden;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .ecg-runner {
    animation: ecg-scroll 14s linear infinite;
    width: 7680px;
    will-change: transform;
  }
  @keyframes ecg-scroll {
    from { transform: translateX(0); }
    to   { transform: translateX(-3840px); }
  }
  .ecg-fade-l,
  .ecg-fade-r {
    position: absolute;
    top: 0; bottom: 0; width: 120px; pointer-events: none;
  }
  .ecg-fade-l {
    left: 0;
    background: linear-gradient(90deg, #04040e, transparent);
  }
  .ecg-fade-r {
    right: 0;
    background: linear-gradient(-90deg, #04040e, transparent);
  }

  /* ── LAYOUT ─────────────────────────────────────────────── */
  .wrap {
    max-width: 940px;
    margin: 0 auto;
    padding: 0 24px;
  }

  /* ── HEADER ─────────────────────────────────────────────── */
  .header {
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .header .wrap {
    height: 54px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    font-family: var(--font-display);
    font-size: 14px;
  }
  .brand-name    { font-weight: 700; color: rgba(255,255,255,0.88); }
  .brand-divider { color: rgba(255,255,255,0.18); }
  .brand-page    { font-weight: 600; color: rgba(255,255,255,0.4); }

  .header-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    border-radius: 100px;
    background: color-mix(in srgb, var(--c) 9%, transparent);
    border: 1px solid color-mix(in srgb, var(--c) 16%, transparent);
    font-family: var(--font-mono);
    font-size: 11px;
    color: color-mix(in srgb, var(--c) 85%, rgba(255,255,255,0.5));
    transition: background 0.6s, border-color 0.6s, color 0.6s;
  }
  .badge-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--c);
    --c: var(--sc);
    animation: dot-pulse 2.2s ease-in-out infinite;
  }
  @keyframes dot-pulse {
    0%, 100% { box-shadow: 0 0 0 0   color-mix(in srgb, var(--c) 55%, transparent); }
    55%      { box-shadow: 0 0 0 4px color-mix(in srgb, var(--c) 0%,  transparent); }
  }

  /* ── MAIN ───────────────────────────────────────────────── */
  .main { position: relative; z-index: 1; }

  /* ── HERO ───────────────────────────────────────────────── */
  .hero {
    text-align: center;
    padding: 68px 0 60px;
    position: relative;
  }
  .hero-ring {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .ring {
    position: absolute;
    border-radius: 50%;
    border: 1px solid color-mix(in srgb, var(--sc) 10%, transparent);
    animation: ring-breathe 4s ease-in-out infinite;
  }
  .ring-1 { width: 220px; height: 220px; animation-delay: 0s;   }
  .ring-2 { width: 340px; height: 340px; animation-delay: 0.6s; opacity: 0.6; }
  .ring-3 { width: 460px; height: 460px; animation-delay: 1.2s; opacity: 0.3; }
  @keyframes ring-breathe {
    0%, 100% { transform: scale(0.96); opacity: 0.5; }
    50%       { transform: scale(1.04); opacity: 1; }
  }

  .hero-icon {
    display: inline-flex;
    color: var(--sc);
    margin-bottom: 24px;
    position: relative;
    z-index: 1;
    animation: icon-glow 3.5s ease-in-out infinite;
  }
  @keyframes icon-glow {
    0%, 100% { filter: drop-shadow(0 0 6px  color-mix(in srgb, var(--sc) 35%, transparent)); }
    50%      { filter: drop-shadow(0 0 22px color-mix(in srgb, var(--sc) 65%, transparent)); }
  }

  .hero-headline {
    font-family: var(--font-display);
    font-size: clamp(26px, 5vw, 42px);
    font-weight: 800;
    letter-spacing: -0.03em;
    margin: 0 0 14px;
    transition: color 0.8s ease;
    position: relative;
    z-index: 1;
  }
  .hero-meta {
    font-family: var(--font-mono);
    font-size: 11px;
    color: rgba(255,255,255,0.28);
    letter-spacing: 0.04em;
    position: relative;
    z-index: 1;
  }
  .meta-sep { margin: 0 8px; color: rgba(255,255,255,0.12); }

  /* ── SECTION LABEL ──────────────────────────────────────── */
  .section-label {
    font-family: var(--font-mono);
    font-size: 9.5px;
    font-weight: 500;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.2);
    margin-bottom: 18px;
  }

  /* ── SERVICE CARDS ──────────────────────────────────────── */
  .services { margin-bottom: 60px; }

  .svc-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
    gap: 10px;
  }

  .svc-card {
    padding: 20px;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.058);
    background: rgba(255,255,255,0.022);
    backdrop-filter: blur(12px);
    overflow: hidden;
    transition: border-color 0.2s;
  }
  .svc-card:hover { border-color: rgba(255,255,255,0.1); }
  .svc-card.planned { opacity: 0.45; }

  .svc-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 14px;
  }
  .svc-meta { display: flex; flex-direction: column; gap: 3px; }
  .svc-name {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    color: rgba(255,255,255,0.9);
    line-height: 1;
  }
  .svc-desc {
    font-family: var(--font-mono);
    font-size: 10px;
    color: rgba(255,255,255,0.24);
    letter-spacing: 0.02em;
  }

  .svc-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 10px 4px 8px;
    border-radius: 100px;
    border: 1px solid color-mix(in srgb, var(--c) 22%, transparent);
    background: color-mix(in srgb, var(--c) 10%, transparent);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.04em;
    white-space: nowrap;
    color: color-mix(in srgb, var(--c) 90%, white);
    flex-shrink: 0;
  }
  .pill-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .pill-dot.pulse {
    animation: pill-pulse 2s ease-in-out infinite;
  }
  @keyframes pill-pulse {
    0%, 100% { box-shadow: 0 0 0 0   color-mix(in srgb, var(--dc) 60%, transparent); }
    55%      { box-shadow: 0 0 0 3.5px color-mix(in srgb, var(--dc) 0%, transparent); }
  }

  /* Mini ECG */
  .svc-ecg {
    height: 28px;
    overflow: hidden;
    margin-bottom: 14px;
    border-radius: 4px;
    mask-image: linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%);
    -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%);
  }
  .svc-ecg-runner {
    width: 2080px;
    animation: mini-ecg-scroll linear infinite;
    will-change: transform;
  }
  @keyframes mini-ecg-scroll {
    from { transform: translateX(0); }
    to   { transform: translateX(-1040px); }
  }

  /* Stats */
  .svc-stats { display: flex; gap: 28px; }
  .svc-stat  { display: flex; flex-direction: column; gap: 3px; }
  .stat-num  {
    font-family: var(--font-mono);
    font-size: 20px;
    font-weight: 500;
    color: rgba(255,255,255,0.85);
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .stat-unit {
    font-size: 10px;
    color: rgba(255,255,255,0.28);
    margin-left: 1px;
    font-weight: 400;
  }
  .stat-label {
    font-family: var(--font-mono);
    font-size: 9.5px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.22);
  }
  .planned-note {
    font-family: var(--font-mono);
    font-size: 12px;
    color: rgba(255,255,255,0.2);
    letter-spacing: 0.04em;
    padding: 8px 0;
    font-style: italic;
  }

  /* ── 90-DAY HISTORY ─────────────────────────────────────── */
  .history { margin-bottom: 56px; }

  .hist-list { display: flex; flex-direction: column; gap: 14px; }

  .hist-row {
    display: flex;
    align-items: flex-end;
    gap: 14px;
  }
  .hist-name {
    font-family: var(--font-display);
    font-size: 12px;
    font-weight: 700;
    color: rgba(255,255,255,0.55);
    width: 54px;
    flex-shrink: 0;
    padding-bottom: 4px;
  }
  .hist-bars {
    display: flex;
    gap: 2px;
    flex: 1;
    align-items: flex-end;
    height: 38px;
  }
  .hist-bar {
    flex: 1;
    max-width: 9px;
    height: 26px;
    border-radius: 2px 2px 1px 1px;
    animation: bar-rise 0.35s ease-out both;
    transform-origin: bottom center;
    transition: filter 0.15s;
    cursor: default;
  }
  .hist-bar:hover { filter: brightness(1.4); }
  .hist-bar.recent { height: 38px; }
  @keyframes bar-rise {
    from { transform: scaleY(0); opacity: 0; }
    to   { transform: scaleY(1); opacity: 1; }
  }
  .bar-ok      { background: rgba(0,   232, 122, 0.42); }
  .bar-degraded { background: rgba(255, 181,  71, 0.48); }
  .bar-down    { background: rgba(255,  68, 102, 0.55); }

  .hist-pct {
    font-family: var(--font-mono);
    font-size: 11px;
    color: rgba(255,255,255,0.28);
    width: 56px;
    text-align: right;
    flex-shrink: 0;
    padding-bottom: 4px;
  }
  .hist-axis {
    display: flex;
    justify-content: space-between;
    padding-left: 68px;
    margin-top: -6px;
  }
  .hist-axis span {
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.13);
  }

  /* ── INCIDENTS ──────────────────────────────────────────── */
  .incidents { margin-bottom: 64px; }

  .meta-monitor { color: #00e87a; opacity: 0.7; }
  .meta-live    { color: rgba(255,255,255,0.28); }

  .incidents-empty {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 18px 22px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.045);
    background: rgba(255,255,255,0.014);
    font-family: var(--font-mono);
    font-size: 12.5px;
    color: rgba(255,255,255,0.26);
    letter-spacing: 0.02em;
  }

  /* Active (open) incidents */
  .incidents-open { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
  .incident-active {
    display: flex; align-items: flex-start; gap: 14px;
    padding: 18px 20px; border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--ic) 28%, transparent);
    background: color-mix(in srgb, var(--ic) 6%, transparent);
  }
  .inc-dot {
    width: 10px; height: 10px; border-radius: 50%;
    background: var(--ic); flex-shrink: 0; margin-top: 3px;
    animation: inc-pulse 1.6s ease-in-out infinite;
  }
  @keyframes inc-pulse {
    0%, 100% { box-shadow: 0 0 0 0   color-mix(in srgb, var(--ic) 50%, transparent); }
    55%      { box-shadow: 0 0 0 6px color-mix(in srgb, var(--ic) 0%,  transparent); }
  }
  .inc-title {
    font-family: var(--font-display); font-size: 14px; font-weight: 700;
    color: color-mix(in srgb, var(--ic) 90%, white); margin-bottom: 4px;
  }
  .inc-meta {
    font-family: var(--font-mono); font-size: 11px;
    color: rgba(255,255,255,0.35); letter-spacing: 0.02em;
  }

  /* Resolved incident list */
  .incident-list { display: flex; flex-direction: column; gap: 2px; }
  .incident-row {
    display: flex; align-items: center; gap: 12px;
    padding: 13px 16px; border-radius: 10px;
    background: rgba(255,255,255,0.016);
    border: 1px solid rgba(255,255,255,0.04);
    transition: background 0.15s;
  }
  .incident-row:hover { background: rgba(255,255,255,0.028); }
  .inc-severity-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; opacity: 0.7; }
  .inc-row-body { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .inc-row-title {
    font-family: var(--font-display); font-size: 13px; font-weight: 600;
    color: rgba(255,255,255,0.75);
  }
  .inc-row-meta {
    font-family: var(--font-mono); font-size: 10px;
    color: rgba(255,255,255,0.28); letter-spacing: 0.02em;
  }
  .inc-resolved-badge {
    font-family: var(--font-mono); font-size: 9.5px;
    letter-spacing: 0.06em; text-transform: uppercase;
    color: rgba(0,232,122,0.55); padding: 2px 8px;
    border-radius: 100px; border: 1px solid rgba(0,232,122,0.15);
    background: rgba(0,232,122,0.05); flex-shrink: 0;
  }

  /* ── FOOTER ─────────────────────────────────────────────── */
  .footer {
    border-top: 1px solid rgba(255,255,255,0.038);
    padding: 22px 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-family: var(--font-mono);
    font-size: 11px;
    color: rgba(255,255,255,0.18);
  }
  .footer-brand {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    text-decoration: none;
    color: rgba(255,255,255,0.26);
    transition: color 0.2s;
  }
  .footer-brand:hover { color: rgba(255,255,255,0.55); }
  .foot-sep  { color: rgba(255,255,255,0.1); }
  .foot-link { color: rgba(255,255,255,0.18); text-decoration: none; transition: color 0.2s; }
  .foot-link:hover { color: rgba(255,255,255,0.45); }
  .foot-note { color: rgba(255,255,255,0.1); }

  /* ── RESPONSIVE ─────────────────────────────────────────── */
  @media (max-width: 600px) {
    .wrap      { padding: 0 16px; }
    .hero      { padding: 44px 0 40px; }
    .ring-2, .ring-3 { display: none; }
    .hist-pct  { display: none; }
    .svc-grid  { grid-template-columns: 1fr; }
    .footer    { flex-wrap: wrap; justify-content: center; gap: 6px; }
  }
</style>

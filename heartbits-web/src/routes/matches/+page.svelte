<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import EcgWaveform from '$lib/components/EcgWaveform.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import HeartLogo from '$lib/components/HeartLogo.svelte';

  interface Match {
    id: string;
    name: string;
    matchedAt: string;
    bpm: number;
    online: boolean;
    color: string;
    distance: string;
  }

  let matches = $state<Match[]>([
    { id: 'ela',  name: 'Ela',  matchedAt: '2 days ago',  bpm: 71, online: true,  color: '#FF6B6B', distance: '2 km' },
    { id: 'mia',  name: 'Mia',  matchedAt: '1 week ago',  bpm: 65, online: false, color: '#7B35DE', distance: '5 km' },
  ]);

  // Simulate BPM drift for online matches
  let bpmInterval: ReturnType<typeof setInterval>;

  onMount(() => {
    bpmInterval = setInterval(() => {
      matches = matches.map(m =>
        m.online
          ? { ...m, bpm: Math.round(Math.max(58, Math.min(88, m.bpm + (Math.random() - 0.5) * 3))) }
          : m
      );
    }, 2000);
  });

  onDestroy(() => clearInterval(bpmInterval));

  // Flatline canvas for empty state
  let flatlineCanvas = $state<HTMLCanvasElement | null>(null);
  let flatlineRaf: number;

  function drawFlatline(timestamp: number) {
    if (!flatlineCanvas) return;
    const ctx = flatlineCanvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = flatlineCanvas.width / dpr;
    const H = flatlineCanvas.height / dpr;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const t = timestamp / 1000;
    // Mostly flatline with occasional beat spike every ~3 seconds
    const beatCycle = 3;
    const phase = (t % beatCycle) / beatCycle;
    const hasBeat = phase > 0.38 && phase < 0.52;

    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, 'rgba(255,107,107,0)');
    grad.addColorStop(0.3, 'rgba(255,107,107,0.4)');
    grad.addColorStop(0.7, 'rgba(123,53,222,0.4)');
    grad.addColorStop(1, 'rgba(123,53,222,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const mid = H / 2;
    const beatRegion = { start: W * 0.4, end: W * 0.6 };

    ctx.beginPath();
    for (let px = 0; px <= W; px += 0.5) {
      let y = mid;
      if (hasBeat && px >= beatRegion.start && px <= beatRegion.end) {
        const relPhase = (phase - 0.38) / 0.14;
        const beatPos = (px - beatRegion.start) / (beatRegion.end - beatRegion.start);
        const scale = H * 0.38;
        // Q wave
        if (beatPos < 0.12) y = mid + Math.sin(beatPos / 0.12 * Math.PI) * scale * 0.2;
        // R spike
        else if (beatPos < 0.36) y = mid - Math.sin((beatPos - 0.12) / 0.24 * Math.PI) * scale;
        // S wave
        else if (beatPos < 0.52) y = mid + Math.sin((beatPos - 0.36) / 0.16 * Math.PI) * scale * 0.25;
        // T wave
        else if (beatPos < 0.9) y = mid - Math.sin((beatPos - 0.52) / 0.38 * Math.PI) * scale * 0.3;
        // Fade in/out with overall beat timing
        const beatAlpha = Math.sin(relPhase * Math.PI);
        y = mid + (y - mid) * beatAlpha;
      }
      if (px === 0) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.stroke();
    ctx.restore();
    flatlineRaf = requestAnimationFrame(drawFlatline);
  }

  // Only run flatline if no matches
  $effect(() => {
    if (matches.length === 0 && flatlineCanvas) {
      const dpr = window.devicePixelRatio || 1;
      flatlineCanvas.width = flatlineCanvas.offsetWidth * dpr;
      flatlineCanvas.height = flatlineCanvas.offsetHeight * dpr;
      flatlineRaf = requestAnimationFrame(drawFlatline);
    }
    return () => cancelAnimationFrame(flatlineRaf);
  });
</script>

<svelte:head>
  <title>Your Bonds — HeartBits</title>
  <meta name="description" content="Your HeartBits matches — people who sent you their heartbeat." />
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="matches-page">
  <!-- Header -->
  <header class="page-header">
    <div class="header-inner">
      <div class="header-title">
        <HeartLogo size={26} />
        <h1>Bonds</h1>
      </div>
      {#if matches.length > 0}
        <span class="count">{matches.length}</span>
      {/if}
    </div>
  </header>

  <div class="content">
    {#if matches.length === 0}
      <!-- ── EMPTY STATE ──────────────────── -->
      <div class="empty-state">
        <div class="empty-flat">
          <canvas
            bind:this={flatlineCanvas}
            class="flatline-canvas"
            style="width: 260px; height: 56px"
          ></canvas>
        </div>
        <p class="empty-title">Your first match is out there.</p>
        <p class="empty-sub">Go discover someone whose heart beats like yours.</p>
        <a href="/discover" class="btn-discover">Start discovering</a>
      </div>
    {:else}
      <!-- ── MATCH LIST ───────────────────── -->
      <div class="match-list">
        {#each matches as match (match.id)}
          <a href="/bond/{match.id}" class="match-card">
            <!-- Pulsing gradient border -->
            <div
              class="card-border-glow"
              style="--mc: {match.color}"
              class:online={match.online}
            ></div>

            <div class="card-inner">
              <!-- Avatar with online indicator -->
              <div class="avatar-wrap">
                <div
                  class="avatar"
                  style="background: linear-gradient(145deg, {match.color}40, {match.color}99)"
                >
                  <span style="color: {match.color}">{match.name[0]}</span>
                </div>
                {#if match.online}
                  <div class="online-dot" style="background: #4ADE80; box-shadow: 0 0 6px #4ADE80"></div>
                {/if}
              </div>

              <!-- Info -->
              <div class="match-info">
                <div class="match-name">{match.name}</div>
                <div class="match-meta">
                  <span>{match.matchedAt}</span>
                  <span class="meta-dot">·</span>
                  <span>{match.distance}</span>
                </div>
                <!-- Mini ECG (online only) -->
                {#if match.online}
                  <div class="mini-ecg">
                    <EcgWaveform
                      bpm={match.bpm}
                      color={match.color}
                      width={100}
                      height={24}
                      useGradient={false}
                    />
                  </div>
                {:else}
                  <div class="offline-flat">
                    <svg width="100" height="24" viewBox="0 0 100 24" fill="none">
                      <line x1="4" y1="12" x2="96" y2="12" stroke="rgba(255,255,255,0.1)" stroke-width="1.2" stroke-dasharray="4 3"/>
                    </svg>
                  </div>
                {/if}
              </div>

              <!-- BPM / status -->
              <div class="match-right">
                {#if match.online}
                  <div class="bpm-badge" style="--mc: {match.color}">
                    <span class="bpm-dot" style="background: {match.color}; box-shadow: 0 0 4px {match.color}"></span>
                    <span class="bpm-num" style="color: {match.color}">{match.bpm}</span>
                    <span class="bpm-unit">bpm</span>
                  </div>
                {:else}
                  <div class="offline-badge">offline</div>
                {/if}
                <svg class="chevron" width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 3L9 7L5 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
          </a>
        {/each}
      </div>

      <!-- Subtle footer note -->
      <p class="list-footer">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 13C7 13 1.5 9 1.5 5.5C1.5 3.57 3.07 2 5 2C5.96 2 6.82 2.43 7.38 3.12C7.94 2.43 8.8 2 9.75 2C11.68 2 13.25 3.57 13.25 5.5C13.25 9 7 13 7 13Z" stroke="url(#lfg)" stroke-width="1.2" fill="none"/>
          <defs>
            <linearGradient id="lfg" x1="1.5" y1="2" x2="13.25" y2="13" gradientUnits="userSpaceOnUse">
              <stop stop-color="#FF6B6B"/>
              <stop offset="1" stop-color="#7B35DE"/>
            </linearGradient>
          </defs>
        </svg>
        Live heartbeats update every 2 seconds
      </p>
    {/if}
  </div>
</div>

<BottomNav />

<style>
  /* ── PAGE ─────────────────────────────────────────── */
  .matches-page {
    min-height: 100svh;
    padding-bottom: calc(var(--nav-h, 72px) + 24px);
  }

  /* ── HEADER ──────────────────────────────────────── */
  .page-header {
    position: sticky;
    top: 0;
    background: rgba(7, 7, 16, 0.92);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    z-index: 10;
    padding: 0 20px;
  }

  .header-inner {
    max-width: 600px;
    margin: 0 auto;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-title h1 {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 22px;
    font-weight: 400;
    color: rgba(255,255,255,0.9);
  }

  .count {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: rgba(255,107,107,0.12);
    color: rgba(255,107,107,0.9);
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255,107,107,0.2);
  }

  /* ── CONTENT ─────────────────────────────────────── */
  .content {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px 16px;
  }

  /* ── EMPTY STATE ─────────────────────────────────── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 80px 24px 40px;
    gap: 14px;
  }

  .empty-flat {
    margin-bottom: 8px;
  }

  .flatline-canvas {
    display: block;
  }

  .empty-title {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 22px;
    font-weight: 400;
    color: rgba(255,255,255,0.75);
    font-style: italic;
  }

  .empty-sub {
    font-size: 14px;
    font-weight: 300;
    line-height: 1.65;
    color: rgba(255,255,255,0.3);
    max-width: 260px;
  }

  .btn-discover {
    display: inline-flex;
    align-items: center;
    padding: 12px 28px;
    background: linear-gradient(135deg, #FF6B6B, #7B35DE);
    border-radius: 100px;
    font-size: 14px;
    font-weight: 500;
    color: white;
    text-decoration: none;
    margin-top: 8px;
    transition: opacity 0.2s ease, transform 0.2s ease;
    box-shadow: 0 0 30px rgba(255,107,107,0.2);
  }

  .btn-discover:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  /* ── MATCH LIST ──────────────────────────────────── */
  .match-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* Match card */
  .match-card {
    position: relative;
    display: block;
    text-decoration: none;
    color: inherit;
    border-radius: 18px;
    overflow: hidden;
    transition: transform 0.2s ease;
  }

  .match-card:hover {
    transform: translateY(-1px);
  }

  .match-card:active {
    transform: scale(0.99);
  }

  /* Animated gradient border */
  .card-border-glow {
    position: absolute;
    inset: 0;
    border-radius: 18px;
    padding: 1px;
    background: rgba(255,255,255,0.06);
    pointer-events: none;
    z-index: 0;
  }

  .card-border-glow.online {
    background: linear-gradient(
      135deg,
      var(--mc) 0%,
      rgba(232,31,140,0.6) 50%,
      var(--mc) 100%
    );
    background-size: 200% 200%;
    animation: border-flow 3s linear infinite;
    opacity: 0.6;
  }

  @keyframes border-flow {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  .card-inner {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    background: rgba(255,255,255,0.03);
    border-radius: 17px;
    margin: 1px;
  }

  /* Avatar */
  .avatar-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar span {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 24px;
    font-weight: 400;
    line-height: 1;
  }

  .online-dot {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 11px;
    height: 11px;
    border-radius: 50%;
    border: 2px solid #070710;
    animation: dot-pulse 1.2s ease-in-out infinite;
  }

  @keyframes dot-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.15); }
  }

  /* Match info */
  .match-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .match-name {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 19px;
    font-weight: 400;
    color: rgba(255,255,255,0.92);
  }

  .match-meta {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    color: rgba(255,255,255,0.28);
    font-weight: 400;
  }

  .meta-dot { opacity: 0.5; }

  /* Mini ECG */
  .mini-ecg {
    margin-top: 2px;
    height: 24px;
    overflow: hidden;
    border-radius: 4px;
  }

  .offline-flat {
    margin-top: 2px;
  }

  /* Right side */
  .match-right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    flex-shrink: 0;
  }

  .bpm-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    background: color-mix(in srgb, var(--mc) 10%, transparent);
    border: 1px solid color-mix(in srgb, var(--mc) 25%, transparent);
    border-radius: 100px;
    padding: 4px 9px;
  }

  .bpm-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    animation: dot-pulse 1.2s ease-in-out infinite;
    flex-shrink: 0;
  }

  .bpm-num {
    font-size: 13px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  .bpm-unit {
    font-size: 9px;
    color: rgba(255,255,255,0.28);
    font-weight: 400;
    letter-spacing: 0.05em;
  }

  .offline-badge {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.18);
    background: rgba(255,255,255,0.04);
    border-radius: 100px;
    padding: 4px 9px;
    border: 1px solid rgba(255,255,255,0.06);
  }

  .chevron {
    color: rgba(255,255,255,0.18);
    transition: color 0.2s ease, transform 0.2s ease;
  }

  .match-card:hover .chevron {
    color: rgba(255,255,255,0.45);
    transform: translateX(2px);
  }

  /* ── LIST FOOTER ─────────────────────────────────── */
  .list-footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 11px;
    color: rgba(255,255,255,0.18);
    font-weight: 400;
    margin-top: 24px;
    letter-spacing: 0.02em;
  }
</style>

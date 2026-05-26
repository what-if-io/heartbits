<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import EcgWaveform from '$lib/components/EcgWaveform.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';

  let id = $derived($page.params.id);
  let partnerName = $derived(id ? id.charAt(0).toUpperCase() + id.slice(1) : 'Unknown');

  // BPM simulation state
  let partnerBpm = $state(71);
  let yourBpm = $state(72);
  let connected = $state(false);
  let connectionStatus = $state<'connecting' | 'live' | 'offline'>('connecting');

  // Simulate a drifting BPM between 65-80
  function simulateBpm(current: number): number {
    const drift = (Math.random() - 0.5) * 3;
    return Math.max(60, Math.min(85, current + drift));
  }

  let bpmInterval: ReturnType<typeof setInterval>;
  let ws: WebSocket | null = null;
  let wsTimeout: ReturnType<typeof setTimeout>;

  function startSimulation() {
    connectionStatus = 'live';
    connected = true;
    bpmInterval = setInterval(() => {
      partnerBpm = simulateBpm(partnerBpm);
      yourBpm = simulateBpm(yourBpm);
    }, 2400);
  }

  function connectWebSocket(roomId: string) {
    try {
      const token = 'mock-token';
      ws = new WebSocket(`wss://hb.what-if.io/${roomId}?token=${token}`);

      wsTimeout = setTimeout(() => {
        // If not connected in 3s, fall back to simulation
        if (!connected) {
          ws?.close();
          startSimulation();
        }
      }, 3000);

      ws.onopen = () => {
        clearTimeout(wsTimeout);
        connectionStatus = 'live';
        connected = true;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.bpm) partnerBpm = data.bpm;
        } catch {}
      };

      ws.onerror = () => {
        clearTimeout(wsTimeout);
        startSimulation();
      };

      ws.onclose = () => {
        if (connected) {
          connectionStatus = 'offline';
          connected = false;
        }
      };
    } catch {
      startSimulation();
    }
  }

  onMount(() => {
    // Attempt real WS, fall back to simulation
    connectWebSocket(id);
  });

  onDestroy(() => {
    ws?.close();
    clearInterval(bpmInterval);
    clearTimeout(wsTimeout);
  });

  // Format BPM for display
  function formatBpm(bpm: number): string {
    return Math.round(bpm).toString();
  }

  // Partner color based on name
  const partnerColors: Record<string, string> = {
    ela: '#FF6B6B',
    mia: '#7B35DE',
    zara: '#E81F8C',
    lena: '#FF8C42',
    kai: '#5B8FE8',
  };

  let partnerColor = $derived(partnerColors[id?.toLowerCase()] ?? '#FF6B6B');
</script>

<svelte:head>
  <title>{partnerName}'s heart — HeartBits</title>
</svelte:head>

<div class="bond-page">
  <!-- Ambient background -->
  <div class="ambient" style="--partner-color: {partnerColor}"></div>

  <!-- Top section: partner -->
  <div class="partner-section">
    <div class="partner-header">
      <div class="avatar" style="background: linear-gradient(135deg, {partnerColor}30, {partnerColor}70); border-color: {partnerColor}40">
        <span style="color: {partnerColor}">{partnerName[0]}</span>
      </div>
      <div class="partner-identity">
        <h2 class="partner-name">{partnerName}</h2>
        <p class="partner-sub">their heart</p>
      </div>
      <div class="status-pill" class:live={connectionStatus === 'live'} class:offline={connectionStatus === 'offline'}>
        <div class="status-dot"></div>
        <span>{connectionStatus === 'live' ? 'live' : connectionStatus === 'connecting' ? 'connecting…' : 'offline'}</span>
      </div>
    </div>

    <!-- Partner waveform — large, dramatic -->
    <div class="waveform-large">
      {#if connected}
        <EcgWaveform bpm={partnerBpm} color={partnerColor} width={340} height={120} useGradient={true} />
      {:else}
        <!-- Flatline -->
        <div class="flatline">
          <svg width="340" height="120" viewBox="0 0 340 120" fill="none">
            <line x1="20" y1="60" x2="320" y2="60" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" stroke-dasharray="6 4"/>
          </svg>
        </div>
      {/if}
    </div>

    <!-- BPM display -->
    <div class="bpm-display">
      <div class="bpm-number" class:flatline-num={!connected} style="color: {connected ? partnerColor : 'rgba(255,255,255,0.2)'}">
        {connected ? formatBpm(partnerBpm) : '--'}
      </div>
      <div class="bpm-label">
        {connected ? 'their BPM' : 'no signal'}
      </div>
    </div>
  </div>

  <!-- Divider -->
  <div class="divider">
    <div class="divider-line"></div>
    <div class="divider-icon">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M12 21C12 21 3 14.5 3 8.5C3 5.42 5.42 3 8.5 3C10.07 3 11.48 3.68 12 4.5C12.52 3.68 13.93 3 15.5 3C18.58 3 21 5.42 21 8.5C21 14.5 12 21 12 21Z" stroke="url(#dv)" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <defs>
          <linearGradient id="dv" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
            <stop stop-color="#FF6B6B"/>
            <stop offset="1" stop-color="#7B35DE"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
    <div class="divider-line"></div>
  </div>

  <!-- Bottom section: you -->
  <div class="your-section">
    <div class="your-header">
      <span class="your-label">your heart</span>
      <div class="bpm-mini">
        <span class="bpm-mini-num">{formatBpm(yourBpm)}</span>
        <span class="bpm-mini-unit">BPM</span>
      </div>
    </div>
    <div class="waveform-small">
      <EcgWaveform bpm={yourBpm} color="#FF6B6B" width={340} height={72} useGradient={true} />
    </div>
  </div>
</div>

<BottomNav />

<style>
  .bond-page {
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    padding: 24px 24px calc(var(--nav-h, 72px) + 16px);
    position: relative;
    overflow: hidden;
  }

  .ambient {
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 50% 35% at 50% 20%, color-mix(in srgb, var(--partner-color) 15%, transparent) 0%, transparent 70%),
      radial-gradient(ellipse 40% 25% at 50% 85%, rgba(123,53,222,0.08) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  /* ── PARTNER SECTION ──────────────────────────── */
  .partner-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    position: relative;
    z-index: 1;
    padding-top: 16px;
  }

  .partner-header {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    max-width: 380px;
  }

  .avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    border: 1.5px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .avatar span {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 20px;
    font-weight: 400;
    line-height: 1;
  }

  .partner-identity {
    flex: 1;
  }

  .partner-name {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 22px;
    font-weight: 400;
    color: rgba(255,255,255,0.9);
    margin-bottom: 2px;
  }

  .partner-sub {
    font-size: 12px;
    color: rgba(255,255,255,0.3);
    font-weight: 400;
  }

  .status-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    border-radius: 100px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: rgba(255,255,255,0.3);
    flex-shrink: 0;
  }

  .status-pill.live {
    background: rgba(74,222,128,0.08);
    border-color: rgba(74,222,128,0.2);
    color: rgba(74,222,128,0.8);
  }

  .status-pill.offline {
    color: rgba(255,255,255,0.2);
  }

  .status-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: currentColor;
  }

  .status-pill.live .status-dot {
    animation: pulse-live 1.2s ease-in-out infinite;
    box-shadow: 0 0 4px currentColor;
  }

  @keyframes pulse-live {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.6); }
  }

  .waveform-large {
    width: 340px;
    height: 120px;
    position: relative;
  }

  .waveform-large::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 48px;
    background: linear-gradient(to right, #070710, transparent);
    z-index: 2;
    pointer-events: none;
  }

  .waveform-large::after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 48px;
    background: linear-gradient(to left, #070710, transparent);
    z-index: 2;
    pointer-events: none;
  }

  .flatline {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* BPM display */
  .bpm-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .bpm-number {
    font-size: clamp(72px, 18vw, 108px);
    font-weight: 200;
    letter-spacing: -0.04em;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    transition: color 0.8s ease;
  }

  .bpm-number.flatline-num {
    color: rgba(255,255,255,0.15) !important;
  }

  .bpm-label {
    font-size: 12px;
    font-weight: 400;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.25);
  }

  /* ── DIVIDER ──────────────────────────────────── */
  .divider {
    display: flex;
    align-items: center;
    gap: 16px;
    position: relative;
    z-index: 1;
    padding: 8px 0;
  }

  .divider-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(to right, transparent, rgba(255,255,255,0.06));
  }

  .divider-line:last-child {
    background: linear-gradient(to left, transparent, rgba(255,255,255,0.06));
  }

  .divider-icon {
    opacity: 0.5;
  }

  /* ── YOUR SECTION ─────────────────────────────── */
  .your-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    position: relative;
    z-index: 1;
  }

  .your-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 340px;
  }

  .your-label {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.25);
  }

  .bpm-mini {
    display: flex;
    align-items: baseline;
    gap: 3px;
  }

  .bpm-mini-num {
    font-size: 18px;
    font-weight: 300;
    font-variant-numeric: tabular-nums;
    color: rgba(255,255,255,0.6);
  }

  .bpm-mini-unit {
    font-size: 10px;
    color: rgba(255,255,255,0.25);
    letter-spacing: 0.08em;
  }

  .waveform-small {
    width: 340px;
    height: 72px;
    position: relative;
    opacity: 0.65;
  }

  .waveform-small::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 40px;
    background: linear-gradient(to right, #070710, transparent);
    z-index: 2;
    pointer-events: none;
  }

  .waveform-small::after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 40px;
    background: linear-gradient(to left, #070710, transparent);
    z-index: 2;
    pointer-events: none;
  }

  @media (max-width: 400px) {
    .waveform-large,
    .waveform-small,
    .your-header {
      width: 100%;
    }
  }
</style>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { slide } from 'svelte/transition';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import EcgWaveform from '$lib/components/EcgWaveform.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import ConsentGate from '$lib/components/ConsentGate.svelte';
  import { consent, grantConsent, checkConsent } from '$lib/stores/consent';

  let id = $derived($page.params.id);
  let partnerName = $derived(id ? id.charAt(0).toUpperCase() + id.slice(1) : 'Unknown');

  // ── CONSENT GATE ────────────────────────────────────
  let showConsentGate = $state(false);

  function handleConsent() {
    grantConsent('1.0');
    showConsentGate = false;
    connectWebSocket(id);
  }

  function handleDecline() {
    goto('/discover');
  }

  // ── BPM STATE ───────────────────────────────────────────
  let partnerBpm = $state(71);
  let yourBpm = $state(72);
  let connected = $state(false);
  let connectionStatus = $state<'connecting' | 'live' | 'offline'>('connecting');

  // Animated displayed BPM (counts up from 0)
  let displayedBpm = $state(0);
  let bpmAnimating = $state(false);

  // Sync detection
  let inSync = $state(false);
  let syncVisible = $state(false);

  // Partner color
  const partnerColors: Record<string, string> = {
    ela: '#FF6B6B',
    mia: '#7B35DE',
    zara: '#E81F8C',
    lena: '#FF8C42',
    kai: '#5B8FE8',
  };

  let partnerColor = $derived(partnerColors[id?.toLowerCase()] ?? '#FF6B6B');

  // ── PULSE RING ──────────────────────────────────────────
  // Fires every 60000/bpm ms
  let pulseActive = $state(false);
  let pulseTimeout: ReturnType<typeof setTimeout>;

  function scheduleNextPulse() {
    const interval = Math.round(60000 / partnerBpm);
    clearTimeout(pulseTimeout);
    pulseTimeout = setTimeout(() => {
      if (!connected) return;
      pulseActive = true;
      setTimeout(() => { pulseActive = false; }, 350);
      scheduleNextPulse();
    }, interval);
  }

  // ── AMBIENT PARTICLES ──────────────────────────────────
  let particleCanvas: HTMLCanvasElement;
  let particleRafId: number;

  interface AmbientParticle {
    x: number; y: number;
    vx: number; vy: number;
    size: number;
    baseSize: number;
    opacity: number;
    phase: number;
    speed: number;
  }

  let ambientParticles: AmbientParticle[] = [];

  function initParticles(W: number, H: number) {
    ambientParticles = [];
    for (let i = 0; i < 18; i++) {
      ambientParticles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: 1.5 + Math.random() * 2.5,
        baseSize: 1.5 + Math.random() * 2.5,
        opacity: 0.15 + Math.random() * 0.25,
        phase: Math.random() * Math.PI * 2,
        speed: 0.8 + Math.random() * 0.6,
      });
    }
  }

  function drawParticles(timestamp: number) {
    if (!particleCanvas) return;
    const ctx = particleCanvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = particleCanvas.width / dpr;
    const H = particleCanvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const beatFreq = connected ? (partnerBpm / 60) : 1;
    const t = timestamp / 1000;

    for (const p of ambientParticles) {
      // Size pulses with heartbeat
      const beatPhase = (t * beatFreq * Math.PI * 2 + p.phase) % (Math.PI * 2);
      const pulse = 0.5 + 0.5 * Math.sin(beatPhase);
      p.size = p.baseSize * (0.8 + pulse * 0.5);

      // Drift
      p.x += p.vx * p.speed;
      p.y += p.vy * p.speed;

      // Wrap
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;

      // Draw as soft glow
      const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 4);
      grd.addColorStop(0, partnerColor + Math.round(p.opacity * 255).toString(16).padStart(2, '0'));
      grd.addColorStop(1, partnerColor + '00');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 4, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      ctx.globalAlpha = p.opacity * 0.8;
      ctx.fillStyle = partnerColor;
      ctx.shadowBlur = 6;
      ctx.shadowColor = partnerColor;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
    }

    ctx.restore();
    particleRafId = requestAnimationFrame(drawParticles);
  }

  // ── BPM COUNT-UP ANIMATION ─────────────────────────────
  function animateBpmCountUp(target: number) {
    bpmAnimating = true;
    displayedBpm = 0;
    const start = performance.now();
    const duration = 1200;
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      // Ease out
      const eased = 1 - Math.pow(1 - t, 3);
      displayedBpm = Math.round(eased * target);
      if (t < 1) requestAnimationFrame(tick);
      else { bpmAnimating = false; displayedBpm = target; }
    }
    requestAnimationFrame(tick);
  }

  // ── SIMULATION ─────────────────────────────────────────
  function simulateBpm(current: number): number {
    return Math.max(60, Math.min(88, current + (Math.random() - 0.5) * 2.5));
  }

  // yourBpm tick — always runs, simulated on web (real device would replace this)
  let bpmInterval: ReturnType<typeof setInterval>;
  // Partner simulation — only when relay is unavailable
  let partnerSimInterval: ReturnType<typeof setInterval>;
  let wsTimeout: ReturnType<typeof setTimeout>;
  let ws: WebSocket | null = null;

  // ── CHAT ──────────────────────────────────────────────
  interface ChatMsg { id: number; from: 'me' | 'them'; text: string; }
  let messages = $state<ChatMsg[]>([]);
  let chatOpen = $state(false);
  let chatUnread = $state(0);
  let chatInput = $state('');
  let chatScrollEl: HTMLDivElement;
  let msgId = 0;

  function sendChat() {
    const text = chatInput.trim();
    if (!text) return;
    messages = [...messages, { id: ++msgId, from: 'me', text }];
    chatInput = '';
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'chat', text }));
    }
    setTimeout(() => { chatScrollEl?.scrollTo({ top: chatScrollEl.scrollHeight, behavior: 'smooth' }); }, 30);
  }

  function handleChatKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); }
  }

  // ── SIMULATION ────────────────────────────────────────
  function checkSync() {
    const diff = Math.abs(Math.round(partnerBpm) - Math.round(yourBpm));
    if (diff <= 5 && !inSync) { inSync = true; setTimeout(() => { syncVisible = true; }, 200); }
    else if (diff > 5 && inSync) { inSync = false; syncVisible = false; }
  }

  function startSimulation() {
    connectionStatus = 'live';
    connected = true;
    animateBpmCountUp(Math.round(partnerBpm));
    scheduleNextPulse();
    partnerSimInterval = setInterval(() => {
      partnerBpm = simulateBpm(partnerBpm);
      checkSync();
    }, 2400);
  }

  async function connectWebSocket(bondId: string) {
    try {
      wsTimeout = setTimeout(() => { if (!connected) startSimulation(); }, 4000);
      const res = await fetch(`/bond/${bondId}/connect`);
      const cfg = await res.json() as { demo: boolean; relayUrl?: string | null; token?: string | null };
      if (cfg.demo || !cfg.relayUrl) { clearTimeout(wsTimeout); startSimulation(); return; }

      ws = new WebSocket(`${cfg.relayUrl}?token=${cfg.token}`);
      ws.onopen = () => {
        clearTimeout(wsTimeout);
        connectionStatus = 'live';
        connected = true;
        animateBpmCountUp(Math.round(partnerBpm));
        scheduleNextPulse();
      };
      ws.onmessage = (event) => {
        try {
          const d = JSON.parse(event.data);
          // BPM — typed protocol or backward compat
          const newBpm = d.type === 'bpm' && typeof d.value === 'number' ? d.value
            : typeof d.bpm === 'number' ? d.bpm : null;
          if (newBpm !== null) { partnerBpm = newBpm; checkSync(); }
          // Chat
          if (d.type === 'chat' && typeof d.text === 'string') {
            messages = [...messages, { id: ++msgId, from: 'them', text: d.text }];
            if (!chatOpen) chatUnread++;
            setTimeout(() => { chatScrollEl?.scrollTo({ top: chatScrollEl.scrollHeight, behavior: 'smooth' }); }, 30);
          }
        } catch {}
      };
      ws.onerror = () => { clearTimeout(wsTimeout); startSimulation(); };
      ws.onclose = () => { if (connected) { connectionStatus = 'offline'; connected = false; } };
    } catch {
      clearTimeout(wsTimeout);
      startSimulation();
    }
  }

  onMount(() => {
    const dpr = window.devicePixelRatio || 1;
    if (particleCanvas) {
      particleCanvas.width = particleCanvas.offsetWidth * dpr;
      particleCanvas.height = particleCanvas.offsetHeight * dpr;
      initParticles(particleCanvas.offsetWidth, particleCanvas.offsetHeight);
      particleRafId = requestAnimationFrame(drawParticles);
    }
    // Always tick own BPM and send it over relay when connected
    bpmInterval = setInterval(() => {
      yourBpm = simulateBpm(yourBpm);
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'bpm', value: Math.round(yourBpm) }));
      }
    }, 2000);
    // GDPR Art. 9: require explicit consent before transmitting biometric data
    if (checkConsent()) {
      connectWebSocket(id);
    } else {
      showConsentGate = true;
    }
  });

  onDestroy(() => {
    ws?.close();
    clearInterval(bpmInterval);
    clearInterval(partnerSimInterval);
    clearTimeout(wsTimeout);
    clearTimeout(pulseTimeout);
    cancelAnimationFrame(particleRafId);
  });

  let displayBpmRounded = $derived(Math.round(displayedBpm));
  let partnerBpmRounded = $derived(Math.round(partnerBpm));
  let yourBpmRounded = $derived(Math.round(yourBpm));

  // Waveform width (full-bleed, capped)
  let waveWidth = $state(340);
  onMount(() => {
    waveWidth = Math.min(window.innerWidth - 32, 540);
    window.addEventListener('resize', () => { waveWidth = Math.min(window.innerWidth - 32, 540); });
  });
</script>

<svelte:head>
  <title>{partnerName}'s heart — HeartBits</title>
  <meta name="description" content="Feel {partnerName}'s heartbeat in real time on HeartBits." />
  <meta name="robots" content="noindex" />
</svelte:head>

{#if showConsentGate}
  <ConsentGate onConsent={handleConsent} onDecline={handleDecline} />
{/if}

<div class="bond-page">
  <!-- Particle canvas — fills entire page -->
  <canvas bind:this={particleCanvas} class="particle-bg" aria-hidden="true"></canvas>

  <!-- Ambient glow that breathes with partner BPM -->
  <div
    class="ambient-glow"
    style="--pc: {partnerColor}"
    class:pulse={pulseActive}
  ></div>

  <div class="bond-content">
    <!-- ── PARTNER HEADER ─────────────────── -->
    <div class="partner-header">
      <div class="partner-avatar" style="background: linear-gradient(145deg, {partnerColor}40, {partnerColor}aa); border-color: {partnerColor}50">
        <span style="color: white">{partnerName[0]}</span>
      </div>
      <div class="partner-identity">
        <h2 class="partner-name">{partnerName}</h2>
        <p class="partner-sub">their heart</p>
      </div>
      <div
        class="status-pill"
        class:live={connectionStatus === 'live'}
        class:offline={connectionStatus === 'offline'}
      >
        <div class="status-dot"></div>
        <span>
          {connectionStatus === 'live' ? 'live' : connectionStatus === 'connecting' ? 'connecting…' : 'offline'}
        </span>
      </div>
    </div>

    <!-- ── PULSE RING + BPM ─────────────── -->
    <div class="pulse-section">
      <!-- Pulse ring (expands on each heartbeat) -->
      <div class="pulse-ring-outer">
        <div
          class="pulse-ring"
          style="--pc: {partnerColor}"
          class:active={pulseActive}
        ></div>
        <div
          class="pulse-ring pulse-ring-2"
          style="--pc: {partnerColor}"
          class:active={pulseActive}
        ></div>
        <!-- BPM display inside ring -->
        <div class="bpm-center">
          <div
            class="bpm-number"
            class:flatline={!connected}
            style="color: {connected ? partnerColor : 'rgba(255,255,255,0.2)'}"
          >
            {connected ? displayBpmRounded : '--'}
          </div>
          <div class="bpm-label">
            {connected ? 'their BPM' : 'no signal'}
          </div>
        </div>
      </div>

      <!-- Sync indicator -->
      <div class="sync-badge" class:visible={syncVisible}>
        <span class="sync-heart">♥</span>
        <span>In sync</span>
      </div>
    </div>

    <!-- ── PARTNER WAVEFORM ────────────── -->
    <div class="waveform-section">
      <div class="waveform-outer" style="width: {waveWidth}px">
        {#if connected}
          <EcgWaveform
            bpm={partnerBpm}
            color={partnerColor}
            width={waveWidth}
            height={100}
            useGradient={true}
          />
          <!-- Light trail glow overlay -->
          <div class="waveform-trail" style="background: linear-gradient(to right, transparent 50%, {partnerColor}18 100%)"></div>
        {:else}
          <!-- Animated flatline → then draws in -->
          <div class="flatline-wrap">
            <svg width={waveWidth} height={100} viewBox="0 0 {waveWidth} 100" fill="none">
              <line
                x1="0" y1="50"
                x2={waveWidth} y2="50"
                stroke="rgba(255,255,255,0.1)"
                stroke-width="1.5"
                stroke-dasharray="5 4"
              />
            </svg>
          </div>
        {/if}
      </div>
    </div>

    <!-- ── DIVIDER ─────────────────────── -->
    <div class="divider">
      <div class="div-line"></div>
      <div class="div-icon">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M11 20C11 20 2 13.5 2 8C2 5.24 4.24 3 7 3C8.64 3 10.1 3.82 11 5.09C11.9 3.82 13.36 3 15 3C17.76 3 20 5.24 20 8C20 13.5 11 20 11 20Z" stroke="url(#divg)" stroke-width="1.4" fill="none"/>
          <defs>
            <linearGradient id="divg" x1="2" y1="3" x2="20" y2="20" gradientUnits="userSpaceOnUse">
              <stop stop-color="#FF6B6B"/>
              <stop offset="1" stop-color="#7B35DE"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <div class="div-line"></div>
    </div>

    <!-- ── YOUR SECTION ─────────────────── -->
    <div class="your-section">
      <div class="your-header" style="width: {waveWidth}px">
        <span class="your-label">your heart</span>
        <div class="your-bpm">
          <span class="your-bpm-num">{yourBpmRounded}</span>
          <span class="your-bpm-unit">BPM</span>
        </div>
      </div>
      <div class="your-waveform" style="width: {waveWidth}px; opacity: 0.45">
        <EcgWaveform
          bpm={yourBpm}
          color="#FF6B6B"
          width={waveWidth}
          height={56}
          useGradient={true}
        />
      </div>
    </div>

    <!-- ── CHAT TOGGLE ───────────────────── -->
    <button
      class="chat-toggle"
      onclick={() => { chatOpen = !chatOpen; if (chatOpen) chatUnread = 0; }}
    >
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M1.5 1.5H13.5V9.5H8L5 13V9.5H1.5V1.5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="none"/>
      </svg>
      <span>Message {partnerName}</span>
      {#if chatUnread > 0 && !chatOpen}
        <span class="chat-badge">{chatUnread}</span>
      {/if}
    </button>
  </div>
</div>

<!-- ── CHAT DRAWER ────────────────── -->
{#if chatOpen}
  <div class="chat-drawer" transition:slide={{duration: 220, axis: 'y'}}>
    <div class="chat-drawer-header">
      <span class="chat-partner-name">{partnerName}</span>
      <button class="chat-close" onclick={() => chatOpen = false} aria-label="Close chat">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    <div class="chat-messages" bind:this={chatScrollEl}>
      {#if messages.length === 0}
        <p class="chat-empty">No messages yet</p>
      {/if}
      {#each messages as msg (msg.id)}
        <div class="chat-msg" class:me={msg.from === 'me'} class:them={msg.from === 'them'}>
          <span class="chat-bubble">{msg.text}</span>
        </div>
      {/each}
    </div>
    <div class="chat-input-row">
      <input
        type="text"
        bind:value={chatInput}
        onkeydown={handleChatKey}
        placeholder="Say something…"
        class="chat-input"
        maxlength={500}
      />
      <button class="chat-send" onclick={sendChat} disabled={!chatInput.trim()}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M13 7L1 1.5L3.5 7L1 12.5L13 7Z" fill="currentColor"/>
        </svg>
      </button>
    </div>
  </div>
{/if}

<BottomNav />

<style>
  /* ── PAGE ─────────────────────────────────────────── */
  .bond-page {
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }

  /* Particle BG canvas */
  .particle-bg {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 0;
  }

  /* Ambient glow */
  .ambient-glow {
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 55% 38% at 50% 28%, color-mix(in srgb, var(--pc) 18%, transparent) 0%, transparent 65%),
      radial-gradient(ellipse 40% 28% at 50% 90%, rgba(123,53,222,0.1) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
    transition: opacity 0.3s ease;
  }

  .ambient-glow.pulse {
    animation: ambient-pulse 0.3s ease forwards;
  }

  @keyframes ambient-pulse {
    0% { opacity: 1; }
    50% { opacity: 1.6; }
    100% { opacity: 1; }
  }

  /* ── CONTENT ─────────────────────────────────────── */
  .bond-content {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px 16px calc(var(--nav-h, 72px) + 16px);
    gap: 20px;
    min-height: 100svh;
  }

  /* ── PARTNER HEADER ──────────────────────────────── */
  .partner-header {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    max-width: 380px;
  }

  .partner-avatar {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    border-width: 1.5px;
    border-style: solid;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 0 20px currentColor;
  }

  .partner-avatar span {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 22px;
    font-weight: 400;
  }

  .partner-identity { flex: 1; }

  .partner-name {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 22px;
    font-weight: 400;
    color: rgba(255,255,255,0.92);
    margin-bottom: 2px;
  }

  .partner-sub {
    font-size: 12px;
    color: rgba(255,255,255,0.3);
    font-weight: 400;
    font-style: italic;
  }

  .status-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 11px;
    border-radius: 100px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: rgba(255,255,255,0.25);
    flex-shrink: 0;
  }

  .status-pill.live {
    background: rgba(74,222,128,0.08);
    border-color: rgba(74,222,128,0.2);
    color: rgba(74,222,128,0.8);
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

  /* ── PULSE RING + BPM ──────────────────────────── */
  .pulse-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    position: relative;
  }

  .pulse-ring-outer {
    position: relative;
    width: 280px;
    height: 280px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .pulse-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 1.5px solid color-mix(in srgb, var(--pc) 40%, transparent);
    box-shadow: 0 0 20px color-mix(in srgb, var(--pc) 15%, transparent);
    transition: transform 0.1s ease, opacity 0.1s ease;
  }

  .pulse-ring.active {
    animation: pulse-expand 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
  }

  .pulse-ring-2 {
    inset: 20px;
    border-color: color-mix(in srgb, var(--pc) 25%, transparent);
  }

  .pulse-ring-2.active {
    animation: pulse-expand-2 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.1s forwards;
  }

  @keyframes pulse-expand {
    0% { transform: scale(1); opacity: 0.8; }
    100% { transform: scale(1.18); opacity: 0; }
  }

  @keyframes pulse-expand-2 {
    0% { transform: scale(1); opacity: 0.6; }
    100% { transform: scale(1.22); opacity: 0; }
  }

  .bpm-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    z-index: 1;
  }

  .bpm-number {
    font-size: clamp(80px, 20vw, 120px);
    font-weight: 200;
    letter-spacing: -0.05em;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    transition: color 0.8s ease;
  }

  .bpm-label {
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.22);
  }

  /* ── SYNC BADGE ──────────────────────────────────── */
  .sync-badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 100px;
    background: rgba(232,31,140,0.1);
    border: 1px solid rgba(232,31,140,0.25);
    font-size: 12px;
    font-weight: 500;
    color: rgba(232,31,140,0.85);
    letter-spacing: 0.06em;
    opacity: 0;
    transform: translateY(6px);
    transition: opacity 0.5s ease, transform 0.5s ease;
    pointer-events: none;
  }

  .sync-badge.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .sync-heart {
    font-size: 14px;
    animation: sync-beat 0.8s ease-in-out infinite;
  }

  @keyframes sync-beat {
    0%, 100% { transform: scale(1); }
    40% { transform: scale(1.25); }
  }

  /* ── WAVEFORM SECTIONS ────────────────────────────── */
  .waveform-section {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .waveform-outer {
    position: relative;
    height: 100px;
  }

  .waveform-outer::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 48px;
    background: linear-gradient(to right, #070710, transparent);
    z-index: 2;
    pointer-events: none;
  }

  .waveform-outer::after {
    content: '';
    position: absolute;
    right: 0; top: 0; bottom: 0;
    width: 48px;
    background: linear-gradient(to left, #070710, transparent);
    z-index: 2;
    pointer-events: none;
  }

  .waveform-trail {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
  }

  .flatline-wrap {
    width: 100%;
    height: 100px;
    display: flex;
    align-items: center;
  }

  /* ── DIVIDER ─────────────────────────────────────── */
  .divider {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    max-width: 380px;
  }

  .div-line {
    flex: 1;
    height: 1px;
    background: rgba(255,255,255,0.06);
  }

  .div-icon { opacity: 0.45; }

  /* ── YOUR SECTION ────────────────────────────────── */
  .your-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .your-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .your-label {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.22);
  }

  .your-bpm {
    display: flex;
    align-items: baseline;
    gap: 3px;
  }

  .your-bpm-num {
    font-size: 18px;
    font-weight: 300;
    font-variant-numeric: tabular-nums;
    color: rgba(255,255,255,0.55);
  }

  .your-bpm-unit {
    font-size: 10px;
    color: rgba(255,255,255,0.22);
    letter-spacing: 0.08em;
  }

  .your-waveform {
    position: relative;
  }

  .your-waveform::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 40px;
    background: linear-gradient(to right, #070710, transparent);
    z-index: 2;
    pointer-events: none;
  }

  .your-waveform::after {
    content: '';
    position: absolute;
    right: 0; top: 0; bottom: 0;
    width: 40px;
    background: linear-gradient(to left, #070710, transparent);
    z-index: 2;
    pointer-events: none;
  }

  /* ── CHAT TOGGLE ─────────────────────────────────── */
  .chat-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 100px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.09);
    color: rgba(255,255,255,0.45);
    font-size: 13px;
    cursor: pointer;
    transition: background 0.18s, color 0.18s;
    position: relative;
  }

  .chat-toggle:hover {
    background: rgba(255,255,255,0.09);
    color: rgba(255,255,255,0.7);
  }

  .chat-badge {
    position: absolute;
    top: -5px;
    right: -5px;
    background: #FF6B6B;
    color: white;
    font-size: 10px;
    font-weight: 700;
    min-width: 16px;
    height: 16px;
    border-radius: 8px;
    padding: 0 3px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* ── CHAT DRAWER ─────────────────────────────────── */
  .chat-drawer {
    position: fixed;
    left: 0;
    right: 0;
    bottom: var(--nav-h, 72px);
    z-index: 150;
    height: min(58vh, 440px);
    background: rgba(7,7,16,0.97);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-top: 1px solid rgba(255,255,255,0.08);
    display: flex;
    flex-direction: column;
  }

  .chat-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 10px;
    border-bottom: 1px solid rgba(255,255,255,0.05);
    flex-shrink: 0;
  }

  .chat-partner-name {
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: rgba(255,255,255,0.55);
  }

  .chat-close {
    color: rgba(255,255,255,0.3);
    padding: 4px;
    cursor: pointer;
    transition: color 0.15s;
  }

  .chat-close:hover { color: rgba(255,255,255,0.6); }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overscroll-behavior: contain;
  }

  .chat-empty {
    margin: auto;
    color: rgba(255,255,255,0.18);
    font-size: 13px;
    font-style: italic;
    text-align: center;
  }

  .chat-msg {
    display: flex;
  }

  .chat-msg.me   { justify-content: flex-end; }
  .chat-msg.them { justify-content: flex-start; }

  .chat-bubble {
    max-width: 74%;
    padding: 9px 14px;
    border-radius: 18px;
    font-size: 14px;
    line-height: 1.45;
    word-break: break-word;
  }

  .chat-msg.me .chat-bubble {
    background: linear-gradient(135deg, #FF6B6B, #E81F8C);
    color: white;
    border-bottom-right-radius: 5px;
  }

  .chat-msg.them .chat-bubble {
    background: rgba(255,255,255,0.07);
    color: rgba(255,255,255,0.82);
    border: 1px solid rgba(255,255,255,0.07);
    border-bottom-left-radius: 5px;
  }

  .chat-input-row {
    display: flex;
    gap: 8px;
    padding: 10px 12px;
    padding-bottom: max(10px, env(safe-area-inset-bottom, 0px));
    border-top: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }

  .chat-input {
    flex: 1;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 22px;
    padding: 9px 16px;
    font-size: 14px;
    color: rgba(255,255,255,0.88);
    outline: none;
    transition: border-color 0.18s;
  }

  .chat-input:focus { border-color: rgba(255,107,107,0.4); }
  .chat-input::placeholder { color: rgba(255,255,255,0.2); }

  .chat-send {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #FF6B6B, #E81F8C);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: opacity 0.18s, transform 0.12s;
    flex-shrink: 0;
    align-self: center;
  }

  .chat-send:disabled { opacity: 0.3; cursor: default; }
  .chat-send:not(:disabled):hover { transform: scale(1.06); }
</style>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fly } from 'svelte/transition';

  interface Person {
    id: string;
    name: string;
    age: number;
    bpm: number;
    color: string;
  }

  interface Props {
    person: Person;
    yourBpm: number;
    ondismiss: () => void;
  }

  let { person, yourBpm, ondismiss }: Props = $props();

  // ── ANIMATION STATE ─────────────────────────────────────
  let phase = $state<'fadeIn' | 'avatars' | 'particles' | 'text' | 'done'>('fadeIn');
  let overlayCanvas: HTMLCanvasElement;
  let ecgCanvas: HTMLCanvasElement;
  let rafId: number;

  // Avatar slide progress 0..1
  let avatarProgress = $state(0);
  // Text fade progress 0..1
  let textProgress = $state(0);
  // Buttons show
  let showButtons = $state(false);

  // Particle system
  interface Particle {
    x: number; y: number;
    vx: number; vy: number;
    life: number;
    color: string;
    size: number;
  }

  let particles: Particle[] = [];
  const COLORS = ['#FF6B6B', '#FF8E42', '#E81F8C', '#B537FF', '#7B35DE', '#FF3E8A'];

  function spawnParticles(cx: number, cy: number) {
    particles = [];
    for (let i = 0; i < 60; i++) {
      const angle = (Math.PI * 2 * i) / 60 + (Math.random() - 0.5) * 0.4;
      const speed = 2.5 + Math.random() * 5;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        life: 0.85 + Math.random() * 0.15,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 2.5 + Math.random() * 4.5,
      });
    }
    // Extra burst — heart-shaped cluster
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      particles.push({
        x: cx + (Math.random() - 0.5) * 20,
        y: cy + (Math.random() - 0.5) * 20,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.5,
        life: 0.6 + Math.random() * 0.4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 1.5 + Math.random() * 3,
      });
    }
  }

  // ── ECG ANIMATION ───────────────────────────────────────
  // Two ECG lines travel from edges to center and sync
  let ecgPhase = $state(0); // 0..1 progress
  let ecgSynced = $state(false);
  let ecgSyncTime = 0;

  function ecgSample(t: number, h: number): number {
    const mid = h / 2;
    const scale = h * 0.4;
    if (t < 0.08) return mid;
    if (t < 0.20) {
      const p = (t - 0.08) / 0.12;
      return mid - Math.sin(p * Math.PI) * scale * 0.18;
    }
    if (t < 0.27) return mid;
    if (t < 0.30) {
      const q = (t - 0.27) / 0.03;
      return mid + Math.sin(q * Math.PI) * scale * 0.25;
    }
    if (t < 0.36) {
      const r = (t - 0.30) / 0.06;
      return mid - Math.sin(r * Math.PI) * scale;
    }
    if (t < 0.41) {
      const s = (t - 0.36) / 0.05;
      return mid + Math.sin(s * Math.PI) * scale * 0.3;
    }
    if (t < 0.52) return mid;
    if (t < 0.72) {
      const tw = (t - 0.52) / 0.20;
      return mid - Math.sin(tw * Math.PI) * scale * 0.35;
    }
    return mid;
  }

  function drawEcg(timestamp: number) {
    if (!ecgCanvas) return;
    const ctx = ecgCanvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = ecgCanvas.width / dpr;
    const H = ecgCanvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2;
    const beatW = 120; // px per beat cycle

    if (!ecgSyncTime) ecgSyncTime = timestamp;
    const elapsed = (timestamp - ecgSyncTime) / 1000;

    // ecgPhase: 0..1 = how far the lines have traveled toward center
    ecgPhase = Math.min(elapsed / 1.8, 1);

    // Left line draws from left toward center
    const leftReach = cx * ecgPhase;
    // Right line draws from right toward center
    const rightReach = cx * ecgPhase;

    // Draw left waveform
    const drawLine = (fromX: number, toX: number, colorA: string, colorB: string, offsetT: number, flip: boolean) => {
      if (toX <= fromX) return;
      const grad = ctx.createLinearGradient(fromX, 0, toX, 0);
      grad.addColorStop(0, colorA + '00');
      grad.addColorStop(0.3, colorA + 'aa');
      grad.addColorStop(1, colorB);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      let started = false;
      const dir = flip ? -1 : 1;
      for (let px = fromX; px <= toX; px += 0.5) {
        const phase = (((flip ? (W - px) : px) * dir + offsetT * beatW) % beatW + beatW) % beatW / beatW;
        const y = ecgSample(phase, H);
        if (!started) { ctx.moveTo(px, y); started = true; }
        else ctx.lineTo(px, y);
      }
      ctx.stroke();
    };

    const t = elapsed;
    drawLine(0, leftReach, '#FF6B6B', '#E81F8C', t, false);
    drawLine(cx, cx + rightReach, person.color, '#E81F8C', t, true);

    // When lines meet — draw glowing synced center
    if (ecgPhase > 0.85) {
      const syncAlpha = (ecgPhase - 0.85) / 0.15;
      ecgSynced = syncAlpha > 0.5;
      ctx.save();
      ctx.shadowBlur = 18 * syncAlpha;
      ctx.shadowColor = '#E81F8C';
      ctx.globalAlpha = syncAlpha;
      // Draw full synced waveform
      const fullGrad = ctx.createLinearGradient(0, 0, W, 0);
      fullGrad.addColorStop(0, '#FF6B6B');
      fullGrad.addColorStop(0.5, '#E81F8C');
      fullGrad.addColorStop(1, person.color);
      ctx.strokeStyle = fullGrad;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      let fs = false;
      for (let px = 0; px <= W; px += 0.5) {
        const phase = ((px + t * beatW) % beatW) / beatW;
        const y = ecgSample(phase, H);
        if (!fs) { ctx.moveTo(px, y); fs = true; }
        else ctx.lineTo(px, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  // ── PARTICLE DRAW ───────────────────────────────────────
  function drawParticles() {
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = overlayCanvas.width / dpr;
    const H = overlayCanvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    for (const p of particles) {
      if (p.life <= 0) continue;
      ctx.globalAlpha = Math.min(p.life * 1.2, 1);
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Update particles
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08; // gravity
      p.vx *= 0.98;
      p.life -= 0.018;
    }
  }

  // ── MAIN ANIMATION LOOP ─────────────────────────────────
  function animate(timestamp: number) {
    drawParticles();
    drawEcg(timestamp);
    rafId = requestAnimationFrame(animate);
  }

  // ── SEQUENCE ────────────────────────────────────────────
  async function runSequence() {
    // Phase 1: fade in (300ms)
    await delay(300);

    // Phase 2: avatars slide in (600ms)
    phase = 'avatars';
    await animateAvatars();

    // Phase 3: particles (immediately on avatar meet)
    await delay(50);
    if (overlayCanvas) {
      const dpr = window.devicePixelRatio || 1;
      spawnParticles(
        (overlayCanvas.width / dpr) / 2,
        (overlayCanvas.height / dpr) / 2
      );
    }

    // Phase 4: text fades in
    phase = 'text';
    await animateText();

    phase = 'done';
    await delay(200);
    showButtons = true;
  }

  function animateAvatars(): Promise<void> {
    return new Promise(resolve => {
      const start = performance.now();
      const duration = 700;
      function tick(now: number) {
        const t = Math.min((now - start) / duration, 1);
        avatarProgress = easeOutBack(t);
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
  }

  function animateText(): Promise<void> {
    return new Promise(resolve => {
      const start = performance.now();
      const duration = 600;
      function tick(now: number) {
        const t = Math.min((now - start) / duration, 1);
        textProgress = easeOutCubic(t);
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
  }

  function easeOutBack(t: number): number {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  function delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  function handleKey(e: KeyboardEvent) {
    if (e.key === 'Escape') ondismiss();
  }

  onMount(() => {
    // Init canvases
    const dpr = window.devicePixelRatio || 1;

    if (overlayCanvas) {
      overlayCanvas.width = overlayCanvas.offsetWidth * dpr;
      overlayCanvas.height = overlayCanvas.offsetHeight * dpr;
    }

    if (ecgCanvas) {
      ecgCanvas.width = ecgCanvas.offsetWidth * dpr;
      ecgCanvas.height = ecgCanvas.offsetHeight * dpr;
    }

    rafId = requestAnimationFrame(animate);
    runSequence();
    window.addEventListener('keydown', handleKey);
  });

  onDestroy(() => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('keydown', handleKey);
  });

  // Avatar positions: they slide from edges to center
  // leftAvatarX: starts at -100, ends at center - 60
  // rightAvatarX: starts at window+100, ends at center + 60
  let leftX = $derived(-120 + avatarProgress * 120);
  let rightX = $derived(120 - avatarProgress * 120);

  // When avatars fully meet: show merge glow
  let merged = $derived(avatarProgress > 0.92);

  let yourInitial = 'Y';
</script>

<!-- Cinematic fullscreen overlay -->
<div class="match-overlay" role="dialog" aria-modal="true" aria-label="It's a match!">
  <!-- Deep black bg -->
  <div class="match-bg"></div>

  <!-- Noise texture -->
  <div class="match-noise"></div>

  <!-- Particle canvas -->
  <canvas
    bind:this={overlayCanvas}
    class="particle-canvas"
    aria-hidden="true"
  ></canvas>

  <!-- Center content -->
  <div class="match-content">

    <!-- ── AVATARS ── -->
    <div class="avatars-row">
      <!-- Your avatar — slides from left -->
      <div
        class="avatar-wrap"
        style="transform: translateX({leftX}px)"
      >
        <div class="avatar-ring your-ring">
          <div class="avatar your-avatar">
            <span>{yourInitial}</span>
          </div>
        </div>
        <p class="avatar-label">You</p>
        <p class="avatar-bpm">{yourBpm} <span>BPM</span></p>
      </div>

      <!-- Center icon (heart) -->
      <div class="center-icon" style="opacity: {merged ? 1 : 0}; transform: scale({merged ? 1 : 0.5})">
        <div class="heart-burst">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M14 25C14 25 2 17 2 10C2 6.69 4.69 4 8 4C10.07 4 11.93 4.96 13 6.5C14.07 4.96 15.93 4 18 4C21.31 4 24 6.69 24 10C24 17 14 25 14 25Z" fill="url(#hbg)" stroke="url(#hbg)" stroke-width="0.5"/>
            <defs>
              <linearGradient id="hbg" x1="2" y1="4" x2="24" y2="25" gradientUnits="userSpaceOnUse">
                <stop stop-color="#FF6B6B"/>
                <stop offset="0.5" stop-color="#E81F8C"/>
                <stop offset="1" stop-color="#7B35DE"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>

      <!-- Partner avatar — slides from right -->
      <div
        class="avatar-wrap"
        style="transform: translateX({rightX}px)"
      >
        <div class="avatar-ring partner-ring" style="--partner-color: {person.color}">
          <div class="avatar partner-avatar" style="background: linear-gradient(145deg, {person.color}55, {person.color}cc)">
            <span style="color: white">{person.name[0]}</span>
          </div>
        </div>
        <p class="avatar-label">{person.name}</p>
        <p class="avatar-bpm" style="color: {person.color}">{person.bpm} <span>BPM</span></p>
      </div>
    </div>

    <!-- ── ECG SYNC ── -->
    <div class="ecg-sync-wrap">
      <canvas
        bind:this={ecgCanvas}
        class="ecg-sync-canvas"
        aria-hidden="true"
      ></canvas>
      {#if ecgSynced}
        <div class="sync-label" style="animation: fade-in-up 0.5s ease forwards">
          ♥ syncing
        </div>
      {/if}
    </div>

    <!-- ── MATCH TEXT ── -->
    {#if phase === 'text' || phase === 'done'}
      <div
        class="match-text"
        style="opacity: {textProgress}; transform: translateY({(1 - textProgress) * 30}px)"
      >
        <h1 class="match-headline">
          <em class="grad-text">It's a match</em>
        </h1>
        <p class="match-subline">Your hearts found each other.</p>
      </div>
    {/if}

    <!-- ── BUTTONS ── -->
    {#if showButtons}
      <div class="match-buttons" in:fly={{ y: 16, duration: 500 }}>
        <a href="/bond/{person.id}" class="btn-message">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 4C3 3.44 3.44 3 4 3H14C14.56 3 15 3.44 15 4V11C15 11.56 14.56 12 14 12H10L7 15V12H4C3.44 12 3 11.56 3 11V4Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
          </svg>
          Send a message
        </a>
        <button class="btn-keep" onclick={ondismiss}>
          Keep discovering
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  /* ── OVERLAY ─────────────────────────────────────────── */
  .match-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    pointer-events: all;
  }

  .match-bg {
    position: absolute;
    inset: 0;
    background: #030308;
  }

  .match-noise {
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
    pointer-events: none;
    z-index: 0;
  }

  /* Ambient glow orbs */
  .match-overlay::before {
    content: '';
    position: absolute;
    width: 500px;
    height: 500px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(232,31,140,0.12) 0%, transparent 70%);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    animation: glow-pulse 2s ease-in-out infinite;
    pointer-events: none;
    z-index: 0;
  }

  @keyframes glow-pulse {
    0%, 100% { opacity: 0.6; transform: translate(-50%,-50%) scale(1); }
    50% { opacity: 1; transform: translate(-50%,-50%) scale(1.15); }
  }

  .particle-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    pointer-events: none;
  }

  /* ── CONTENT ─────────────────────────────────────────── */
  .match-content {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
    padding: 40px 24px;
    width: 100%;
    max-width: 480px;
  }

  /* ── AVATARS ─────────────────────────────────────────── */
  .avatars-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    width: 100%;
    position: relative;
    overflow: visible;
  }

  .avatar-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    will-change: transform;
    flex-shrink: 0;
  }

  .avatar-ring {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    padding: 3px;
    position: relative;
  }

  .your-ring {
    background: linear-gradient(135deg, #FF6B6B, #E81F8C);
    box-shadow:
      0 0 30px rgba(255,107,107,0.4),
      0 0 60px rgba(255,107,107,0.15);
  }

  .partner-ring {
    background: linear-gradient(135deg, var(--partner-color), #E81F8C);
    box-shadow:
      0 0 30px color-mix(in srgb, var(--partner-color) 60%, transparent),
      0 0 60px color-mix(in srgb, var(--partner-color) 25%, transparent);
  }

  .avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(145deg, rgba(255,107,107,0.3), rgba(232,31,140,0.6));
  }

  .your-avatar {
    background: linear-gradient(145deg, rgba(255,107,107,0.2), rgba(232,31,140,0.4));
  }

  .partner-avatar {
    /* set inline */
  }

  .avatar span {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 40px;
    font-weight: 400;
    color: rgba(255,255,255,0.9);
    line-height: 1;
  }

  .avatar-label {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 16px;
    font-weight: 400;
    color: rgba(255,255,255,0.7);
  }

  .avatar-bpm {
    font-size: 13px;
    font-weight: 300;
    color: #FF6B6B;
    font-variant-numeric: tabular-nums;
  }

  .avatar-bpm span {
    font-size: 10px;
    color: rgba(255,255,255,0.3);
    margin-left: 1px;
  }

  /* Center heart icon */
  .center-icon {
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.4s ease, transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    flex-shrink: 0;
    z-index: 1;
  }

  .heart-burst {
    animation: heart-beat 0.9s ease-in-out infinite;
    filter: drop-shadow(0 0 12px rgba(232,31,140,0.7));
  }

  @keyframes heart-beat {
    0%, 100% { transform: scale(1); }
    30% { transform: scale(1.18); }
    60% { transform: scale(0.95); }
  }

  /* ── ECG SYNC ─────────────────────────────────────────── */
  .ecg-sync-wrap {
    position: relative;
    width: 100%;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ecg-sync-canvas {
    width: 100%;
    height: 72px;
    display: block;
  }

  .sync-label {
    position: absolute;
    bottom: -2px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.1em;
    color: rgba(232,31,140,0.8);
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* ── MATCH TEXT ───────────────────────────────────────── */
  .match-text {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .match-headline {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: clamp(52px, 14vw, 80px);
    font-weight: 400;
    line-height: 1;
    letter-spacing: -0.03em;
  }

  .match-headline em {
    font-style: italic;
  }

  .match-subline {
    font-size: 16px;
    font-weight: 300;
    color: rgba(255,255,255,0.45);
    letter-spacing: 0.02em;
  }

  /* ── BUTTONS ──────────────────────────────────────────── */
  .match-buttons {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    width: 100%;
    max-width: 320px;
  }

  .btn-message {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    width: 100%;
    padding: 16px 32px;
    background: linear-gradient(135deg, #FF6B6B, #E81F8C 50%, #7B35DE);
    border-radius: 100px;
    font-size: 16px;
    font-weight: 500;
    color: white;
    text-decoration: none;
    transition: opacity 0.2s ease, transform 0.2s ease;
    box-shadow: 0 0 50px rgba(232,31,140,0.3), 0 8px 30px rgba(0,0,0,0.4);
  }

  .btn-message:hover {
    opacity: 0.92;
    transform: translateY(-1px);
  }

  .btn-keep {
    font-size: 14px;
    font-weight: 400;
    color: rgba(255,255,255,0.35);
    background: none;
    border: none;
    cursor: pointer;
    padding: 8px 16px;
    transition: color 0.2s ease;
    letter-spacing: 0.02em;
  }

  .btn-keep:hover {
    color: rgba(255,255,255,0.65);
  }

  /* ── SHARED ANIMATIONS ───────────────────────────────── */
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes fade-in-up {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Gradient text */
  .grad-text {
    background: linear-gradient(90deg, #FF6B6B, #E81F8C 40%, #7B35DE);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
</style>

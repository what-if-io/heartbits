<script lang="ts">
  import { onMount } from 'svelte';
  import HeartLogo from '$lib/components/HeartLogo.svelte';

  interface Props {
    data: { next: string };
  }

  let { data }: Props = $props();

  let mounted = $state(false);
  // The initiate endpoint starts the PKCE → Zitadel redirect flow.
  // It's separate from this page so the page can render its UI via GET.
  let loginHref = $derived(
    data.next ? `/auth/initiate?next=${encodeURIComponent(data.next)}` : '/auth/initiate'
  );

  // Zitadel registration URL — v2 login UI path
  const registerUrl = `${data.issuer}/ui/v2/login/register`;

  // Canvas ECG animation (same as landing hero, but softer)
  let ecgCanvas: HTMLCanvasElement | undefined = $state();
  let animId: number;

  function drawEcg() {
    if (!ecgCanvas) return;
    const ctx = ecgCanvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = ecgCanvas.width / dpr;
    const h = ecgCanvas.height / dpr;

    ctx.clearRect(0, 0, w * dpr, h * dpr);

    const t = Date.now() / 1000;
    const speed = 50;
    const beatWidth = 140;
    const offset = (t * speed) % beatWidth;

    ctx.save();
    ctx.scale(dpr, dpr);

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(255,107,107,0)');
    grad.addColorStop(0.3, 'rgba(255,107,107,0.3)');
    grad.addColorStop(0.5, 'rgba(232,31,140,0.4)');
    grad.addColorStop(0.7, 'rgba(123,53,222,0.3)');
    grad.addColorStop(1, 'rgba(123,53,222,0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const mid = h / 2;
    const scale = h * 0.38;

    function ecgY(phase: number): number {
      if (phase < 0.08) return mid;
      if (phase < 0.20) {
        const p = (phase - 0.08) / 0.12;
        return mid - Math.sin(p * Math.PI) * scale * 0.18;
      }
      if (phase < 0.27) return mid;
      if (phase < 0.30) {
        const q = (phase - 0.27) / 0.03;
        return mid + Math.sin(q * Math.PI) * scale * 0.25;
      }
      if (phase < 0.36) {
        const r = (phase - 0.30) / 0.06;
        return mid - Math.sin(r * Math.PI) * scale;
      }
      if (phase < 0.41) {
        const s = (phase - 0.36) / 0.05;
        return mid + Math.sin(s * Math.PI) * scale * 0.3;
      }
      if (phase < 0.52) return mid;
      if (phase < 0.72) {
        const tw = (phase - 0.52) / 0.20;
        return mid - Math.sin(tw * Math.PI) * scale * 0.35;
      }
      return mid;
    }

    ctx.beginPath();
    for (let px = 0; px < w; px++) {
      const phase = ((px - offset + beatWidth * 10) % beatWidth) / beatWidth;
      const y = ecgY(phase);
      if (px === 0) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.stroke();
    ctx.restore();

    animId = requestAnimationFrame(drawEcg);
  }

  function initCanvas() {
    if (!ecgCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    ecgCanvas.width = window.innerWidth * dpr;
    ecgCanvas.height = 80 * dpr;
    ecgCanvas.style.width = `${window.innerWidth}px`;
    ecgCanvas.style.height = '80px';
  }

  onMount(() => {
    mounted = true;
    initCanvas();
    drawEcg();
    const onResize = () => initCanvas();
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
    };
  });
</script>

<svelte:head>
  <title>Sign in — HeartBits</title>
  <meta name="description" content="Sign in to HeartBits — the dating app that puts your heart first." />
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="page" class:visible={mounted}>
  <!-- Ambient background elements -->
  <div class="noise" aria-hidden="true"></div>
  <div class="orb orb-1" aria-hidden="true"></div>
  <div class="orb orb-2" aria-hidden="true"></div>
  <div class="orb orb-3" aria-hidden="true"></div>

  <!-- ECG strip across middle -->
  <div class="ecg-strip" aria-hidden="true">
    <canvas bind:this={ecgCanvas}></canvas>
  </div>

  <!-- Main card -->
  <main class="card">
    <!-- Logo -->
    <div class="brand">
      <div class="logo-wrap">
        <HeartLogo size={48} animated={mounted} />
        <div class="pulse-ring" aria-hidden="true"></div>
        <div class="pulse-ring pulse-ring-2" aria-hidden="true"></div>
      </div>
      <span class="wordmark">HeartBits</span>
    </div>

    <!-- Headline -->
    <div class="copy">
      <h1 class="headline">
        Your heart is<br />
        <em class="grad-text">waiting.</em>
      </h1>
      <p class="tagline">
        Sign in to discover people whose heartbeat<br />
        resonates with yours.
      </p>
    </div>

    <!-- Live BPM signal -->
    <div class="bpm-row" aria-hidden="true">
      <span class="dot-live"></span>
      <svg class="mini-ecg" width="64" height="24" viewBox="0 0 64 24" fill="none">
        <path
          d="M0,12 L10,12 L13,8 L15,12 L16,15 L18,4 L20,18 L22,12 L30,12 L32,8 L34,12 L42,12 L44,6 L46,16 L48,12 L64,12"
          stroke="url(#ecg-mini)"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="mini-path"
        />
        <defs>
          <linearGradient id="ecg-mini" x1="0" y1="0" x2="64" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#FF6B6B" />
            <stop offset="100%" stop-color="#7B35DE" />
          </linearGradient>
        </defs>
      </svg>
      <span class="bpm-value">72 BPM</span>
    </div>

    <!-- Primary CTA — drives to the server GET /auth/login which starts PKCE flow -->
    <a href={loginHref} class="btn-primary" role="button">
      <svg class="btn-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 17.5C10 17.5 2.5 12.5 2.5 7.5C2.5 5.29 4.29 3.5 6.5 3.5C7.74 3.5 8.84 4.07 9.5 5C10.16 4.07 11.26 3.5 12.5 3.5C14.71 3.5 16.5 5.29 16.5 7.5C16.5 12.5 10 17.5 10 17.5Z"
          stroke="white"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      Continue with HeartBits account
      <svg class="btn-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </a>

    <!-- Register hint -->
    <p class="register-hint">
      New to HeartBits?
      <a href={registerUrl} class="register-link" target="_blank" rel="noopener noreferrer">
        Create an account
      </a>
    </p>

    <!-- Demo mode -->
    <a href="/auth/demo" class="btn-demo" role="button">
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="7.5" r="6" stroke="currentColor" stroke-width="1.2"/>
        <path d="M5.5 5.5L9.5 7.5L5.5 9.5V5.5Z" fill="currentColor"/>
      </svg>
      Try Demo
    </a>

    <!-- Divider -->
    <div class="divider" aria-hidden="true"></div>

    <!-- Security note -->
    <div class="security-note">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M7 1L2 3.5V7C2 10 4.5 12.5 7 13C9.5 12.5 12 10 12 7V3.5L7 1Z"
          stroke="rgba(255,255,255,0.25)"
          stroke-width="1.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path d="M5 7L6.5 8.5L9 5.5" stroke="rgba(255,255,255,0.25)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>Secured with PKCE · Biometric data stays on your device</span>
    </div>

    <!-- Footer nav -->
    <nav class="footer-nav" aria-label="Legal">
      <a href="/about">About</a>
      <span aria-hidden="true">·</span>
      <a href="/privacy">Privacy</a>
      <span aria-hidden="true">·</span>
      <a href="/terms">Terms</a>
    </nav>
  </main>
</div>

<style>
  /* ── PAGE WRAPPER ──────────────────────────────────── */
  .page {
    min-height: 100svh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    position: relative;
    overflow: hidden;
    opacity: 0;
    transition: opacity 0.6s ease;
  }

  .page.visible {
    opacity: 1;
  }

  /* ── AMBIENT BG ────────────────────────────────────── */
  .noise {
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
    background-repeat: repeat;
    background-size: 256px 256px;
    pointer-events: none;
    z-index: 0;
  }

  .orb {
    position: fixed;
    border-radius: 50%;
    filter: blur(80px);
    pointer-events: none;
    z-index: 0;
  }

  .orb-1 {
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(255, 107, 107, 0.09) 0%, transparent 70%);
    top: -200px;
    left: -200px;
  }

  .orb-2 {
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, rgba(123, 53, 222, 0.11) 0%, transparent 70%);
    bottom: -150px;
    right: -150px;
  }

  .orb-3 {
    width: 350px;
    height: 350px;
    background: radial-gradient(circle, rgba(232, 31, 140, 0.07) 0%, transparent 70%);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }

  /* ── ECG STRIP ─────────────────────────────────────── */
  .ecg-strip {
    position: fixed;
    top: 50%;
    left: 0;
    width: 100%;
    transform: translateY(-50%);
    opacity: 0.2;
    pointer-events: none;
    z-index: 1;
  }

  .ecg-strip canvas {
    display: block;
    width: 100%;
  }

  /* ── CARD ──────────────────────────────────────────── */
  .card {
    position: relative;
    z-index: 2;
    width: 100%;
    max-width: 420px;
    background: rgba(255, 255, 255, 0.035);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 28px;
    padding: 48px 40px 40px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    box-shadow:
      0 40px 120px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(255, 255, 255, 0.03) inset,
      0 1px 0 rgba(255, 255, 255, 0.08) inset;

    /* Subtle glass shimmer on top edge */
    background-image: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.04) 0%,
      transparent 40%
    );
  }

  /* ── BRAND ─────────────────────────────────────────── */
  .brand {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    margin-bottom: 40px;
  }

  .logo-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
  }

  .pulse-ring {
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 1.5px solid rgba(255, 107, 107, 0.25);
    animation: ring-expand 2.4s ease-out infinite;
  }

  .pulse-ring-2 {
    animation-delay: 1.2s;
  }

  @keyframes ring-expand {
    0% { transform: scale(0.7); opacity: 0.7; }
    100% { transform: scale(1.8); opacity: 0; }
  }

  .wordmark {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 22px;
    font-weight: 400;
    letter-spacing: 0.01em;
    color: rgba(255, 255, 255, 0.88);
  }

  /* ── COPY ──────────────────────────────────────────── */
  .copy {
    text-align: center;
    margin-bottom: 36px;
  }

  .headline {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: clamp(32px, 7vw, 44px);
    font-weight: 400;
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: rgba(255, 255, 255, 0.95);
    margin-bottom: 14px;
  }

  .headline em {
    font-style: italic;
  }

  .tagline {
    font-size: 14px;
    font-weight: 300;
    line-height: 1.7;
    color: rgba(255, 255, 255, 0.4);
  }

  /* ── BPM ROW ───────────────────────────────────────── */
  .bpm-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 32px;
    padding: 8px 16px;
    background: rgba(255, 107, 107, 0.07);
    border: 1px solid rgba(255, 107, 107, 0.12);
    border-radius: 100px;
  }

  .dot-live {
    width: 6px;
    height: 6px;
    background: #ff6b6b;
    border-radius: 50%;
    animation: pulse-dot 1.2s ease-in-out infinite;
    box-shadow: 0 0 6px rgba(255, 107, 107, 0.8);
    flex-shrink: 0;
  }

  @keyframes pulse-dot {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.5); opacity: 0.6; }
  }

  .mini-ecg {
    flex-shrink: 0;
  }

  .mini-path {
    stroke-dasharray: 200;
    animation: ecg-scroll 1.8s linear infinite;
  }

  @keyframes ecg-scroll {
    from { stroke-dashoffset: 0; }
    to { stroke-dashoffset: -200; }
  }

  .bpm-value {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255, 107, 107, 0.9);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  /* ── PRIMARY BUTTON ────────────────────────────────── */
  .btn-primary {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 16px 28px;
    background: linear-gradient(135deg, #ff6b6b 0%, #e81f8c 50%, #7b35de 100%);
    border-radius: 100px;
    font-size: 15px;
    font-weight: 500;
    color: white;
    text-decoration: none;
    transition: opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
    box-shadow:
      0 0 40px rgba(255, 107, 107, 0.2),
      0 4px 24px rgba(0, 0, 0, 0.35);
    margin-bottom: 18px;
    letter-spacing: 0.01em;
    position: relative;
    overflow: hidden;
  }

  /* Subtle shimmer overlay */
  .btn-primary::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      105deg,
      transparent 40%,
      rgba(255, 255, 255, 0.12) 50%,
      transparent 60%
    );
    transform: translateX(-100%);
    transition: transform 0.6s ease;
  }

  .btn-primary:hover::before {
    transform: translateX(100%);
  }

  .btn-primary:hover {
    opacity: 0.92;
    transform: translateY(-1px);
    box-shadow:
      0 0 60px rgba(255, 107, 107, 0.3),
      0 8px 32px rgba(0, 0, 0, 0.4);
  }

  .btn-primary:active {
    transform: translateY(0);
    opacity: 1;
  }

  .btn-icon {
    flex-shrink: 0;
    position: relative;
    z-index: 1;
  }

  .btn-arrow {
    flex-shrink: 0;
    margin-left: auto;
    position: relative;
    z-index: 1;
    opacity: 0.7;
  }

  /* ── REGISTER HINT ─────────────────────────────────── */
  .register-hint {
    font-size: 13px;
    font-weight: 300;
    color: rgba(255, 255, 255, 0.35);
    margin-bottom: 32px;
  }

  .register-link {
    color: rgba(255, 107, 107, 0.8);
    text-decoration: none;
    font-weight: 400;
    transition: color 0.2s ease;
    border-bottom: 1px solid rgba(255, 107, 107, 0.2);
    padding-bottom: 1px;
  }

  .register-link:hover {
    color: #ff6b6b;
    border-bottom-color: rgba(255, 107, 107, 0.5);
  }

  /* ── DEMO BUTTON ───────────────────────────────────── */
  .btn-demo {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    width: 100%;
    padding: 11px 20px;
    border-radius: 100px;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
    color: rgba(255, 255, 255, 0.4);
    font-size: 13px;
    text-decoration: none;
    transition: border-color 0.2s, color 0.2s, background 0.2s;
    margin-bottom: 24px;
    letter-spacing: 0.01em;
  }

  .btn-demo:hover {
    border-color: rgba(255, 107, 107, 0.3);
    color: rgba(255, 107, 107, 0.8);
    background: rgba(255, 107, 107, 0.04);
  }

  /* ── DIVIDER ───────────────────────────────────────── */
  .divider {
    width: 100%;
    height: 1px;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.07) 30%,
      rgba(255, 255, 255, 0.07) 70%,
      transparent
    );
    margin-bottom: 24px;
  }

  /* ── SECURITY NOTE ─────────────────────────────────── */
  .security-note {
    display: flex;
    align-items: center;
    gap: 7px;
    margin-bottom: 24px;
  }

  .security-note span {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.2);
    letter-spacing: 0.02em;
  }

  /* ── FOOTER NAV ────────────────────────────────────── */
  .footer-nav {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .footer-nav a {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.2);
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .footer-nav a:hover {
    color: rgba(255, 255, 255, 0.5);
  }

  .footer-nav span {
    color: rgba(255, 255, 255, 0.12);
    font-size: 11px;
  }

  /* ── MOBILE ────────────────────────────────────────── */
  @media (max-width: 480px) {
    .card {
      padding: 40px 28px 32px;
      border-radius: 24px;
    }

    .headline {
      font-size: 34px;
    }

    .btn-primary {
      font-size: 14px;
      padding: 15px 24px;
    }
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import HeartLogo from '$lib/components/HeartLogo.svelte';
  import WaitlistForm from '$lib/components/WaitlistForm.svelte';
  import LangSwitcher from '$lib/components/LangSwitcher.svelte';
  import { m } from '$lib/paraglide/messages.js';

  interface Props {
    data: import('./$types').PageData;
  }

  let { data }: Props = $props();

  let heroCanvas: HTMLCanvasElement;
  let animFrameId: number;
  let mounted = $state(false);

  // If user is already logged in, CTAs go directly to the app
  let ctaHref = $derived(data.loggedIn ? '/discover' : '/auth/login');

  // Draw repeating ECG waveform across hero canvas
  function drawHeroWaveform() {
    if (!heroCanvas) return;
    const ctx = heroCanvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = heroCanvas.width / dpr;
    const h = heroCanvas.height / dpr;

    ctx.clearRect(0, 0, w * dpr, h * dpr);

    const t = Date.now() / 1000;
    const speed = 60; // px/s
    const beatWidth = 140;
    const offset = (t * speed) % beatWidth;

    ctx.save();
    ctx.scale(dpr, dpr);

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(255,107,107,0)');
    grad.addColorStop(0.2, 'rgba(255,107,107,0.5)');
    grad.addColorStop(0.5, 'rgba(232,31,140,0.5)');
    grad.addColorStop(0.8, 'rgba(123,53,222,0.5)');
    grad.addColorStop(1, 'rgba(123,53,222,0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const mid = h / 2;
    const scale = h * 0.32;

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

    animFrameId = requestAnimationFrame(drawHeroWaveform);
  }

  function initCanvas() {
    if (!heroCanvas) return;
    const dpr = window.devicePixelRatio || 1;
    heroCanvas.width = window.innerWidth * dpr;
    heroCanvas.height = 120 * dpr;
    heroCanvas.style.width = `${window.innerWidth}px`;
    heroCanvas.style.height = `120px`;
  }

  onMount(() => {
    mounted = true;
    initCanvas();
    drawHeroWaveform();

    const onResize = () => {
      initCanvas();
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('resize', onResize);
    };
  });
</script>

<svelte:head>
  <title>HeartBits — Feel the connection.</title>
  <meta name="description" content="HeartBits — the dating app that puts your heart first. Share your real heartbeat with your matches. No swipes, just biology." />
  <meta property="og:title" content="HeartBits — Feel the connection." />
  <meta property="og:description" content="The dating app that puts your heart first. Literally. Share your real-time heartbeat with your matches." />
  <meta property="og:url" content={typeof window !== 'undefined' ? window.location.origin : ''} />
</svelte:head>

<div class="landing">
  <!-- Discoverable language switch at the top (footer has one too) -->
  <div class="lang-top"><LangSwitcher /></div>

  <!-- ─── HERO ─────────────────────────────────────── -->
  <section class="hero">
    <!-- Background noise texture overlay -->
    <div class="noise"></div>

    <!-- Ambient glow orbs -->
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>

    <!-- ECG canvas running across full width -->
    <div class="ecg-strip" aria-hidden="true">
      <canvas bind:this={heroCanvas}></canvas>
    </div>

    <!-- Hero content -->
    <div class="hero-content" class:visible={mounted}>
      <div class="logo-lockup">
        <HeartLogo size={52} animated={true} />
        <span class="wordmark">HeartBits</span>
      </div>

      <h1 class="headline">
        {m.hero_title_line1()}<br />
        <em class="grad-text">{m.hero_title_line2()}</em>
      </h1>

      <p class="subline">
        {m.hero_subline()}
      </p>

      {#if data.loggedIn}
        <div class="cta-group">
          <a href={ctaHref} class="btn-cta">
            {m.hero_start_feeling()}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </a>
          <a href="#how" class="btn-ghost">{m.how_it_works()}</a>
        </div>
      {:else}
        <div class="cta-stack">
          <WaitlistForm />
          <p class="cta-note">{m.waitlist_note()}</p>
          <div class="cta-secondary">
            <a href="/auth/demo" class="link-soft">{m.try_demo()}</a>
            <span class="dot-sep">·</span>
            <a href="#how" class="link-soft">{m.how_it_works()}</a>
          </div>
        </div>
      {/if}

      <!-- Trust signal -->
      <div class="trust">
        <div class="bpm-live">
          <span class="dot-live"></span>
          <span>{m.hero_bpm({ bpm: 72 })}</span>
        </div>
        <span class="trust-text">{m.hero_trust()}</span>
      </div>
    </div>

    <!-- Scroll indicator -->
    <div class="scroll-hint" aria-hidden="true">
      <svg width="20" height="30" viewBox="0 0 20 30">
        <rect x="1" y="1" width="18" height="28" rx="9" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" fill="none"/>
        <circle class="scroll-dot" cx="10" cy="8" r="2.5" fill="rgba(255,255,255,0.4)"/>
      </svg>
    </div>
  </section>

  <!-- ─── HOW IT WORKS ──────────────────────────────── -->
  <section class="how" id="how">
    <div class="section-label">{m.how_label()}</div>
    <h2 class="section-title">{m.how_title_pre()}<em class="grad-text">{m.how_title_em()}</em></h2>

    <div class="steps">
      <div class="step">
        <div class="step-icon">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="12" stroke="url(#sg1)" stroke-width="1.5"/>
            <circle cx="16" cy="16" r="5" stroke="url(#sg1)" stroke-width="1.5"/>
            <circle cx="16" cy="16" r="8.5" stroke="url(#sg1)" stroke-width="0.5" stroke-dasharray="2 3"/>
            <defs>
              <linearGradient id="sg1" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
                <stop stop-color="#FF6B6B"/>
                <stop offset="1" stop-color="#7B35DE"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="step-num">01</div>
        <h3>{m.how_step1_title()}</h3>
        <p>{m.how_step1_desc()}</p>
      </div>

      <div class="step-connector" aria-hidden="true">
        <svg width="40" height="2" viewBox="0 0 40 2">
          <line x1="0" y1="1" x2="40" y2="1" stroke="url(#lc1)" stroke-width="1.5" stroke-dasharray="4 3"/>
          <defs>
            <linearGradient id="lc1" x1="0" y1="0" x2="40" y2="0" gradientUnits="userSpaceOnUse">
              <stop stop-color="#FF6B6B"/>
              <stop offset="1" stop-color="#7B35DE"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div class="step">
        <div class="step-icon">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M4 16H8L10 10L13 22L16 13L18 18L20 16H28" stroke="url(#sg2)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <defs>
              <linearGradient id="sg2" x1="0" y1="0" x2="32" y2="0" gradientUnits="userSpaceOnUse">
                <stop stop-color="#FF6B6B"/>
                <stop offset="1" stop-color="#E81F8C"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="step-num">02</div>
        <h3>{m.how_step2_title()}</h3>
        <p>{m.how_step2_desc()}</p>
      </div>

      <div class="step-connector" aria-hidden="true">
        <svg width="40" height="2" viewBox="0 0 40 2">
          <line x1="0" y1="1" x2="40" y2="1" stroke="url(#lc2)" stroke-width="1.5" stroke-dasharray="4 3"/>
          <defs>
            <linearGradient id="lc2" x1="0" y1="0" x2="40" y2="0" gradientUnits="userSpaceOnUse">
              <stop stop-color="#E81F8C"/>
              <stop offset="1" stop-color="#7B35DE"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div class="step">
        <div class="step-icon">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 27C16 27 5 19.5 5 11.5C5 8.46 7.46 6 10.5 6C12.24 6 13.78 6.82 14.5 8C15.22 6.82 16.76 6 18.5 6C21.54 6 24 8.46 24 11.5C24 19.5 16 27 16 27Z" stroke="url(#sg3)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            <defs>
              <linearGradient id="sg3" x1="5" y1="6" x2="24" y2="27" gradientUnits="userSpaceOnUse">
                <stop stop-color="#E81F8C"/>
                <stop offset="1" stop-color="#7B35DE"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="step-num">03</div>
        <h3>{m.how_step3_title()}</h3>
        <p>{m.how_step3_desc()}</p>
      </div>
    </div>
  </section>

  <!-- ─── THE MOMENT ────────────────────────────────── -->
  <section class="moment">
    <div class="section-label">{m.moment_label()}</div>
    <h2 class="section-title">{m.moment_title_pre()}<em class="grad-text">{m.moment_title_em()}</em></h2>

    <div class="phones-wrap">
      <!-- Phone A -->
      <div class="phone phone-left">
        <div class="phone-shell">
          <div class="phone-notch"></div>
          <div class="phone-screen">
            <div class="phone-name">{m.moment_phone_name()}</div>
            <div class="phone-sub">{m.moment_phone_distance()}</div>
            <div class="phone-wave">
              <svg width="200" height="60" viewBox="0 0 200 60" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="pw1" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#FF6B6B" stop-opacity="0"/>
                    <stop offset="20%" stop-color="#FF6B6B"/>
                    <stop offset="100%" stop-color="#E81F8C" stop-opacity="0.6"/>
                  </linearGradient>
                </defs>
                <path class="wave-path-a" d="M0,30 L20,30 L23,22 L27,30 L28,35 L31,10 L34,42 L37,30 L50,30 L55,30 L58,23 L61,30 L71,30 L74,14 L77,38 L80,30 L100,30 L103,22 L107,30 L108,35 L111,10 L114,42 L117,30 L130,30 L133,23 L136,30 L146,30 L149,14 L152,38 L155,30 L175,30 L178,22 L182,30 L183,35 L186,10 L189,42 L192,30 L200,30" stroke="url(#pw1)" stroke-width="1.8" fill="none" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="phone-bpm">72 <span>BPM</span></div>
            <div class="phone-status sending">{m.moment_status_sending()}</div>
          </div>
        </div>
      </div>

      <!-- Center pulse -->
      <div class="center-pulse">
        <div class="pulse-ring pulse-ring-1"></div>
        <div class="pulse-ring pulse-ring-2"></div>
        <div class="pulse-ring pulse-ring-3"></div>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          <path d="M18 31C18 31 6 22.5 6 13.5C6 9.91 8.91 7 12.5 7C14.53 7 16.32 7.95 17.25 9.5C18.18 7.95 19.97 7 22 7C25.59 7 28.5 9.91 28.5 13.5C28.5 22.5 18 31 18 31Z" fill="url(#pg1)" stroke="url(#pg1)" stroke-width="0.5"/>
          <defs>
            <linearGradient id="pg1" x1="6" y1="7" x2="28.5" y2="31" gradientUnits="userSpaceOnUse">
              <stop stop-color="#FF6B6B"/>
              <stop offset="1" stop-color="#7B35DE"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      <!-- Phone B -->
      <div class="phone phone-right">
        <div class="phone-shell">
          <div class="phone-notch"></div>
          <div class="phone-screen">
            <div class="phone-name">{m.moment_phone_you()}</div>
            <div class="phone-sub">{m.moment_phone_waiting()}</div>
            <div class="phone-wave">
              <svg width="200" height="60" viewBox="0 0 200 60" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="pw2" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#7B35DE" stop-opacity="0"/>
                    <stop offset="20%" stop-color="#7B35DE"/>
                    <stop offset="100%" stop-color="#E81F8C" stop-opacity="0.6"/>
                  </linearGradient>
                </defs>
                <path class="wave-path-b" d="M0,30 L20,30 L23,22 L27,30 L28,35 L31,10 L34,42 L37,30 L50,30 L55,30 L58,23 L61,30 L71,30 L74,14 L77,38 L80,30 L100,30 L103,22 L107,30 L108,35 L111,10 L114,42 L117,30 L130,30 L133,23 L136,30 L146,30 L149,14 L152,38 L155,30 L175,30 L178,22 L182,30 L183,35 L186,10 L189,42 L192,30 L200,30" stroke="url(#pw2)" stroke-width="1.8" fill="none" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="phone-bpm">68 <span>BPM</span></div>
            <div class="phone-status receiving">{m.moment_status_receiving()}</div>
          </div>
        </div>
      </div>
    </div>

    <p class="moment-desc">
      {m.moment_desc_line1()}<br />
      {m.moment_desc_line2()}
    </p>

    {#if data.loggedIn}
      <a href={ctaHref} class="btn-cta btn-centered">
        {m.moment_find_match()}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </a>
    {:else}
      <div style="display:flex;justify-content:center;">
        <WaitlistForm />
      </div>
    {/if}
  </section>

  <!-- ─── FOOTER ────────────────────────────────────── -->
  <footer class="footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <HeartLogo size={28} />
        <span>HeartBits</span>
      </div>
      <div class="footer-links">
        <a href="/about">{m.nav_about()}</a>
        <a href="/privacy">{m.nav_privacy()}</a>
        <a href="/terms">{m.nav_terms()}</a>
        <a href="/status">{m.nav_status()}</a>
        <a href="mailto:hello@what-if.io">{m.nav_contact()}</a>
        <LangSwitcher />
      </div>
      <div class="footer-copy">{m.footer_copyright()}</div>
    </div>
  </footer>
</div>

<style>
  /* ── LANDING WRAPPER ─────────────────────────────── */
  .landing {
    min-height: 100vh;
    overflow-x: hidden;
    position: relative;
  }
  .lang-top {
    position: absolute;
    top: 22px;
    right: 24px;
    z-index: 20;
  }

  /* ── HERO ────────────────────────────────────────── */
  .hero {
    position: relative;
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 120px 24px 100px;
  }

  .noise {
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.035'/%3E%3C/svg%3E");
    background-repeat: repeat;
    background-size: 256px 256px;
    pointer-events: none;
    z-index: 0;
  }

  .orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
    pointer-events: none;
    z-index: 0;
  }

  .orb-1 {
    width: 500px;
    height: 500px;
    background: radial-gradient(circle, rgba(255,107,107,0.12) 0%, transparent 70%);
    top: -100px;
    left: -150px;
  }

  .orb-2 {
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(123,53,222,0.14) 0%, transparent 70%);
    bottom: -50px;
    right: -80px;
  }

  .orb-3 {
    width: 300px;
    height: 300px;
    background: radial-gradient(circle, rgba(232,31,140,0.08) 0%, transparent 70%);
    top: 40%;
    left: 50%;
    transform: translateX(-50%);
  }

  .ecg-strip {
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    transform: translateY(-50%);
    opacity: 0.35;
    pointer-events: none;
    z-index: 1;
  }

  .ecg-strip canvas {
    display: block;
    width: 100%;
  }

  .hero-content {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0;
    opacity: 0;
    transform: translateY(24px);
    transition: opacity 0.8s ease, transform 0.8s ease;
  }

  .hero-content.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .logo-lockup {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 48px;
    opacity: 0.9;
  }

  .wordmark {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 18px;
    font-weight: 400;
    letter-spacing: 0.02em;
    color: rgba(255,255,255,0.85);
  }

  .headline {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: clamp(52px, 10vw, 108px);
    font-weight: 400;
    line-height: 1.0;
    letter-spacing: -0.02em;
    margin-bottom: 24px;
    color: rgba(255,255,255,0.95);
  }

  .headline em {
    font-style: italic;
  }

  .subline {
    font-size: clamp(15px, 2vw, 18px);
    font-weight: 300;
    color: rgba(255,255,255,0.45);
    line-height: 1.65;
    margin-bottom: 44px;
    max-width: 380px;
  }

  .cta-group {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 48px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .btn-cta {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 32px;
    background: linear-gradient(135deg, #FF6B6B, #E81F8C 50%, #7B35DE);
    border-radius: 100px;
    font-size: 16px;
    font-weight: 500;
    color: white;
    text-decoration: none;
    transition: opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
    box-shadow: 0 0 40px rgba(255,107,107,0.25), 0 4px 20px rgba(0,0,0,0.3);
    white-space: nowrap;
  }

  .btn-cta:hover {
    opacity: 0.92;
    transform: translateY(-1px);
    box-shadow: 0 0 60px rgba(255,107,107,0.35), 0 8px 30px rgba(0,0,0,0.4);
  }

  .btn-cta:active {
    transform: translateY(0);
  }

  .btn-centered {
    display: flex;
    margin: 0 auto;
    margin-top: 48px;
  }

  .btn-ghost {
    padding: 14px 24px;
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 100px;
    font-size: 15px;
    font-weight: 400;
    color: rgba(255,255,255,0.5);
    text-decoration: none;
    transition: border-color 0.2s ease, color 0.2s ease;
    white-space: nowrap;
  }

  .btn-ghost:hover {
    border-color: rgba(255,255,255,0.25);
    color: rgba(255,255,255,0.75);
  }

  .cta-stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    margin-bottom: 48px;
  }
  .cta-note {
    font-size: 13px;
    color: rgba(255,255,255,0.32);
    margin: 0;
  }
  .cta-secondary {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: 4px;
  }
  .link-soft {
    color: rgba(255,255,255,0.5);
    text-decoration: none;
    font-size: 15px;
    transition: color 0.2s ease;
  }
  .link-soft:hover { color: rgba(255,255,255,0.85); }
  .dot-sep { color: rgba(255,255,255,0.2); }

  .trust {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  .bpm-live {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255,107,107,0.9);
    font-variant-numeric: tabular-nums;
  }

  .dot-live {
    width: 7px;
    height: 7px;
    background: #FF6B6B;
    border-radius: 50%;
    animation: pulse-dot 1.2s ease-in-out infinite;
    box-shadow: 0 0 6px rgba(255,107,107,0.8);
  }

  @keyframes pulse-dot {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.4); opacity: 0.7; }
  }

  .trust-text {
    font-size: 12px;
    color: rgba(255,255,255,0.25);
    letter-spacing: 0.02em;
  }

  .scroll-hint {
    position: absolute;
    bottom: 32px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2;
    animation: scroll-bounce 2.5s ease-in-out infinite;
  }

  .scroll-dot {
    animation: scroll-drop 2.5s ease-in-out infinite;
  }

  @keyframes scroll-bounce {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.9; }
  }

  @keyframes scroll-drop {
    0% { cy: 8; opacity: 0.8; }
    60% { cy: 20; opacity: 0.2; }
    61% { cy: 8; opacity: 0; }
    62% { cy: 8; opacity: 0.8; }
    100% { cy: 8; opacity: 0.8; }
  }

  /* ── HOW IT WORKS ────────────────────────────────── */
  .how {
    padding: 120px 24px;
    max-width: 1000px;
    margin: 0 auto;
  }

  .section-label {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(255,107,107,0.7);
    margin-bottom: 16px;
  }

  .section-title {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: clamp(36px, 6vw, 64px);
    font-weight: 400;
    line-height: 1.1;
    letter-spacing: -0.02em;
    margin-bottom: 72px;
    color: rgba(255,255,255,0.92);
  }

  .section-title em {
    font-style: italic;
  }

  .steps {
    display: flex;
    align-items: center;
    gap: 0;
  }

  .step {
    flex: 1;
    padding: 40px 32px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 20px;
    transition: background 0.3s ease, border-color 0.3s ease;
  }

  .step:hover {
    background: rgba(255,255,255,0.05);
    border-color: rgba(255,107,107,0.15);
  }

  .step-connector {
    padding: 0 20px;
    flex-shrink: 0;
  }

  .step-icon {
    margin-bottom: 20px;
  }

  .step-num {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.15em;
    color: rgba(255,255,255,0.2);
    margin-bottom: 12px;
    font-variant-numeric: tabular-nums;
  }

  .step h3 {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 28px;
    font-weight: 400;
    margin-bottom: 14px;
    color: rgba(255,255,255,0.9);
  }

  .step p {
    font-size: 14px;
    font-weight: 300;
    line-height: 1.7;
    color: rgba(255,255,255,0.45);
  }

  /* ── THE MOMENT ──────────────────────────────────── */
  .moment {
    padding: 120px 24px;
    max-width: 1000px;
    margin: 0 auto;
    text-align: center;
  }

  .phones-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    margin: 72px 0;
    position: relative;
  }

  .phone {
    flex-shrink: 0;
  }

  .phone-left {
    transform: rotate(-4deg) translateX(20px);
    z-index: 1;
  }

  .phone-right {
    transform: rotate(4deg) translateX(-20px);
    z-index: 1;
  }

  .phone-shell {
    width: 180px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 28px;
    overflow: hidden;
    box-shadow:
      0 30px 80px rgba(0,0,0,0.5),
      inset 0 1px 0 rgba(255,255,255,0.06);
    padding: 16px 12px 20px;
  }

  .phone-notch {
    width: 60px;
    height: 10px;
    background: rgba(0,0,0,0.6);
    border-radius: 100px;
    margin: 0 auto 16px;
  }

  .phone-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    min-height: 200px;
  }

  .phone-name {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 18px;
    font-weight: 400;
    color: rgba(255,255,255,0.9);
  }

  .phone-sub {
    font-size: 11px;
    color: rgba(255,255,255,0.35);
    margin-bottom: 8px;
  }

  .phone-wave {
    width: 100%;
    overflow: hidden;
  }

  .phone-wave svg {
    width: 100%;
    height: 50px;
  }

  .wave-path-a {
    animation: wave-scroll 1.8s linear infinite;
  }

  .wave-path-b {
    animation: wave-scroll 2.1s linear infinite reverse;
  }

  @keyframes wave-scroll {
    from { stroke-dashoffset: 0; }
    to { stroke-dashoffset: -200; }
  }

  .phone-bpm {
    font-size: 28px;
    font-weight: 200;
    color: rgba(255,255,255,0.9);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }

  .phone-bpm span {
    font-size: 12px;
    font-weight: 400;
    color: rgba(255,255,255,0.35);
    margin-left: 2px;
  }

  .phone-status {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 4px 10px;
    border-radius: 100px;
    margin-top: 4px;
  }

  .phone-status.sending {
    background: rgba(255,107,107,0.15);
    color: rgba(255,107,107,0.9);
    animation: status-pulse 1.5s ease-in-out infinite;
  }

  .phone-status.receiving {
    background: rgba(123,53,222,0.15);
    color: rgba(123,53,222,0.9);
  }

  @keyframes status-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .center-pulse {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
    flex-shrink: 0;
    z-index: 2;
  }

  .center-pulse svg {
    position: relative;
    z-index: 1;
  }

  .pulse-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 1.5px solid rgba(232,31,140,0.4);
    animation: ring-expand 2s ease-out infinite;
  }

  .pulse-ring-2 {
    animation-delay: 0.66s;
  }

  .pulse-ring-3 {
    animation-delay: 1.33s;
  }

  @keyframes ring-expand {
    0% { transform: scale(0.5); opacity: 0.8; }
    100% { transform: scale(2.5); opacity: 0; }
  }

  .moment-desc {
    font-size: 16px;
    font-weight: 300;
    line-height: 1.8;
    color: rgba(255,255,255,0.45);
    max-width: 440px;
    margin: 0 auto;
  }

  /* ── FOOTER ──────────────────────────────────────── */
  .footer {
    border-top: 1px solid rgba(255,255,255,0.05);
    padding: 48px 24px;
  }

  .footer-inner {
    max-width: 1000px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 24px;
  }

  .footer-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 16px;
    color: rgba(255,255,255,0.6);
  }

  .footer-links {
    display: flex;
    align-items: center;
    gap: 24px;
  }

  .footer-links a {
    font-size: 13px;
    color: rgba(255,255,255,0.3);
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .footer-links a:hover {
    color: rgba(255,255,255,0.6);
  }

  .footer-copy {
    font-size: 12px;
    color: rgba(255,255,255,0.2);
  }

  /* ── MOBILE ──────────────────────────────────────── */
  @media (max-width: 768px) {
    .steps {
      flex-direction: column;
      gap: 16px;
    }

    .step-connector {
      padding: 0;
      transform: rotate(90deg);
    }

    .phones-wrap {
      flex-direction: column;
      gap: 24px;
    }

    .phone-left, .phone-right {
      transform: none;
    }

    .center-pulse {
      transform: rotate(90deg);
    }

    .footer-inner {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>

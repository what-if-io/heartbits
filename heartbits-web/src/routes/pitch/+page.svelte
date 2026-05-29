<script lang="ts">
  import { onMount } from 'svelte';
  import HeartLogo from '$lib/components/HeartLogo.svelte';

  let visible = $state(false);
  let activeSection = $state(0);

  const features = [
    {
      icon: '♥',
      title: 'Heartbeat Matching',
      desc: 'Your heart rate pattern is your fingerprint. We match people whose rhythms resonate — not just photos and bios.'
    },
    {
      icon: '⚡',
      title: 'Live ECG Bond',
      desc: 'Share a real-time heartbeat connection with someone you match. Watch your rhythms sync in the moment.'
    },
    {
      icon: '🔒',
      title: 'Privacy First',
      desc: 'Biometric data never leaves your device. You consent before any heartbeat is shared. Always.'
    },
    {
      icon: '📱',
      title: 'iOS · Android · Web',
      desc: 'Native Apple Watch + iPhone, Android watch + phone, and a full web experience. One app, every platform.'
    }
  ];

  const screens = [
    { label: 'Discover', desc: 'Swipe by heartbeat resonance', path: '/discover', color: '#FF6B6B' },
    { label: 'Bond', desc: 'Live shared ECG with your match', path: '/bond/ela', color: '#E81F8C' },
    { label: 'Matches', desc: 'Your connections, BPM-synced', path: '/matches', color: '#7B35DE' },
  ];

  onMount(() => {
    visible = true;
  });
</script>

<svelte:head>
  <title>HeartBits — Match by Heartbeat</title>
  <meta name="description" content="HeartBits is a dating app that uses real heartbeat data to match people whose rhythms resonate." />
</svelte:head>

<div class="pitch" class:visible>

  <!-- ── NOISE + ORBS ─────────────────────────────────────── -->
  <div class="noise" aria-hidden="true"></div>
  <div class="orb orb-1" aria-hidden="true"></div>
  <div class="orb orb-2" aria-hidden="true"></div>
  <div class="orb orb-3" aria-hidden="true"></div>

  <!-- ── HERO ─────────────────────────────────────────────── -->
  <section class="hero">
    <div class="hero-inner">
      <div class="brand">
        <HeartLogo size={52} animated={visible} />
        <span class="wordmark">HeartBits</span>
      </div>

      <h1 class="hero-headline">
        Dating that listens<br />
        to your <em class="grad">heart.</em>
      </h1>
      <p class="hero-sub">
        We match you with people whose heartbeat patterns naturally resonate with yours —
        not algorithms, not swipe counts. Your rhythm finds theirs.
      </p>

      <div class="hero-ctas">
        <a href="/auth/demo" class="cta-primary">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="7" stroke="white" stroke-width="1.4"/>
            <path d="M7 6.5L12 9L7 11.5V6.5Z" fill="white"/>
          </svg>
          Try the Demo
        </a>
        <a href="/auth/login" class="cta-secondary">Sign in</a>
      </div>

      <!-- Live ECG strip -->
      <div class="ecg-hero" aria-hidden="true">
        <svg viewBox="0 0 360 40" preserveAspectRatio="none" fill="none">
          <defs>
            <linearGradient id="ecg-grad" x1="0" y1="0" x2="360" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#FF6B6B" stop-opacity="0"/>
              <stop offset="20%" stop-color="#FF6B6B"/>
              <stop offset="50%" stop-color="#E81F8C"/>
              <stop offset="80%" stop-color="#7B35DE"/>
              <stop offset="100%" stop-color="#7B35DE" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <polyline
            points="0,20 30,20 38,14 42,20 44,24 48,6 52,32 56,20 80,20 110,20 118,14 122,20 124,24 128,6 132,32 136,20 160,20 190,20 198,14 202,20 204,24 208,6 212,32 216,20 240,20 270,20 278,14 282,20 284,24 288,6 292,32 296,20 320,20 360,20"
            stroke="url(#ecg-grad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            class="ecg-line"
          />
        </svg>
      </div>
    </div>
  </section>

  <!-- ── PROBLEM ───────────────────────────────────────────── -->
  <section class="section problem">
    <div class="section-inner">
      <div class="section-label">The Problem</div>
      <h2 class="section-title">Dating apps forgot what attraction actually is.</h2>
      <div class="problem-grid">
        <div class="problem-card">
          <span class="problem-icon">📊</span>
          <p>Algorithms optimise for <strong>engagement</strong>, not connection</p>
        </div>
        <div class="problem-card">
          <span class="problem-icon">🖼️</span>
          <p>Photo-first feeds reward appearance over <strong>chemistry</strong></p>
        </div>
        <div class="problem-card">
          <span class="problem-icon">😶</span>
          <p>Real attraction is <strong>felt</strong>, not clicked</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ── SOLUTION ──────────────────────────────────────────── -->
  <section class="section solution">
    <div class="section-inner">
      <div class="section-label">The Solution</div>
      <h2 class="section-title">Your heartbeat knows before you do.</h2>
      <p class="section-body">
        HeartBits uses your Apple Watch or Android wearable's optical heart rate sensor
        to capture your biometric rhythm. Our matching engine finds people whose patterns
        complement yours — statistically and physiologically.
      </p>
      <div class="bpm-demo" aria-hidden="true">
        <div class="bpm-row">
          <span class="bpm-dot" style="background:#FF6B6B"></span>
          <span class="bpm-name">You</span>
          <span class="bpm-val">72 BPM</span>
          <div class="bpm-bar"><div class="bpm-fill" style="width:72%;background:#FF6B6B"></div></div>
        </div>
        <div class="bpm-sync">❤ resonance detected</div>
        <div class="bpm-row">
          <span class="bpm-dot" style="background:#7B35DE"></span>
          <span class="bpm-name">Ela</span>
          <span class="bpm-val">71 BPM</span>
          <div class="bpm-bar"><div class="bpm-fill" style="width:71%;background:#7B35DE"></div></div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── FEATURES ──────────────────────────────────────────── -->
  <section class="section features">
    <div class="section-inner">
      <div class="section-label">Features</div>
      <h2 class="section-title">Everything a heart connection needs.</h2>
      <div class="features-grid">
        {#each features as f}
          <div class="feature-card">
            <span class="feature-icon">{f.icon}</span>
            <h3 class="feature-title">{f.title}</h3>
            <p class="feature-desc">{f.desc}</p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- ── SCREENS ───────────────────────────────────────────── -->
  <section class="section screens-section">
    <div class="section-inner">
      <div class="section-label">Try it live</div>
      <h2 class="section-title">See every screen in the demo.</h2>
      <div class="screens-row">
        {#each screens as s}
          <a href={s.path} class="screen-card" style="--c:{s.color}">
            <div class="screen-icon" style="color:{s.color}">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="1" y="1" width="26" height="26" rx="6" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.4"/>
                <path d="M14 21C14 21 7 17 7 12C7 9.79 8.79 8 11 8C12.24 8 13.34 8.57 14 9.5C14.66 8.57 15.76 8 17 8C19.21 8 21 9.79 21 12C21 17 14 21 14 21Z" fill="currentColor" fill-opacity="0.7"/>
              </svg>
            </div>
            <div>
              <div class="screen-name">{s.label}</div>
              <div class="screen-desc">{s.desc}</div>
            </div>
            <svg class="screen-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.4"/>
            </svg>
          </a>
        {/each}
      </div>
    </div>
  </section>

  <!-- ── CTA ───────────────────────────────────────────────── -->
  <section class="section cta-section">
    <div class="section-inner cta-inner">
      <HeartLogo size={40} animated={visible} />
      <h2 class="cta-headline">Ready to find your rhythm?</h2>
      <p class="cta-sub">Join the private preview. It's free.</p>
      <div class="hero-ctas">
        <a href="/auth/demo" class="cta-primary">
          Try Demo First
        </a>
        <a href="/auth/login" class="cta-secondary">Create Account</a>
      </div>
      <p class="cta-platforms">iOS · Android · Web · Apple Watch · Wear OS</p>
    </div>
  </section>

  <!-- ── FOOTER ────────────────────────────────────────────── -->
  <footer class="pitch-footer">
    <span>© 2026 HeartBits</span>
    <a href="/privacy">Privacy</a>
    <a href="/terms">Terms</a>
    <a href="/about">About</a>
  </footer>

</div>

<style>
  /* ── BASE ──────────────────────────────────────────────── */
  .pitch {
    min-height: 100svh;
    background: #070710;
    color: rgba(255,255,255,0.9);
    font-family: system-ui, sans-serif;
    position: relative;
    overflow: hidden;
    opacity: 0;
    transition: opacity 0.5s ease;
  }
  .pitch.visible { opacity: 1; }

  .noise {
    position: fixed; inset: 0; pointer-events: none; z-index: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E");
    background-size: 256px;
  }
  .orb { position: fixed; border-radius: 50%; filter: blur(90px); pointer-events: none; z-index: 0; }
  .orb-1 { width:700px; height:700px; background:radial-gradient(circle,rgba(255,107,107,0.07) 0%,transparent 70%); top:-250px; left:-250px; }
  .orb-2 { width:600px; height:600px; background:radial-gradient(circle,rgba(123,53,222,0.09) 0%,transparent 70%); bottom:-200px; right:-200px; }
  .orb-3 { width:400px; height:400px; background:radial-gradient(circle,rgba(232,31,140,0.06) 0%,transparent 70%); top:50%; left:50%; transform:translate(-50%,-50%); }

  /* ── SECTIONS ──────────────────────────────────────────── */
  .section { position: relative; z-index: 1; padding: 80px 24px; }
  .section-inner { max-width: 720px; margin: 0 auto; }
  .section-label {
    font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
    color: rgba(255,107,107,0.7); margin-bottom: 16px;
  }
  .section-title {
    font-size: clamp(28px,5vw,42px); font-weight: 600; line-height: 1.15;
    letter-spacing: -0.02em; margin-bottom: 20px;
  }
  .section-body { font-size: 16px; line-height: 1.75; color: rgba(255,255,255,0.55); }

  /* ── HERO ──────────────────────────────────────────────── */
  .hero { padding: 100px 24px 60px; }
  .hero-inner { max-width: 720px; margin: 0 auto; text-align: center; }
  .brand {
    display: inline-flex; align-items: center; gap: 12px;
    margin-bottom: 40px;
  }
  .wordmark {
    font-size: 20px; font-weight: 500; letter-spacing: 0.01em;
    color: rgba(255,255,255,0.85);
  }
  .hero-headline {
    font-size: clamp(40px,8vw,64px); font-weight: 700; line-height: 1.08;
    letter-spacing: -0.03em; margin-bottom: 20px;
  }
  .grad {
    background: linear-gradient(135deg,#ff6b6b,#e81f8c,#7b35de);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text; font-style: italic;
  }
  .hero-sub {
    font-size: 18px; line-height: 1.65; color: rgba(255,255,255,0.45);
    max-width: 540px; margin: 0 auto 40px;
  }
  .hero-ctas { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 48px; }

  .cta-primary {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 14px 28px; border-radius: 100px;
    background: linear-gradient(135deg,#ff6b6b,#e81f8c,#7b35de);
    color: white; font-size: 15px; font-weight: 600; text-decoration: none;
    transition: opacity 0.2s, transform 0.2s;
    box-shadow: 0 4px 24px rgba(255,107,107,0.25);
  }
  .cta-primary:hover { opacity: 0.88; transform: translateY(-1px); }

  .cta-secondary {
    display: inline-flex; align-items: center;
    padding: 14px 28px; border-radius: 100px;
    border: 1px solid rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.65); font-size: 15px; font-weight: 500;
    text-decoration: none; transition: border-color 0.2s, color 0.2s;
  }
  .cta-secondary:hover { border-color: rgba(255,255,255,0.3); color: white; }

  .ecg-hero { opacity: 0.25; width: 100%; }
  .ecg-hero svg { width: 100%; height: 40px; }
  .ecg-line {
    stroke-dasharray: 1000;
    animation: ecg-draw 3s ease-out forwards;
  }
  @keyframes ecg-draw {
    from { stroke-dashoffset: 1000; }
    to { stroke-dashoffset: 0; }
  }

  /* ── PROBLEM ───────────────────────────────────────────── */
  .problem-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap: 16px; margin-top: 32px; }
  .problem-card {
    padding: 24px; border-radius: 16px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
  }
  .problem-icon { font-size: 28px; display: block; margin-bottom: 12px; }
  .problem-card p { font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.5); }
  .problem-card strong { color: rgba(255,255,255,0.8); font-weight: 500; }

  /* ── SOLUTION ──────────────────────────────────────────── */
  .solution { background: rgba(255,107,107,0.025); }
  .bpm-demo {
    margin-top: 36px; padding: 24px; border-radius: 20px;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07);
    max-width: 420px;
  }
  .bpm-row { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
  .bpm-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .bpm-name { font-size: 14px; color: rgba(255,255,255,0.6); width: 36px; }
  .bpm-val { font-size: 13px; color: rgba(255,255,255,0.4); width: 56px; font-variant-numeric: tabular-nums; }
  .bpm-bar { flex: 1; height: 4px; background: rgba(255,255,255,0.07); border-radius: 4px; overflow: hidden; }
  .bpm-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }
  .bpm-sync {
    text-align: center; font-size: 12px; color: rgba(255,107,107,0.7);
    letter-spacing: 0.04em; padding: 8px 0; font-weight: 500;
  }

  /* ── FEATURES ──────────────────────────────────────────── */
  .features-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(260px,1fr)); gap: 16px; margin-top: 32px; }
  .feature-card {
    padding: 28px; border-radius: 20px;
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.06);
    transition: border-color 0.2s, background 0.2s;
  }
  .feature-card:hover { border-color: rgba(255,107,107,0.2); background: rgba(255,107,107,0.03); }
  .feature-icon { font-size: 24px; display: block; margin-bottom: 14px; }
  .feature-title { font-size: 16px; font-weight: 600; margin-bottom: 8px; }
  .feature-desc { font-size: 14px; line-height: 1.65; color: rgba(255,255,255,0.45); }

  /* ── SCREENS ───────────────────────────────────────────── */
  .screens-row { display: flex; flex-direction: column; gap: 12px; margin-top: 32px; }
  .screen-card {
    display: flex; align-items: center; gap: 16px; padding: 20px 24px;
    border-radius: 16px; border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.025); text-decoration: none;
    transition: border-color 0.2s, background 0.2s;
  }
  .screen-card:hover {
    border-color: color-mix(in srgb, var(--c) 40%, transparent);
    background: color-mix(in srgb, var(--c) 5%, transparent);
  }
  .screen-icon { flex-shrink: 0; }
  .screen-name { font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.9); margin-bottom: 2px; }
  .screen-desc { font-size: 13px; color: rgba(255,255,255,0.4); }
  .screen-arrow { margin-left: auto; flex-shrink: 0; color: rgba(255,255,255,0.5); }

  /* ── CTA SECTION ───────────────────────────────────────── */
  .cta-section { text-align: center; padding: 100px 24px; }
  .cta-inner { display: flex; flex-direction: column; align-items: center; gap: 16px; }
  .cta-headline { font-size: clamp(28px,5vw,40px); font-weight: 700; letter-spacing: -0.02em; }
  .cta-sub { font-size: 16px; color: rgba(255,255,255,0.4); }
  .cta-platforms { font-size: 12px; color: rgba(255,255,255,0.2); letter-spacing: 0.05em; margin-top: 8px; }

  /* ── FOOTER ────────────────────────────────────────────── */
  .pitch-footer {
    display: flex; align-items: center; justify-content: center;
    gap: 20px; padding: 24px; border-top: 1px solid rgba(255,255,255,0.05);
    font-size: 12px; color: rgba(255,255,255,0.2); position: relative; z-index: 1;
  }
  .pitch-footer a { color: rgba(255,255,255,0.2); text-decoration: none; transition: color 0.2s; }
  .pitch-footer a:hover { color: rgba(255,255,255,0.5); }

  @media (max-width: 480px) {
    .hero { padding: 80px 20px 40px; }
    .section { padding: 60px 20px; }
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import HeartLogo from '$lib/components/HeartLogo.svelte';
  import { m } from '$lib/paraglide/messages.js';
  import { localizeHref } from '$lib/paraglide/runtime';

  let visible = $state(false);

  onMount(() => { visible = true; });
</script>

<svelte:head>
  <title>{m.pitch_title()}</title>
  <meta name="description" content={m.pitch_meta_description()} />
</svelte:head>

<div class="pitch" class:visible>

  <div class="noise" aria-hidden="true"></div>
  <div class="orb orb-1" aria-hidden="true"></div>
  <div class="orb orb-2" aria-hidden="true"></div>
  <div class="orb orb-3" aria-hidden="true"></div>

  <!-- ── HERO ─────────────────────────────────────────────── -->
  <section class="hero">
    <div class="hero-inner">
      <div class="brand">
        <HeartLogo size={48} animated={visible} />
        <span class="wordmark">HeartBits</span>
      </div>

      <h1 class="hero-headline">
        {m.pitch_hero_headline_line1()}<br />
        {m.pitch_hero_headline_pre()}<em class="grad">{m.pitch_hero_headline_em()}</em>
      </h1>
      <p class="hero-sub">
        {m.pitch_hero_sub_line1()}<br />
        {m.pitch_hero_sub_line2()}
      </p>

      <div class="hero-ctas">
        <a href={localizeHref('/auth/demo')} class="cta-primary">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 3.5L12.5 8L6 12.5V3.5Z" fill="white"/>
          </svg>
          {m.pitch_try_demo()}
        </a>
        <a href={localizeHref('/')} class="cta-secondary">{m.pitch_join_waitlist()}</a>
      </div>

      <div class="ecg-hero" aria-hidden="true">
        <svg viewBox="0 0 360 48" preserveAspectRatio="none" fill="none">
          <defs>
            <linearGradient id="ecg-g" x1="0" y1="0" x2="360" y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#FF6B6B" stop-opacity="0"/>
              <stop offset="18%" stop-color="#FF6B6B"/>
              <stop offset="50%" stop-color="#E81F8C"/>
              <stop offset="82%" stop-color="#7B35DE"/>
              <stop offset="100%" stop-color="#7B35DE" stop-opacity="0"/>
            </linearGradient>
          </defs>
          <polyline
            points="0,24 28,24 36,16 40,24 42,28 46,4 50,38 54,24 78,24 106,24 114,16 118,24 120,28 124,4 128,38 132,24 156,24 184,24 192,16 196,24 198,28 202,4 206,38 210,24 234,24 262,24 270,16 274,24 276,28 280,4 284,38 288,24 312,24 360,24"
            stroke="url(#ecg-g)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
            class="ecg-line"
          />
        </svg>
      </div>
    </div>
  </section>

  <!-- ── PROBLEM ───────────────────────────────────────────── -->
  <section class="section problem">
    <div class="section-inner">
      <div class="section-label">{m.pitch_problem_label()}</div>
      <h2 class="section-title">{m.pitch_problem_title()}</h2>
      <div class="problem-grid">
        <div class="problem-card">
          <div class="prob-icon">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <rect x="2" y="12" width="4" height="8" rx="1" fill="currentColor" opacity="0.6"/>
              <rect x="8" y="8" width="4" height="12" rx="1" fill="currentColor" opacity="0.6"/>
              <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" opacity="0.9"/>
              <path d="M3 6L8 4L13 7L18 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity="0.4"/>
            </svg>
          </div>
          <p>{m.pitch_problem1_pre()}<strong>{m.pitch_problem1_strong()}</strong>{m.pitch_problem1_post()}</p>
        </div>
        <div class="problem-card">
          <div class="prob-icon">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <rect x="2" y="4" width="18" height="14" rx="2.5" stroke="currentColor" stroke-width="1.5" opacity="0.6"/>
              <circle cx="11" cy="11" r="3.5" stroke="currentColor" stroke-width="1.4" opacity="0.9"/>
              <circle cx="11" cy="11" r="1.2" fill="currentColor" opacity="0.6"/>
            </svg>
          </div>
          <p>{m.pitch_problem2_pre()}<strong>{m.pitch_problem2_strong()}</strong></p>
        </div>
        <div class="problem-card">
          <div class="prob-icon">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path d="M11 19C11 19 3 14.5 3 9C3 6.24 5.24 4 8 4C9.56 4 10.94 4.72 11.86 5.84" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.5"/>
              <path d="M11 19C11 19 19 14.5 19 9C19 6.24 16.76 4 14 4C12.44 4 11.06 4.72 10.14 5.84" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.9"/>
              <path d="M8 12L10 14L14 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>
            </svg>
          </div>
          <p>{m.pitch_problem3_pre()}<strong>{m.pitch_problem3_strong()}</strong>{m.pitch_problem3_post()}</p>
        </div>
      </div>
    </div>
  </section>

  <!-- ── SOLUTION ──────────────────────────────────────────── -->
  <section class="section solution">
    <div class="section-inner">
      <div class="section-label">{m.pitch_solution_label()}</div>
      <h2 class="section-title">{m.pitch_solution_title()}</h2>
      <p class="section-body">
        {m.pitch_solution_body()}
      </p>
      <div class="bpm-demo" aria-hidden="true">
        <div class="bpm-row">
          <span class="bpm-dot" style="background:#FF6B6B"></span>
          <span class="bpm-name">{m.pitch_bpm_you()}</span>
          <span class="bpm-val">72 BPM</span>
          <div class="bpm-bar"><div class="bpm-fill" style="width:72%;background:#FF6B6B"></div></div>
        </div>
        <div class="bpm-sync">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M7 12C7 12 1.5 8.5 1.5 5C1.5 3.07 3.07 1.5 5 1.5C5.95 1.5 6.81 1.87 7.44 2.5C8.07 1.87 8.93 1.5 9.88 1.5C11.81 1.5 13.38 3.07 13.38 5C13.38 8.5 7.88 12 7.88 12" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          {m.pitch_bpm_resonance()}
        </div>
        <div class="bpm-row">
          <span class="bpm-dot" style="background:#7B35DE"></span>
          <span class="bpm-name">{m.pitch_bpm_xin()}</span>
          <span class="bpm-val">71 BPM</span>
          <div class="bpm-bar"><div class="bpm-fill" style="width:71%;background:#7B35DE"></div></div>
        </div>
      </div>
    </div>
  </section>

  <!-- ── FEATURES ──────────────────────────────────────────── -->
  <section class="section features">
    <div class="section-inner">
      <div class="section-label">{m.pitch_features_label()}</div>
      <h2 class="section-title">{m.pitch_features_title()}</h2>
      <div class="features-grid">

        <div class="feature-card">
          <div class="feature-icon-wrap" style="--ic:#FF6B6B">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path d="M11 19C11 19 2 14 2 7.5C2 5.01 4.01 3 6.5 3C8.02 3 9.37 3.76 10.21 4.93" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              <path d="M11 19C11 19 20 14 20 7.5C20 5.01 17.99 3 15.5 3C13.98 3 12.63 3.76 11.79 4.93" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              <path d="M5 11H7L8.5 8L10 13L11.5 10L12.5 11H14" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h3 class="feature-title">{m.pitch_feature1_title()}</h3>
          <p class="feature-desc">{m.pitch_feature1_desc()}</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon-wrap" style="--ic:#E81F8C">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="8.5" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.3"/>
              <path d="M2 11H5L6.5 7L8.5 14.5L10 9L11.5 13L13 11H20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h3 class="feature-title">{m.pitch_feature2_title()}</h3>
          <p class="feature-desc">{m.pitch_feature2_desc()}</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon-wrap" style="--ic:#7B35DE">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <path d="M11 2L4 5V10.5C4 14.5 7 18.1 11 19.5C15 18.1 18 14.5 18 10.5V5L11 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
              <path d="M8 11L10 13L14 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h3 class="feature-title">{m.pitch_feature3_title()}</h3>
          <p class="feature-desc">{m.pitch_feature3_desc()}</p>
        </div>

        <div class="feature-card">
          <div class="feature-icon-wrap" style="--ic:#FF6B6B">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
              <rect x="6" y="1.5" width="10" height="16" rx="2" stroke="currentColor" stroke-width="1.5"/>
              <circle cx="11" cy="15.5" r="1" fill="currentColor" opacity="0.5"/>
              <rect x="9" y="20" width="4" height="0.1" rx="0.5" stroke="currentColor" stroke-width="1.5"/>
              <path d="M2 8H4M18 8H20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" opacity="0.4"/>
            </svg>
          </div>
          <h3 class="feature-title">{m.pitch_feature4_title()}</h3>
          <p class="feature-desc">{m.pitch_feature4_desc()}</p>
        </div>

      </div>
    </div>
  </section>

  <!-- ── LIVE SCREENS ──────────────────────────────────────── -->
  <section class="section screens-section">
    <div class="section-inner">
      <div class="section-label">{m.pitch_screens_label()}</div>
      <h2 class="section-title">{m.pitch_screens_title()}</h2>
      <div class="screens-row">
        {#each [
          { label: m.pitch_screen_discover_label(), desc: m.pitch_screen_discover_desc(), path: '/discover', color: '#FF6B6B',
            icon: `<path d="M11 18C11 18 3 13.5 3 8.5C3 6.02 5.02 4 7.5 4C8.95 4 10.23 4.68 11 5.73C11.77 4.68 13.05 4 14.5 4C16.98 4 19 6.02 19 8.5C19 13.5 11 18 11 18Z" stroke="currentColor" stroke-width="1.5" fill="none"/>` },
          { label: m.pitch_screen_bond_label(), desc: m.pitch_screen_bond_desc(), path: '/bond/ela', color: '#E81F8C',
            icon: `<circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="1.5" stroke-opacity="0.3"/><path d="M3 11H5.5L7 7.5L9 14L10.5 9.5L12 12.5L13 11H19" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>` },
          { label: m.pitch_screen_matches_label(), desc: m.pitch_screen_matches_desc(), path: '/matches', color: '#7B35DE',
            icon: `<path d="M3 17C3 15.34 4.34 14 6 14H16C17.66 14 19 15.34 19 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="11" cy="8" r="4" stroke="currentColor" stroke-width="1.5"/>` },
        ] as s}
          <a href={localizeHref(s.path)} class="screen-card" style="--c:{s.color}">
            <div class="screen-icon" style="color:{s.color}">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                {@html s.icon}
              </svg>
            </div>
            <div>
              <div class="screen-name">{s.label}</div>
              <div class="screen-desc">{s.desc}</div>
            </div>
            <svg class="screen-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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
      <h2 class="cta-headline">{m.pitch_cta_headline()}</h2>
      <p class="cta-sub">{m.pitch_cta_sub()}</p>
      <div class="hero-ctas">
        <a href={localizeHref('/auth/demo')} class="cta-primary">{m.pitch_cta_try_demo()}</a>
        <a href={localizeHref('/')} class="cta-secondary">{m.pitch_join_waitlist()}</a>
      </div>
      <p class="cta-platforms">{m.pitch_cta_platforms()}</p>
    </div>
  </section>

  <!-- ── FOOTER ────────────────────────────────────────────── -->
  <footer class="pitch-footer">
    <span>{m.pitch_footer_copyright()}</span>
    <a href={localizeHref('/privacy')}>{m.pitch_footer_privacy()}</a>
    <a href={localizeHref('/terms')}>{m.pitch_footer_terms()}</a>
    <a href={localizeHref('/about')}>{m.pitch_footer_about()}</a>
  </footer>

</div>

<style>
  .pitch {
    min-height: 100svh;
    background: #070710;
    color: rgba(255,255,255,0.9);
    font-family: system-ui, sans-serif;
    position: relative;
    overflow: hidden;
    opacity: 0;
    transition: opacity 0.45s ease;
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

  .section { position: relative; z-index: 1; padding: 80px 24px; }
  .section-inner { max-width: 720px; margin: 0 auto; }
  .section-label {
    font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
    color: rgba(255,107,107,0.65); margin-bottom: 16px;
  }
  .section-title {
    font-size: clamp(26px,5vw,40px); font-weight: 600; line-height: 1.15;
    letter-spacing: -0.02em; margin-bottom: 20px;
  }
  .section-body { font-size: 16px; line-height: 1.75; color: rgba(255,255,255,0.5); }

  /* HERO */
  .hero { padding: 96px 24px 56px; }
  .hero-inner { max-width: 720px; margin: 0 auto; text-align: center; }
  .brand {
    display: inline-flex; align-items: center; gap: 12px; margin-bottom: 36px;
  }
  .wordmark { font-size: 19px; font-weight: 500; letter-spacing: 0.01em; color: rgba(255,255,255,0.8); }
  .hero-headline {
    font-size: clamp(38px,8vw,62px); font-weight: 700; line-height: 1.08;
    letter-spacing: -0.03em; margin-bottom: 20px;
  }
  .grad {
    background: linear-gradient(135deg,#ff6b6b,#e81f8c,#7b35de);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text; font-style: italic;
  }
  .hero-sub {
    font-size: 17px; line-height: 1.65; color: rgba(255,255,255,0.4);
    max-width: 460px; margin: 0 auto 40px;
  }
  .hero-ctas { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-bottom: 48px; }

  .cta-primary {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 13px 26px; border-radius: 100px;
    background: linear-gradient(135deg,#ff6b6b,#e81f8c,#7b35de);
    color: white; font-size: 15px; font-weight: 600; text-decoration: none;
    transition: opacity 0.2s, transform 0.15s;
    box-shadow: 0 4px 20px rgba(255,107,107,0.22);
  }
  .cta-primary:hover { opacity: 0.88; transform: translateY(-1px); }

  .cta-secondary {
    display: inline-flex; align-items: center;
    padding: 13px 26px; border-radius: 100px;
    border: 1px solid rgba(255,255,255,0.12);
    color: rgba(255,255,255,0.6); font-size: 15px; font-weight: 500;
    text-decoration: none; transition: border-color 0.2s, color 0.2s;
  }
  .cta-secondary:hover { border-color: rgba(255,255,255,0.28); color: white; }

  .ecg-hero { opacity: 0.22; width: 100%; }
  .ecg-hero svg { width: 100%; height: 48px; }
  .ecg-line {
    stroke-dasharray: 1200;
    animation: ecg-draw 3.2s ease-out forwards;
  }
  @keyframes ecg-draw {
    from { stroke-dashoffset: 1200; }
    to   { stroke-dashoffset: 0;    }
  }

  /* PROBLEM */
  .problem-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap: 14px; margin-top: 32px; }
  .problem-card {
    padding: 22px; border-radius: 16px;
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.055);
  }
  .prob-icon {
    width: 40px; height: 40px; border-radius: 10px;
    background: rgba(255,255,255,0.05);
    display: flex; align-items: center; justify-content: center;
    color: rgba(255,255,255,0.55); margin-bottom: 14px;
  }
  .problem-card p { font-size: 14px; line-height: 1.6; color: rgba(255,255,255,0.45); }
  .problem-card strong { color: rgba(255,255,255,0.75); font-weight: 500; }

  /* SOLUTION */
  .solution { background: rgba(255,107,107,0.018); }
  .bpm-demo {
    margin-top: 36px; padding: 24px; border-radius: 18px;
    background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.065);
    max-width: 400px;
  }
  .bpm-row { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
  .bpm-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .bpm-name { font-size: 14px; color: rgba(255,255,255,0.55); width: 34px; }
  .bpm-val { font-size: 13px; color: rgba(255,255,255,0.35); width: 52px; font-variant-numeric: tabular-nums; }
  .bpm-bar { flex: 1; height: 3px; background: rgba(255,255,255,0.07); border-radius: 4px; overflow: hidden; }
  .bpm-fill { height: 100%; border-radius: 4px; }
  .bpm-sync {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    text-align: center; font-size: 11px; color: rgba(255,107,107,0.65);
    letter-spacing: 0.05em; padding: 10px 0; font-weight: 600; text-transform: uppercase;
  }

  /* FEATURES */
  .features-grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(260px,1fr)); gap: 14px; margin-top: 32px; }
  .feature-card {
    padding: 26px; border-radius: 18px;
    background: rgba(255,255,255,0.022);
    border: 1px solid rgba(255,255,255,0.055);
    transition: border-color 0.2s, background 0.2s;
  }
  .feature-card:hover {
    border-color: color-mix(in srgb, var(--ic, #ff6b6b) 35%, transparent);
    background: color-mix(in srgb, var(--ic, #ff6b6b) 4%, transparent);
  }
  .feature-icon-wrap {
    width: 44px; height: 44px; border-radius: 12px;
    background: color-mix(in srgb, var(--ic) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--ic) 20%, transparent);
    display: flex; align-items: center; justify-content: center;
    color: var(--ic); margin-bottom: 16px;
  }
  .feature-title { font-size: 15px; font-weight: 600; margin-bottom: 8px; color: rgba(255,255,255,0.9); }
  .feature-desc { font-size: 13.5px; line-height: 1.65; color: rgba(255,255,255,0.42); }

  /* SCREENS */
  .screens-row { display: flex; flex-direction: column; gap: 10px; margin-top: 32px; }
  .screen-card {
    display: flex; align-items: center; gap: 16px; padding: 18px 22px;
    border-radius: 14px; border: 1px solid rgba(255,255,255,0.065);
    background: rgba(255,255,255,0.022); text-decoration: none;
    transition: border-color 0.2s, background 0.2s;
  }
  .screen-card:hover {
    border-color: color-mix(in srgb, var(--c) 38%, transparent);
    background: color-mix(in srgb, var(--c) 5%, transparent);
  }
  .screen-icon { flex-shrink: 0; }
  .screen-name { font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.88); margin-bottom: 2px; }
  .screen-desc { font-size: 12.5px; color: rgba(255,255,255,0.38); }
  .screen-arrow { margin-left: auto; flex-shrink: 0; color: rgba(255,255,255,0.25); }

  /* CTA SECTION */
  .cta-section { text-align: center; padding: 96px 24px; }
  .cta-inner { display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .cta-headline { font-size: clamp(26px,5vw,38px); font-weight: 700; letter-spacing: -0.02em; }
  .cta-sub { font-size: 15px; color: rgba(255,255,255,0.38); }
  .cta-platforms { font-size: 11px; color: rgba(255,255,255,0.18); letter-spacing: 0.06em; margin-top: 6px; }

  /* FOOTER */
  .pitch-footer {
    display: flex; align-items: center; justify-content: center;
    gap: 20px; padding: 24px; border-top: 1px solid rgba(255,255,255,0.045);
    font-size: 12px; color: rgba(255,255,255,0.18); position: relative; z-index: 1;
  }
  .pitch-footer a { color: rgba(255,255,255,0.18); text-decoration: none; transition: color 0.2s; }
  .pitch-footer a:hover { color: rgba(255,255,255,0.45); }

  @media (max-width: 480px) {
    .hero { padding: 72px 20px 36px; }
    .section { padding: 60px 20px; }
  }
</style>

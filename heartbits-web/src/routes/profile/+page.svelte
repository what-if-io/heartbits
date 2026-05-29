<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import EcgWaveform from '$lib/components/EcgWaveform.svelte';
  import { consent, grantConsent, withdrawConsent } from '$lib/stores/consent';
  import type { LayoutData } from '../$types';

  let { data }: { data: LayoutData } = $props();

  const displayName = $derived(data.user?.name?.split(' ')[0] ?? 'You');
  const initial = $derived(displayName[0]?.toUpperCase() ?? 'Y');

  // ── PROFILE STATE ────────────────────────────────────────
  // Toggle is derived from consent store (writable — use $ prefix)
  let shareHeartbeat = $derived($consent.hasConsented);

  // Withdraw confirmation modal
  let showWithdrawConfirm = $state(false);
  let editMode = $state(false);
  let avatarVisible = $state(false);
  let statsVisible = $state(false);

  // Simulated live BPM
  let liveBpm = $state(72);
  let bpmInterval: ReturnType<typeof setInterval>;

  // Stats (glassmorphism cards)
  interface Stat {
    value: number | string;
    label: string;
    sub: string;
  }

  let stats: Stat[] = [
    { value: 2, label: 'Bonds', sub: 'mutual heartbeats' },
    { value: 14, label: 'Hearts sent', sub: 'signals shared' },
    { value: 9, label: 'Hearts received', sub: 'felt by others' },
  ];

  onMount(() => {
    // Stagger entrance animations
    setTimeout(() => { avatarVisible = true; }, 100);
    setTimeout(() => { statsVisible = true; }, 380);

    // BPM drift
    bpmInterval = setInterval(() => {
      liveBpm = Math.round(Math.max(60, Math.min(85, liveBpm + (Math.random() - 0.5) * 2.5)));
    }, 2200);
  });

  onDestroy(() => clearInterval(bpmInterval));
</script>

<svelte:head>
  <title>Profile — HeartBits</title>
  <meta name="description" content="Manage your HeartBits profile and heartbeat sharing settings." />
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="profile-page">
  <!-- Ambient orbs -->
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>

  <!-- Header -->
  <header class="page-header">
    <div class="header-inner">
      <h1 class="header-title-text">Profile</h1>
      <button
        class="edit-btn"
        onclick={() => editMode = !editMode}
        aria-label="Edit profile"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M11.5 2.5L13.5 4.5L5 13H3V11L11.5 2.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="none"/>
        </svg>
        <span>{editMode ? 'Done' : 'Edit'}</span>
      </button>
    </div>
  </header>

  <div class="profile-body">

    <!-- ── AVATAR SECTION ─────────────────── -->
    <div class="avatar-section" class:visible={avatarVisible}>
      <!-- Gradient ring -->
      <div class="avatar-ring-outer">
        <div class="avatar-ring-inner">
          <div class="avatar">
            <span>{initial}</span>
          </div>
        </div>
      </div>

      <!-- Name + age -->
      <div class="identity">
        <h2 class="name">
          {editMode ? 'Tap to edit' : displayName}
          {#if editMode}
            <span class="edit-hint">✎</span>
          {/if}
        </h2>
        <p class="tagline">Your heart is your identity.</p>
      </div>

      <!-- Live BPM -->
      <div class="live-bpm-pill">
        <span class="live-dot"></span>
        <span class="live-val">{liveBpm}</span>
        <span class="live-unit">BPM live</span>
      </div>

      <!-- Mini waveform -->
      <div class="avatar-wave">
        <EcgWaveform
          bpm={liveBpm}
          color="#FF6B6B"
          width={200}
          height={36}
          useGradient={true}
        />
      </div>
    </div>

    <!-- ── STATS ──────────────────────────── -->
    <div class="stats-grid" class:visible={statsVisible}>
      {#each stats as stat, i}
        <div class="stat-card" style="animation-delay: {i * 80}ms">
          <div class="stat-val grad-text">{stat.value}</div>
          <div class="stat-label">{stat.label}</div>
          <div class="stat-sub">{stat.sub}</div>
        </div>
      {/each}
    </div>

    <!-- ── SHARE HEARTBEAT TOGGLE ─────────── -->
    <div class="section-card">
      <div class="section-row">
        <div class="section-row-left">
          <div class="section-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 17C10 17 2 12 2 7C2 4.79 3.79 3 6 3C7.27 3 8.41 3.61 9.13 4.56C9.85 3.61 10.99 3 12.25 3C14.46 3 16.25 4.79 16.25 7C16.25 12 10 17 10 17Z" stroke="url(#tog)" stroke-width="1.5" fill="none"/>
              <defs>
                <linearGradient id="tog" x1="2" y1="3" x2="16.25" y2="17" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#FF6B6B"/>
                  <stop offset="1" stop-color="#7B35DE"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <p class="section-title-text">Share my heartbeat</p>
            <p class="section-desc">Let others feel your pulse while discovering</p>
          </div>
        </div>
        <!-- Toggle switch — wired to GDPR Art. 9 consent store -->
        <button
          class="toggle"
          class:on={shareHeartbeat}
          onclick={() => {
            if (shareHeartbeat) {
              // Turning OFF requires withdrawal confirmation
              showWithdrawConfirm = true;
            } else {
              // Turning ON grants consent
              grantConsent('1.0');
            }
          }}
          aria-label="Toggle heartbeat sharing"
          role="switch"
          aria-checked={shareHeartbeat}
        >
          <div class="toggle-thumb"></div>
        </button>
      </div>
    </div>

    <!-- ── GDPR / BIOMETRIC SECTION ───────── -->
    <div class="section-card gdpr-card">
      <div class="gdpr-header">
        <div class="shield-icon">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 2L4 5.5V11C4 15.05 7.09 18.82 11 20C14.91 18.82 18 15.05 18 11V5.5L11 2Z" stroke="url(#sg)" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
            <path d="M8 11L10 13L14 9" stroke="url(#sg)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <defs>
              <linearGradient id="sg" x1="4" y1="2" x2="18" y2="20" gradientUnits="userSpaceOnUse">
                <stop stop-color="#4ADE80"/>
                <stop offset="1" stop-color="#22C55E"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div>
          <p class="gdpr-title">Biometric data protected</p>
          <p class="gdpr-badge">GDPR Article 9</p>
        </div>
      </div>
      <p class="gdpr-body">
        Your heart rate data is classified as special category biometric data under GDPR Article 9. It is processed only with your explicit consent, never sold, and encrypted end-to-end.
      </p>
      <!-- Consent status pill -->
      {#if $consent.hasConsented && $consent.consentDate}
        <div class="consent-status">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="5" stroke="rgba(74,222,128,0.7)" stroke-width="1.2"/>
            <path d="M3.5 6L5 7.5L8.5 4" stroke="rgba(74,222,128,0.9)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>
            Consented v{$consent.version} · {new Date($consent.consentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
      {:else}
        <div class="consent-status consent-status-none">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="5" stroke="rgba(255,100,100,0.5)" stroke-width="1.2"/>
            <path d="M4 4L8 8M8 4L4 8" stroke="rgba(255,100,100,0.6)" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          <span>No consent given — heart rate sharing disabled</span>
        </div>
      {/if}
      <a href="/privacy" class="gdpr-link">
        Read our biometric data policy
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6H10M7 3L10 6L7 9" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </a>
    </div>

    <!-- ── WITHDRAW CONSENT CONFIRMATION MODAL ── -->
    {#if showWithdrawConfirm}
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
      <!-- svelte-ignore a11y_interactive_supports_focus -->
      <div
        class="withdraw-backdrop"
        onclick={() => showWithdrawConfirm = false}
        onkeydown={(e) => { if (e.key === 'Escape') showWithdrawConfirm = false; }}
        role="dialog"
        aria-modal="true"
        aria-label="Confirm consent withdrawal"
        tabindex="-1"
      >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="withdraw-panel" onclick={(e) => e.stopPropagation()}>
          <div class="withdraw-icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M14 3L5 7.5V14C5 19.3 8.86 24.27 14 26C19.14 24.27 23 19.3 23 14V7.5L14 3Z" stroke="url(#wg)" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
              <path d="M10 14L12.5 16.5L18 11" stroke="rgba(255,100,100,0.8)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0"/>
              <path d="M10 10L18 18M18 10L10 18" stroke="rgba(255,100,100,0.7)" stroke-width="1.6" stroke-linecap="round"/>
              <defs>
                <linearGradient id="wg" x1="5" y1="3" x2="23" y2="26" gradientUnits="userSpaceOnUse">
                  <stop stop-color="rgba(255,107,107,0.8)"/>
                  <stop offset="1" stop-color="rgba(232,31,140,0.6)"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h3 class="withdraw-title">Withdraw consent?</h3>
          <p class="withdraw-body">
            Withdrawing consent will <strong>immediately stop heart rate sharing</strong> with all your matches.
            You can re-enable it at any time.
          </p>
          <div class="withdraw-actions">
            <button
              class="withdraw-cancel"
              onclick={() => showWithdrawConfirm = false}
            >
              Keep sharing
            </button>
            <button
              class="withdraw-confirm"
              onclick={() => { withdrawConsent(); showWithdrawConfirm = false; }}
            >
              Withdraw consent
            </button>
          </div>
        </div>
      </div>
    {/if}

    <!-- ── ACCOUNT ACTIONS ────────────────── -->
    <div class="section-card">
      <div class="action-list">
        <button class="action-row">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="6" r="3.5" stroke="currentColor" stroke-width="1.3"/>
            <path d="M2 16C2 13.24 5.13 11 9 11C12.87 11 16 13.24 16 16" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          <span>Edit profile</span>
          <svg class="row-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </button>
        <div class="action-divider"></div>
        <button class="action-row">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 3C9 3 3 6 3 11C3 13.76 5.24 16 8 16H10C12.76 16 15 13.76 15 11C15 6 9 3 9 3Z" stroke="currentColor" stroke-width="1.3" fill="none"/>
            <path d="M9 7V11M9 13V13.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>Notifications</span>
          <svg class="row-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </button>
        <div class="action-divider"></div>
        <button class="action-row danger-row">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M6 3H12M3 5H15L14 16H4L3 5Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="none"/>
          </svg>
          <span>Delete account</span>
          <svg class="row-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <p class="version-note">HeartBits v0.1.0 · Built with ♥</p>
  </div>
</div>

<BottomNav />

<style>
  /* ── PAGE ─────────────────────────────────────────── */
  .profile-page {
    min-height: 100svh;
    padding-bottom: calc(var(--nav-h, 72px) + 24px);
    position: relative;
    overflow-x: hidden;
  }

  .orb {
    position: fixed;
    border-radius: 50%;
    filter: blur(100px);
    pointer-events: none;
    z-index: 0;
  }

  .orb-1 {
    width: 400px;
    height: 400px;
    background: radial-gradient(circle, rgba(255,107,107,0.08) 0%, transparent 70%);
    top: -80px;
    left: -100px;
  }

  .orb-2 {
    width: 350px;
    height: 350px;
    background: radial-gradient(circle, rgba(123,53,222,0.08) 0%, transparent 70%);
    bottom: 100px;
    right: -60px;
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
    max-width: 480px;
    margin: 0 auto;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header-title-text {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 22px;
    font-weight: 400;
    color: rgba(255,255,255,0.9);
  }

  .edit-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 400;
    color: rgba(255,255,255,0.4);
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 100px;
    padding: 6px 14px;
    cursor: pointer;
    transition: color 0.2s ease, background 0.2s ease;
  }

  .edit-btn:hover {
    color: rgba(255,255,255,0.75);
    background: rgba(255,255,255,0.08);
  }

  /* ── BODY ─────────────────────────────────────────── */
  .profile-body {
    max-width: 480px;
    margin: 0 auto;
    padding: 32px 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: relative;
    z-index: 1;
  }

  /* ── AVATAR SECTION ──────────────────────────────── */
  .avatar-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.6s ease, transform 0.6s ease;
    margin-bottom: 8px;
  }

  .avatar-section.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .avatar-ring-outer {
    width: 186px;
    height: 186px;
    border-radius: 50%;
    padding: 3px;
    background: conic-gradient(
      from 0deg,
      #FF6B6B 0deg,
      #E81F8C 120deg,
      #7B35DE 240deg,
      #FF6B6B 360deg
    );
    animation: ring-rotate 6s linear infinite;
    position: relative;
  }

  .avatar-ring-outer::after {
    content: '';
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(232,31,140,0.2) 0%, transparent 70%);
    animation: ring-glow 2s ease-in-out infinite;
  }

  @keyframes ring-rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes ring-glow {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 1; }
  }

  .avatar-ring-inner {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: #070710;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: linear-gradient(145deg, rgba(255,107,107,0.18), rgba(123,53,222,0.35));
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar span {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 72px;
    font-weight: 400;
    background: linear-gradient(135deg, #FF6B6B, #E81F8C 50%, #7B35DE);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    line-height: 1;
    margin-top: 4px;
  }

  .identity {
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .name {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 32px;
    font-weight: 400;
    color: rgba(255,255,255,0.92);
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: center;
  }

  .edit-hint {
    font-size: 18px;
    color: rgba(255,255,255,0.25);
    font-style: normal;
  }

  .tagline {
    font-size: 14px;
    font-weight: 300;
    color: rgba(255,255,255,0.28);
    font-style: italic;
  }

  /* Live BPM pill */
  .live-bpm-pill {
    display: flex;
    align-items: center;
    gap: 7px;
    background: rgba(255,107,107,0.08);
    border: 1px solid rgba(255,107,107,0.2);
    border-radius: 100px;
    padding: 6px 14px;
    font-size: 13px;
  }

  .live-dot {
    width: 6px;
    height: 6px;
    background: #FF6B6B;
    border-radius: 50%;
    box-shadow: 0 0 6px rgba(255,107,107,0.8);
    animation: dot-pulse 1.1s ease-in-out infinite;
    flex-shrink: 0;
  }

  @keyframes dot-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.5); opacity: 0.7; }
  }

  .live-val {
    font-size: 16px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    color: rgba(255,107,107,0.9);
  }

  .live-unit {
    font-size: 11px;
    font-weight: 400;
    color: rgba(255,255,255,0.3);
    letter-spacing: 0.04em;
  }

  /* Avatar waveform */
  .avatar-wave {
    opacity: 0.7;
  }

  /* ── STATS GRID ──────────────────────────────────── */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    opacity: 0;
    transform: translateY(14px);
    transition: opacity 0.5s ease, transform 0.5s ease;
  }

  .stats-grid.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .stat-card {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px;
    padding: 18px 12px;
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 4px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    opacity: 0;
    animation: stat-appear 0.4s ease forwards;
    transition: background 0.2s ease, border-color 0.2s ease;
  }

  .stat-card:hover {
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,107,107,0.15);
  }

  @keyframes stat-appear {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .stats-grid.visible .stat-card {
    animation: stat-appear 0.4s ease forwards;
  }

  .stat-val {
    font-size: 30px;
    font-weight: 200;
    font-variant-numeric: tabular-nums;
    line-height: 1;
  }

  .stat-label {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    color: rgba(255,255,255,0.6);
  }

  .stat-sub {
    font-size: 9px;
    font-weight: 400;
    color: rgba(255,255,255,0.2);
    letter-spacing: 0.03em;
  }

  .grad-text {
    background: var(--grad-text, linear-gradient(90deg, #FF6B6B, #E81F8C 40%, #7B35DE));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* ── SECTION CARDS ──────────────────────────────── */
  .section-card {
    background: rgba(255,255,255,0.035);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 18px;
    padding: 18px 18px;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .section-row {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .section-row-left {
    display: flex;
    align-items: center;
    gap: 14px;
    flex: 1;
    min-width: 0;
  }

  .section-icon {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .section-title-text {
    font-size: 14px;
    font-weight: 500;
    color: rgba(255,255,255,0.82);
    margin-bottom: 3px;
  }

  .section-desc {
    font-size: 11px;
    font-weight: 300;
    color: rgba(255,255,255,0.28);
  }

  /* ── TOGGLE ──────────────────────────────────────── */
  .toggle {
    width: 48px;
    height: 27px;
    border-radius: 100px;
    background: rgba(255,255,255,0.1);
    border: 1.5px solid rgba(255,255,255,0.1);
    position: relative;
    cursor: pointer;
    transition: background 0.25s ease, border-color 0.25s ease;
    flex-shrink: 0;
  }

  .toggle.on {
    background: linear-gradient(90deg, #FF6B6B, #E81F8C);
    border-color: transparent;
    box-shadow: 0 0 16px rgba(232,31,140,0.35);
  }

  .toggle-thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 19px;
    height: 19px;
    border-radius: 50%;
    background: rgba(255,255,255,0.7);
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.25s ease;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  }

  .toggle.on .toggle-thumb {
    transform: translateX(21px);
    background: white;
  }

  /* ── GDPR CARD ──────────────────────────────────── */
  .gdpr-card {
    border-color: rgba(74,222,128,0.1);
    background: rgba(74,222,128,0.03);
  }

  .gdpr-header {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
  }

  .shield-icon {
    width: 38px;
    height: 38px;
    border-radius: 12px;
    background: rgba(74,222,128,0.08);
    border: 1px solid rgba(74,222,128,0.15);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .gdpr-title {
    font-size: 14px;
    font-weight: 500;
    color: rgba(255,255,255,0.82);
    margin-bottom: 4px;
  }

  .gdpr-badge {
    display: inline-block;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(74,222,128,0.85);
    background: rgba(74,222,128,0.1);
    border: 1px solid rgba(74,222,128,0.2);
    border-radius: 100px;
    padding: 2px 8px;
  }

  .gdpr-body {
    font-size: 12px;
    font-weight: 300;
    line-height: 1.7;
    color: rgba(255,255,255,0.35);
    margin-bottom: 12px;
  }

  .gdpr-link {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 500;
    color: rgba(74,222,128,0.7);
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .gdpr-link:hover {
    color: rgba(74,222,128,0.95);
  }

  /* ── ACTION LIST ─────────────────────────────────── */
  .action-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .action-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(255,255,255,0.6);
    font-family: inherit;
    font-size: 14px;
    font-weight: 400;
    width: 100%;
    text-align: left;
    transition: color 0.2s ease;
  }

  .action-row:hover {
    color: rgba(255,255,255,0.88);
  }

  .action-row svg:first-child {
    flex-shrink: 0;
    color: rgba(255,255,255,0.35);
  }

  .action-row span {
    flex: 1;
  }

  .row-arrow {
    color: rgba(255,255,255,0.2);
    transition: transform 0.2s ease;
    flex-shrink: 0;
  }

  .action-row:hover .row-arrow {
    transform: translateX(2px);
    color: rgba(255,255,255,0.4);
  }

  .danger-row {
    color: rgba(255,100,100,0.6);
  }

  .danger-row:hover {
    color: rgba(255,100,100,0.9);
  }

  .action-divider {
    height: 1px;
    background: rgba(255,255,255,0.05);
    margin: 0 0;
  }

  /* ── VERSION NOTE ────────────────────────────────── */
  .version-note {
    text-align: center;
    font-size: 11px;
    color: rgba(255,255,255,0.14);
    padding: 8px;
    letter-spacing: 0.03em;
  }

  /* ── CONSENT STATUS ──────────────────────────────── */
  .consent-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 400;
    color: rgba(74, 222, 128, 0.75);
    padding: 6px 10px;
    background: rgba(74, 222, 128, 0.06);
    border: 1px solid rgba(74, 222, 128, 0.12);
    border-radius: 100px;
    width: fit-content;
    letter-spacing: 0.02em;
  }

  .consent-status-none {
    color: rgba(255, 100, 100, 0.65);
    background: rgba(255, 100, 100, 0.05);
    border-color: rgba(255, 100, 100, 0.12);
  }

  /* ── WITHDRAW CONFIRMATION MODAL ─────────────────── */
  .withdraw-backdrop {
    position: fixed;
    inset: 0;
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: rgba(7, 7, 16, 0.8);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    animation: wdl-fade 0.2s ease forwards;
  }

  @keyframes wdl-fade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .withdraw-panel {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 20px;
    padding: 28px 24px 24px;
    max-width: 360px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 14px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
    animation: wdl-slide 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes wdl-slide {
    from { opacity: 0; transform: translateY(16px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }

  .withdraw-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 16px;
    background: rgba(255, 100, 100, 0.07);
    border: 1px solid rgba(255, 100, 100, 0.15);
    margin: 0 auto;
  }

  .withdraw-title {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 22px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.9);
    text-align: center;
  }

  .withdraw-body {
    font-size: 13px;
    font-weight: 300;
    line-height: 1.65;
    color: rgba(255, 255, 255, 0.45);
    text-align: center;
  }

  .withdraw-body strong {
    color: rgba(255, 255, 255, 0.75);
    font-weight: 500;
  }

  .withdraw-actions {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }

  .withdraw-cancel {
    flex: 1;
    padding: 12px;
    border-radius: 100px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.65);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .withdraw-cancel:hover {
    background: rgba(255, 255, 255, 0.09);
    color: rgba(255, 255, 255, 0.85);
  }

  .withdraw-confirm {
    flex: 1;
    padding: 12px;
    border-radius: 100px;
    background: rgba(255, 80, 80, 0.12);
    border: 1px solid rgba(255, 80, 80, 0.22);
    font-family: 'DM Sans', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: rgba(255, 100, 100, 0.85);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }

  .withdraw-confirm:hover {
    background: rgba(255, 80, 80, 0.2);
    border-color: rgba(255, 80, 80, 0.35);
    color: rgba(255, 120, 120, 1);
  }
</style>

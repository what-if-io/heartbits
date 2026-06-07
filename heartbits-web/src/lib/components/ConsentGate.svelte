<script lang="ts">
  import HeartLogo from '$lib/components/HeartLogo.svelte';
  import { m } from '$lib/paraglide/messages.js';

  let { onConsent, onDecline }: { onConsent: () => void; onDecline: () => void } = $props();

  let checkedBiometric = $state(false);
  let checkedAge = $state(false);

  let canConsent = $derived(checkedBiometric && checkedAge);

  // Prevent dismissal by Escape or outside clicks — this is a mandatory legal gate
  function blockKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function blockBackdropClick(e: MouseEvent) {
    // Intentionally empty — do NOT dismiss on backdrop click
    e.stopPropagation();
  }

  function handleConsent() {
    if (!canConsent) return;
    onConsent();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<!-- svelte-ignore a11y_interactive_supports_focus -->
<div
  class="gate-backdrop"
  onclick={blockBackdropClick}
  onkeydown={blockKeydown}
  role="dialog"
  aria-modal="true"
  aria-label={m.consent_panel_aria()}
  tabindex="-1"
>
  <div class="gate-panel">
    <!-- Background texture -->
    <div class="panel-noise" aria-hidden="true"></div>
    <!-- Radial glow behind logo -->
    <div class="panel-glow" aria-hidden="true"></div>

    <!-- ── LOGO ─────────────────────────────────── -->
    <div class="logo-row">
      <HeartLogo size={44} animated={true} />
      <span class="wordmark">HeartBits</span>
    </div>

    <!-- ── HEADING ──────────────────────────────── -->
    <h1 class="heading grad-text">{m.consent_heading()}</h1>

    <!-- ── BODY COPY ─────────────────────────────── -->
    <div class="body-copy">
      <p>
        {m.consent_body_intro_pre()}<strong>{m.consent_body_intro_strong()}</strong>{m.consent_body_intro_post()}
      </p>
      <p>{m.consent_body_explicit_pre()}<strong>{m.consent_body_explicit_strong()}</strong>{m.consent_body_explicit_post()}</p>
      <ul>
        <li>{m.consent_bullet_measure()}</li>
        <li>{m.consent_bullet_transmit()}</li>
        <li>{m.consent_bullet_store()}</li>
      </ul>
      <p class="withdrawal-note">
        {m.consent_withdrawal_pre()}<strong>{m.consent_withdrawal_strong()}</strong>{m.consent_withdrawal_post()}
      </p>
    </div>

    <!-- ── CHECKBOXES ───────────────────────────── -->
    <div class="checkboxes">
      <!-- Checkbox 1 — biometric consent -->
      <label class="check-label">
        <div class="check-box-wrap">
          <input
            type="checkbox"
            bind:checked={checkedBiometric}
            aria-label={m.consent_check_biometric_aria()}
          />
          <div class="check-box" class:checked={checkedBiometric} aria-hidden="true">
            {#if checkedBiometric}
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                <path d="M1 5L4.5 8.5L11 1" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            {/if}
          </div>
        </div>
        <span>
          {m.consent_check_biometric()}
        </span>
      </label>

      <!-- Checkbox 2 — age + privacy policy -->
      <label class="check-label">
        <div class="check-box-wrap">
          <input
            type="checkbox"
            bind:checked={checkedAge}
            aria-label={m.consent_check_age_aria()}
          />
          <div class="check-box" class:checked={checkedAge} aria-hidden="true">
            {#if checkedAge}
              <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                <path d="M1 5L4.5 8.5L11 1" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            {/if}
          </div>
        </div>
        <span>
          {m.consent_check_age_pre()}<a href="/privacy" onclick={(e) => e.stopPropagation()} target="_blank" rel="noopener">{m.consent_check_age_link()}</a>.
        </span>
      </label>
    </div>

    <!-- ── PRIMARY BUTTON ───────────────────────── -->
    <button
      class="btn-consent"
      class:disabled={!canConsent}
      onclick={handleConsent}
      disabled={!canConsent}
      aria-disabled={!canConsent}
    >
      {m.consent_accept()}
    </button>

    <!-- ── DECLINE LINK ─────────────────────────── -->
    <button class="btn-decline" onclick={onDecline}>
      {m.consent_decline()}
    </button>

    <!-- ── VERSION ──────────────────────────────── -->
    <p class="version-line">{m.consent_version_line()}</p>
  </div>
</div>

<style>
  /* ── BACKDROP ──────────────────────────────────────── */
  .gate-backdrop {
    position: fixed;
    inset: 0;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(7, 7, 16, 0.88);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    animation: gate-fade-in 0.4s ease forwards;
    overflow-y: auto;
  }

  @keyframes gate-fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* ── PANEL ─────────────────────────────────────────── */
  .gate-panel {
    position: relative;
    width: 100%;
    max-width: 480px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    padding: 36px 32px 28px;
    display: flex;
    flex-direction: column;
    gap: 22px;
    box-shadow:
      0 0 0 1px rgba(232, 31, 140, 0.08),
      0 32px 80px rgba(0, 0, 0, 0.7),
      0 8px 32px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.07);
    animation: panel-slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    overflow: hidden;
  }

  @keyframes panel-slide-up {
    from {
      opacity: 0;
      transform: translateY(24px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Subtle noise texture */
  .panel-noise {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.035'/%3E%3C/svg%3E");
    pointer-events: none;
    opacity: 0.6;
    z-index: 0;
  }

  /* Radial coral glow behind logo area */
  .panel-glow {
    position: absolute;
    top: -60px;
    left: 50%;
    transform: translateX(-50%);
    width: 300px;
    height: 200px;
    background: radial-gradient(ellipse 60% 50% at 50% 50%, rgba(232, 31, 140, 0.12) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  /* All direct children above noise/glow layers */
  .gate-panel > * {
    position: relative;
    z-index: 1;
  }

  /* ── LOGO ROW ──────────────────────────────────────── */
  .logo-row {
    display: flex;
    align-items: center;
    gap: 10px;
    justify-content: center;
  }

  .wordmark {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 22px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.9);
    letter-spacing: -0.01em;
  }

  /* ── HEADING ───────────────────────────────────────── */
  .heading {
    font-family: 'DM Serif Display', Georgia, serif;
    font-style: italic;
    font-size: clamp(30px, 6vw, 42px);
    font-weight: 400;
    line-height: 1.15;
    text-align: center;
    letter-spacing: -0.02em;
  }

  .grad-text {
    background: var(--grad-text, linear-gradient(90deg, #FF6B6B, #E81F8C 40%, #7B35DE));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  /* ── BODY COPY ─────────────────────────────────────── */
  .body-copy {
    display: flex;
    flex-direction: column;
    gap: 10px;
    font-size: 13.5px;
    font-weight: 300;
    line-height: 1.65;
    color: rgba(255, 255, 255, 0.55);
  }

  .body-copy strong {
    color: rgba(255, 255, 255, 0.82);
    font-weight: 500;
  }

  .body-copy ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .body-copy ul li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding-left: 2px;
  }

  .body-copy ul li::before {
    content: '';
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: linear-gradient(135deg, #FF6B6B, #E81F8C);
    flex-shrink: 0;
    margin-top: 7px;
  }

  .withdrawal-note {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.35);
    font-style: italic;
    padding-top: 2px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  /* ── CHECKBOXES ────────────────────────────────────── */
  .checkboxes {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .check-label {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 400;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.72);
    -webkit-user-select: none;
    user-select: none;
  }

  .check-label:hover {
    color: rgba(255, 255, 255, 0.9);
  }

  .check-label a {
    color: rgba(255, 107, 107, 0.85);
    text-decoration: underline;
    text-decoration-color: rgba(255, 107, 107, 0.35);
    text-underline-offset: 2px;
    transition: color 0.15s ease;
  }

  .check-label a:hover {
    color: #FF6B6B;
  }

  .check-box-wrap {
    position: relative;
    flex-shrink: 0;
    margin-top: 1px;
    width: 20px;
    height: 20px;
  }

  /* Hide native checkbox visually but keep it accessible */
  .check-box-wrap input[type='checkbox'] {
    position: absolute;
    inset: 0;
    opacity: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    cursor: pointer;
    z-index: 1;
  }

  .check-box {
    width: 20px;
    height: 20px;
    border-radius: 6px;
    border: 1.5px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.04);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
    pointer-events: none;
  }

  .check-box.checked {
    background: linear-gradient(135deg, #FF6B6B, #E81F8C);
    border-color: transparent;
    box-shadow: 0 0 12px rgba(232, 31, 140, 0.4);
  }

  .check-box-wrap input:focus-visible ~ .check-box {
    outline: 2px solid rgba(255, 107, 107, 0.6);
    outline-offset: 2px;
  }

  /* ── PRIMARY CONSENT BUTTON ────────────────────────── */
  .btn-consent {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 15px 24px;
    border-radius: 100px;
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 0.01em;
    color: white;
    background: linear-gradient(135deg, #FF6B6B, #E81F8C 50%, #7B35DE);
    border: none;
    cursor: pointer;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    box-shadow:
      0 0 40px rgba(232, 31, 140, 0.25),
      0 8px 24px rgba(0, 0, 0, 0.35);
  }

  .btn-consent:not(.disabled):hover {
    transform: translateY(-1px);
    box-shadow:
      0 0 56px rgba(232, 31, 140, 0.4),
      0 12px 32px rgba(0, 0, 0, 0.45);
  }

  .btn-consent:not(.disabled):active {
    transform: translateY(0) scale(0.98);
  }

  .btn-consent.disabled,
  .btn-consent:disabled {
    opacity: 0.35;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: none;
  }

  /* ── DECLINE LINK ──────────────────────────────────── */
  .btn-decline {
    background: none;
    border: none;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 12.5px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.3);
    text-align: center;
    padding: 4px 8px;
    line-height: 1.5;
    transition: color 0.15s ease;
    text-decoration: underline;
    text-decoration-color: rgba(255, 255, 255, 0.12);
    text-underline-offset: 2px;
  }

  .btn-decline:hover {
    color: rgba(255, 255, 255, 0.55);
    text-decoration-color: rgba(255, 255, 255, 0.3);
  }

  /* ── VERSION FOOTER ────────────────────────────────── */
  .version-line {
    text-align: center;
    font-size: 10px;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.18);
    letter-spacing: 0.05em;
  }

  /* ── MOBILE ────────────────────────────────────────── */
  @media (max-width: 375px) {
    .gate-panel {
      padding: 28px 20px 24px;
      gap: 18px;
    }

    .body-copy {
      font-size: 13px;
    }

    .check-label {
      font-size: 12.5px;
    }

    .btn-consent {
      font-size: 14px;
      padding: 14px 20px;
    }
  }
</style>

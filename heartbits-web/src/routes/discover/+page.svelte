<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import EcgWaveform from '$lib/components/EcgWaveform.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';

  interface Person {
    name: string;
    age: number;
    distance: string;
    bpm: number;
    color: string;
  }

  const people: Person[] = [
    { name: 'Ela',  age: 28, distance: '2 km away', bpm: 72, color: '#FF6B6B' },
    { name: 'Mia',  age: 31, distance: '5 km away', bpm: 65, color: '#7B35DE' },
    { name: 'Zara', age: 26, distance: '1 km away', bpm: 80, color: '#E81F8C' },
    { name: 'Lena', age: 29, distance: '8 km away', bpm: 58, color: '#FF8C42' },
    { name: 'Kai',  age: 33, distance: '12 km away', bpm: 76, color: '#5B8FE8' },
  ];

  let currentIndex = $state(0);
  let transitioning = $state(false);
  let sendingHeart = $state(false);
  let sonarActive = $state(false);
  let outOfPeople = $state(false);
  let direction = $state<'pass' | 'heart' | null>(null);

  let person = $derived(people[currentIndex]);

  // Generate initials-based gradient avatar color
  function avatarGradient(p: Person): string {
    return `linear-gradient(135deg, ${p.color}40, ${p.color}90)`;
  }

  function avatarInitial(p: Person): string {
    return p.name[0];
  }

  async function pass() {
    if (transitioning || outOfPeople) return;
    direction = 'pass';
    transitioning = true;
    await delay(400);
    advance();
  }

  async function sendHeart() {
    if (transitioning || outOfPeople) return;
    sendingHeart = true;
    sonarActive = true;
    direction = 'heart';
    await delay(800);
    sonarActive = false;
    sendingHeart = false;
    transitioning = true;
    await delay(300);
    advance();
  }

  function advance() {
    if (currentIndex >= people.length - 1) {
      outOfPeople = true;
    } else {
      currentIndex++;
    }
    transitioning = false;
    direction = null;
  }

  function delay(ms: number) {
    return new Promise(r => setTimeout(r, ms));
  }

  // Keyboard navigation
  function handleKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') pass();
    if (e.key === 'ArrowRight') sendHeart();
  }

  onMount(() => {
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });
</script>

<svelte:head>
  <title>Discover — HeartBits</title>
</svelte:head>

<div class="discover-page">
  {#if outOfPeople}
    <div class="done-screen">
      <div class="done-icon">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <path d="M32 56C32 56 8 42 8 24C8 16.27 14.27 10 22 10C26.1 10 29.76 11.9 32 14.96C34.24 11.9 37.9 10 42 10C49.73 10 56 16.27 56 24C56 42 32 56 32 56Z" stroke="url(#dg)" stroke-width="1.8" fill="none" stroke-linecap="round"/>
          <defs>
            <linearGradient id="dg" x1="8" y1="10" x2="56" y2="56" gradientUnits="userSpaceOnUse">
              <stop stop-color="#FF6B6B"/>
              <stop offset="1" stop-color="#7B35DE"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <h2>That's everyone for now.</h2>
      <p>Come back when new hearts are near.<br />Your beats are out there.</p>
      <a href="/matches" class="btn-primary">See your bonds</a>
    </div>
  {:else if person}
    <div
      class="profile-card"
      class:exiting-pass={transitioning && direction === 'pass'}
      class:exiting-heart={transitioning && direction === 'heart'}
    >
      <!-- Avatar circle with pulsing ring -->
      <div class="avatar-wrap">
        <div class="ring-outer" style="--person-color: {person.color}">
          <div class="ring-inner" style="--person-color: {person.color}">
            <div class="avatar" style="background: {avatarGradient(person)}">
              <span class="initial">{avatarInitial(person)}</span>
            </div>
          </div>
        </div>
        <!-- BPM badge -->
        <div class="bpm-badge">
          <span class="bpm-dot"></span>
          <span class="bpm-val" style="color: {person.color}">{person.bpm}</span>
          <span class="bpm-unit">BPM</span>
        </div>
      </div>

      <!-- Identity -->
      <div class="identity">
        <h2 class="name">{person.name}, <span class="age">{person.age}</span></h2>
        <p class="distance">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="5" r="2" stroke="currentColor" stroke-width="1.2"/>
            <path d="M6 10C6 10 2 7.5 2 5C2 2.79 3.79 1 6 1C8.21 1 10 2.79 10 5C10 7.5 6 10 6 10Z" stroke="currentColor" stroke-width="1.2"/>
          </svg>
          {person.distance}
        </p>
      </div>

      <!-- Live waveform -->
      <div class="waveform-wrap">
        <EcgWaveform bpm={person.bpm} color={person.color} width={320} height={72} useGradient={false} />
      </div>
    </div>

    <!-- Action buttons -->
    <div class="actions">
      <button class="action-btn pass-btn" onclick={pass} aria-label="Pass (←)" title="Pass">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M7 7L21 21M21 7L7 21" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>

      <!-- Sonar effect + heart button -->
      <div class="heart-wrap">
        {#if sonarActive}
          <div class="sonar sonar-1"></div>
          <div class="sonar sonar-2"></div>
          <div class="sonar sonar-3"></div>
        {/if}
        <button
          class="action-btn heart-btn"
          class:sending={sendingHeart}
          onclick={sendHeart}
          aria-label="Send heart (→)"
          title="Send heart"
        >
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
            <path d="M17 30C17 30 4 22 4 13C4 8.58 7.58 5 12 5C14.2 5 16.18 5.96 17.25 7.5C18.32 5.96 20.3 5 22.5 5C26.42 5 30 8.58 30 13C30 22 17 30 17 30Z" fill="white" stroke="white" stroke-width="0.5"/>
          </svg>
        </button>
      </div>

      <div class="key-hint">
        <span>← pass</span>
        <span>→ send heart</span>
      </div>
    </div>
  {/if}
</div>

<BottomNav />

<style>
  .discover-page {
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 24px calc(var(--nav-h, 72px) + 24px);
    gap: 32px;
    position: relative;
    overflow: hidden;
  }

  /* Ambient background based on current person */
  .discover-page::before {
    content: '';
    position: fixed;
    inset: 0;
    background: radial-gradient(ellipse 60% 40% at 50% 30%, rgba(255,107,107,0.06) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  /* ── PROFILE CARD ─────────────────────────────── */
  .profile-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    position: relative;
    z-index: 1;
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease;
  }

  .profile-card.exiting-pass {
    transform: translateX(-120px) rotate(-12deg);
    opacity: 0;
  }

  .profile-card.exiting-heart {
    transform: translateX(120px) rotate(12deg) scale(1.04);
    opacity: 0;
  }

  /* ── AVATAR ───────────────────────────────────── */
  .avatar-wrap {
    position: relative;
  }

  .ring-outer {
    width: 296px;
    height: 296px;
    border-radius: 50%;
    padding: 3px;
    background: conic-gradient(
      from 0deg,
      var(--person-color) 0deg,
      rgba(123,53,222,0.8) 180deg,
      var(--person-color) 360deg
    );
    animation: ring-spin 4s linear infinite;
    position: relative;
  }

  @keyframes ring-spin {
    from { background-position: 0deg; }
  }

  /* Pulsing glow */
  .ring-outer::after {
    content: '';
    position: absolute;
    inset: -8px;
    border-radius: 50%;
    background: radial-gradient(circle, var(--person-color) 0%, transparent 70%);
    opacity: 0;
    animation: ring-glow 1.5s ease-in-out infinite;
  }

  @keyframes ring-glow {
    0%, 100% { opacity: 0; transform: scale(0.9); }
    50% { opacity: 0.18; transform: scale(1.05); }
  }

  .ring-inner {
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
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  .initial {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 100px;
    font-weight: 400;
    color: rgba(255,255,255,0.8);
    line-height: 1;
    margin-top: 8px;
  }

  .bpm-badge {
    position: absolute;
    bottom: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    gap: 5px;
    background: rgba(7,7,16,0.85);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 100px;
    padding: 6px 12px;
    backdrop-filter: blur(12px);
  }

  .bpm-dot {
    width: 6px;
    height: 6px;
    background: #4ADE80;
    border-radius: 50%;
    box-shadow: 0 0 6px #4ADE80;
    animation: pulse-dot 1s ease-in-out infinite;
  }

  @keyframes pulse-dot {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.5); }
  }

  .bpm-val {
    font-size: 15px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  .bpm-unit {
    font-size: 10px;
    font-weight: 400;
    color: rgba(255,255,255,0.3);
    letter-spacing: 0.08em;
  }

  /* ── IDENTITY ─────────────────────────────────── */
  .identity {
    text-align: center;
  }

  .name {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 36px;
    font-weight: 400;
    letter-spacing: -0.01em;
    color: rgba(255,255,255,0.95);
    margin-bottom: 8px;
  }

  .age {
    color: rgba(255,255,255,0.5);
  }

  .distance {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    font-size: 13px;
    font-weight: 400;
    color: rgba(255,255,255,0.35);
  }

  /* ── WAVEFORM ─────────────────────────────────── */
  .waveform-wrap {
    width: 320px;
    height: 72px;
    position: relative;
  }

  .waveform-wrap::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 40px;
    background: linear-gradient(to right, #070710, transparent);
    z-index: 1;
    pointer-events: none;
  }

  .waveform-wrap::after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 40px;
    background: linear-gradient(to left, #070710, transparent);
    z-index: 1;
    pointer-events: none;
  }

  /* ── ACTIONS ──────────────────────────────────── */
  .actions {
    display: flex;
    align-items: center;
    gap: 28px;
    position: relative;
    z-index: 1;
    flex-direction: column;
  }

  .actions > :first-child,
  .heart-wrap {
    display: flex;
  }

  .actions > :first-child ~ * {
    display: flex;
  }

  /* reorganize into row */
  .actions {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
  }

  .action-btn {
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    cursor: pointer;
  }

  .pass-btn {
    width: 60px;
    height: 60px;
    background: rgba(255,255,255,0.08);
    border: 1px solid rgba(255,255,255,0.12);
  }

  .pass-btn:hover {
    background: rgba(255,255,255,0.13);
    transform: scale(1.06);
  }

  .pass-btn:active {
    transform: scale(0.95);
  }

  .heart-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
  }

  .sonar {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid rgba(255,107,107,0.5);
    animation: sonar-expand 0.9s ease-out forwards;
  }

  .sonar-2 {
    animation-delay: 0.2s;
    opacity: 0;
  }

  .sonar-3 {
    animation-delay: 0.4s;
    opacity: 0;
  }

  @keyframes sonar-expand {
    0% { transform: scale(1); opacity: 0.8; }
    100% { transform: scale(3); opacity: 0; }
  }

  .heart-btn {
    width: 80px;
    height: 80px;
    background: linear-gradient(135deg, #FF6B6B, #E81F8C 50%, #7B35DE);
    box-shadow:
      0 0 40px rgba(255,107,107,0.3),
      0 8px 30px rgba(0,0,0,0.4);
    position: relative;
    z-index: 1;
  }

  .heart-btn:hover {
    transform: scale(1.08);
    box-shadow:
      0 0 60px rgba(255,107,107,0.45),
      0 12px 40px rgba(0,0,0,0.5);
  }

  .heart-btn:active,
  .heart-btn.sending {
    transform: scale(0.93);
  }

  .key-hint {
    width: 100%;
    display: flex;
    justify-content: space-between;
    padding: 0 8px;
    font-size: 10px;
    font-weight: 400;
    color: rgba(255,255,255,0.18);
    letter-spacing: 0.04em;
    margin-top: -16px;
  }

  /* ── DONE SCREEN ──────────────────────────────── */
  .done-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 20px;
    max-width: 320px;
    z-index: 1;
    position: relative;
  }

  .done-icon {
    margin-bottom: 8px;
    opacity: 0.6;
  }

  .done-screen h2 {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 28px;
    font-weight: 400;
    color: rgba(255,255,255,0.85);
  }

  .done-screen p {
    font-size: 15px;
    font-weight: 300;
    line-height: 1.7;
    color: rgba(255,255,255,0.4);
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 14px 32px;
    background: linear-gradient(135deg, #FF6B6B, #7B35DE);
    border-radius: 100px;
    font-size: 15px;
    font-weight: 500;
    color: white;
    text-decoration: none;
    margin-top: 8px;
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  .btn-primary:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  /* ── MOBILE ───────────────────────────────────── */
  @media (max-width: 400px) {
    .ring-outer {
      width: 250px;
      height: 250px;
    }

    .initial {
      font-size: 80px;
    }

    .waveform-wrap {
      width: 280px;
    }
  }
</style>

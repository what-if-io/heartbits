<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import EcgWaveform from '$lib/components/EcgWaveform.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import MatchReveal from '$lib/components/MatchReveal.svelte';
  import ConsentGate from '$lib/components/ConsentGate.svelte';
  import { grantConsent, checkConsent } from '$lib/stores/consent';

  interface Person {
    id: string;
    name: string;
    age: number;
    distance: string;
    bpm: number;
    color: string;
    bio: string;
    interests: string[];
  }

  const people: Person[] = [
    { id: 'ela',  name: 'Ela',  age: 28, distance: '2 km away',  bpm: 72, color: '#FF6B6B', bio: 'Chasing sunsets and slow mornings.', interests: ['yoga', 'film', 'jazz'] },
    { id: 'mia',  name: 'Mia',  age: 31, distance: '5 km away',  bpm: 65, color: '#7B35DE', bio: 'Books, bicycles, and bad puns.', interests: ['reading', 'cycling', 'cooking'] },
    { id: 'zara', name: 'Zara', age: 26, distance: '1 km away',  bpm: 80, color: '#E81F8C', bio: 'Dancing through the noise of the city.', interests: ['dancing', 'music', 'art'] },
    { id: 'lena', name: 'Lena', age: 29, distance: '8 km away',  bpm: 58, color: '#FF8C42', bio: 'Mountains, markets, and mindful living.', interests: ['hiking', 'pottery', 'tea'] },
    { id: 'kai',  name: 'Kai',  age: 33, distance: '12 km away', bpm: 76, color: '#5B8FE8', bio: 'Architect by day, stargazer by night.', interests: ['design', 'astronomy', 'coffee'] },
  ];

  // ── STATE ───────────────────────────────────────────────
  let currentIndex = $state(0);
  let transitioning = $state(false);
  let outOfPeople = $state(false);

  // Drag state
  let isDragging = $state(false);
  let dragX = $state(0);
  let dragY = $state(0);
  let startX = $state(0);
  let startY = $state(0);
  let velocity = $state(0);
  let lastX = $state(0);
  let lastT = $state(0);

  // Throw direction feedback
  let dragIntent = $state<'pass' | 'heart' | null>(null);

  // ── CONSENT GATE (soft — triggered on first heart send) ─
  let showConsentGate = $state(false);
  let pendingHeartAction = $state(false);

  function handleConsentGranted() {
    grantConsent('1.0');
    showConsentGate = false;
    if (pendingHeartAction) {
      pendingHeartAction = false;
      throwCard('heart');
    }
  }

  function handleConsentDecline() {
    showConsentGate = false;
    pendingHeartAction = false;
    goto('/discover');
  }

  // Match reveal modal
  let showMatchReveal = $state(false);
  let matchRevealPerson = $state<Person | null>(null);
  let heartsCount = $state(0);

  // Card element for direct manipulation
  let cardEl = $state<HTMLElement | null>(null);

  // ── DERIVED ─────────────────────────────────────────────
  let person = $derived(people[currentIndex]);
  let nextPerson = $derived(currentIndex + 1 < people.length ? people[currentIndex + 1] : null);
  let afterPerson = $derived(currentIndex + 2 < people.length ? people[currentIndex + 2] : null);

  let rotation = $derived(dragX * 0.08);
  let dragProgress = $derived(Math.min(Math.abs(dragX) / 120, 1)); // 0..1

  // ── AVATAR HELPERS ──────────────────────────────────────
  function avatarGrad(color: string): string {
    return `linear-gradient(145deg, ${color}55 0%, ${color}cc 100%)`;
  }

  // ── DRAG HANDLERS ───────────────────────────────────────
  function startDrag(clientX: number, clientY: number) {
    if (transitioning || outOfPeople) return;
    isDragging = true;
    startX = clientX;
    startY = clientY;
    dragX = 0;
    dragY = 0;
    lastX = clientX;
    lastT = Date.now();
    velocity = 0;
  }

  function moveDrag(clientX: number, clientY: number) {
    if (!isDragging) return;
    const now = Date.now();
    const dt = now - lastT;
    if (dt > 0) velocity = (clientX - lastX) / dt;
    lastX = clientX;
    lastT = now;
    dragX = clientX - startX;
    dragY = clientY - startY;
    dragIntent = dragX > 20 ? 'heart' : dragX < -20 ? 'pass' : null;
  }

  function endDrag() {
    if (!isDragging) return;
    isDragging = false;
    const THROW_THRESHOLD = 0.5; // px/ms
    const DIST_THRESHOLD = 100; // px
    if (Math.abs(velocity) > THROW_THRESHOLD || Math.abs(dragX) > DIST_THRESHOLD) {
      if (dragX > 0) {
        throwCard('heart');
      } else {
        throwCard('pass');
      }
    } else {
      // Spring back
      dragX = 0;
      dragY = 0;
      dragIntent = null;
    }
  }

  // ── ACTIONS ─────────────────────────────────────────────
  async function throwCard(dir: 'pass' | 'heart') {
    if (transitioning || outOfPeople) return;
    // GDPR Art. 9: check consent before sending heart (biometric sharing implied)
    if (dir === 'heart' && !checkConsent()) {
      pendingHeartAction = true;
      showConsentGate = true;
      // Reset drag state so card springs back while gate is shown
      isDragging = false;
      dragX = 0;
      dragY = 0;
      dragIntent = null;
      return;
    }
    transitioning = true;
    dragIntent = dir;

    if (dir === 'heart') {
      heartsCount++;
      dragX = 500;
      dragY = -80;
    } else {
      dragX = -500;
      dragY = -80;
    }

    await delay(420);

    // Check for match (every 2nd heart in demo)
    if (dir === 'heart' && heartsCount % 2 === 0 && person) {
      matchRevealPerson = { ...person };
      dragX = 0; dragY = 0; dragIntent = null;
      transitioning = false;
      advance();
      await delay(300);
      showMatchReveal = true;
      return;
    }

    advance();
    await delay(60);
    dragX = 0;
    dragY = 0;
    dragIntent = null;
    transitioning = false;
  }

  function advance() {
    if (currentIndex >= people.length - 1) {
      outOfPeople = true;
    } else {
      currentIndex++;
    }
  }

  function delay(ms: number) {
    return new Promise<void>(r => setTimeout(r, ms));
  }

  function dismissMatch() {
    showMatchReveal = false;
    matchRevealPerson = null;
  }

  // ── KEYBOARD ────────────────────────────────────────────
  function handleKey(e: KeyboardEvent) {
    if (showMatchReveal) {
      if (e.key === 'Escape') dismissMatch();
      return;
    }
    if (e.key === 'ArrowLeft') throwCard('pass');
    if (e.key === 'ArrowRight') throwCard('heart');
  }

  // ── TOUCH / MOUSE EVENTS ────────────────────────────────
  function onMouseDown(e: MouseEvent) { startDrag(e.clientX, e.clientY); }
  function onMouseMove(e: MouseEvent) { moveDrag(e.clientX, e.clientY); }
  function onMouseUp() { endDrag(); }
  function onTouchStart(e: TouchEvent) { if (e.touches[0]) startDrag(e.touches[0].clientX, e.touches[0].clientY); }
  function onTouchMove(e: TouchEvent) { if (e.touches[0]) moveDrag(e.touches[0].clientX, e.touches[0].clientY); }
  function onTouchEnd() { endDrag(); }

  onMount(() => {
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('mousemove', onMouseMove);
    };
  });

  // Dynamic CSS transform for the top card
  let cardTransform = $derived(
    isDragging || transitioning
      ? `translate(${dragX}px, ${dragY}px) rotate(${rotation}deg)`
      : 'translate(0,0) rotate(0deg)'
  );
  let cardTransition = $derived(
    isDragging ? 'none' : 'transform 0.42s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
  );
</script>

<svelte:head>
  <title>Discover — HeartBits</title>
  <meta name="description" content="Discover people whose heartbeat resonates with yours." />
  <meta name="robots" content="noindex" />
</svelte:head>

{#if showConsentGate}
  <ConsentGate onConsent={handleConsentGranted} onDecline={handleConsentDecline} />
{/if}

<!-- Match reveal overlay -->
{#if showMatchReveal && matchRevealPerson}
  <MatchReveal
    person={matchRevealPerson}
    yourBpm={72}
    ondismiss={dismissMatch}
  />
{/if}

<div class="discover-page">
  <!-- Ambient background tint that reacts to drag -->
  <div
    class="ambient-tint ambient-pass"
    style="opacity: {dragIntent === 'pass' ? dragProgress * 0.18 : 0}"
  ></div>
  <div
    class="ambient-tint ambient-heart"
    style="opacity: {dragIntent === 'heart' ? dragProgress * 0.18 : 0}"
  ></div>

  {#if outOfPeople}
    <!-- ── DONE SCREEN ─────────────────────── -->
    <div class="done-screen">
      <div class="done-flatline">
        <svg width="200" height="48" viewBox="0 0 200 48" fill="none">
          <path class="flatline-path" d="M0,24 L70,24 L75,24 L80,10 L85,38 L90,24 L130,24 L200,24" stroke="url(#fg)" stroke-width="2" stroke-linecap="round" fill="none"/>
          <defs>
            <linearGradient id="fg" x1="0" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse">
              <stop stop-color="#FF6B6B" stop-opacity="0.2"/>
              <stop offset="0.45" stop-color="#E81F8C" stop-opacity="0.6"/>
              <stop offset="1" stop-color="#7B35DE" stop-opacity="0.2"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <h2 class="done-title">That's everyone for now.</h2>
      <p class="done-sub">Your first match is out there.<br />Come back when new hearts are near.</p>
      <a href="/matches" class="btn-primary">See your bonds</a>
    </div>

  {:else if person}
    <!-- ── CARD STACK ──────────────────────── -->
    <div class="card-stack">

      <!-- Card 3 (bottom) -->
      {#if afterPerson}
        <div class="card card-third" style="background: {avatarGrad(afterPerson.color)}10">
          <div class="card-avatar-bg" style="background: {avatarGrad(afterPerson.color)}"></div>
          <span class="card-initial card-initial-dim">{afterPerson.name[0]}</span>
        </div>
      {:else}
        <div class="card card-third card-empty"></div>
      {/if}

      <!-- Card 2 (middle) -->
      {#if nextPerson}
        <div class="card card-second" style="--next-color: {nextPerson.color}">
          <div class="card-avatar-bg" style="background: {avatarGrad(nextPerson.color)}"></div>
          <span class="card-initial card-initial-dim">{nextPerson.name[0]}</span>
        </div>
      {:else}
        <div class="card card-second card-empty"></div>
      {/if}

      <!-- Card 1 (top — draggable) -->
      <div
        class="card card-top"
        class:is-dragging={isDragging}
        style="transform: {cardTransform}; transition: {cardTransition}; --person-color: {person.color}"
        onmousedown={onMouseDown}
        ontouchstart={onTouchStart}
        ontouchmove={onTouchMove}
        ontouchend={onTouchEnd}
        role="button"
        tabindex="0"
        aria-label="Drag card to pass or send heart"
        bind:this={cardEl}
      >
        <!-- Pass stamp -->
        <div class="stamp stamp-pass" style="opacity: {dragIntent === 'pass' ? Math.min(dragProgress * 1.6, 1) : 0}">
          PASS
        </div>
        <!-- Heart stamp -->
        <div class="stamp stamp-heart" style="opacity: {dragIntent === 'heart' ? Math.min(dragProgress * 1.6, 1) : 0}">
          ♥
        </div>

        <!-- Photo area (gradient + initials) -->
        <div class="card-photo">
          <div class="card-photo-bg" style="background: {avatarGrad(person.color)}"></div>
          <!-- Grid pattern overlay -->
          <div class="card-photo-grid"></div>
          <!-- Big initial -->
          <span class="card-initial-large">{person.name[0]}</span>
          <!-- BPM badge -->
          <div class="card-bpm-badge">
            <span class="bpm-live-dot" style="background: {person.color}; box-shadow: 0 0 6px {person.color}"></span>
            <span class="bpm-val" style="color: {person.color}">{person.bpm}</span>
            <span class="bpm-unit">BPM</span>
          </div>
        </div>

        <!-- Card content below photo -->
        <div class="card-body">
          <div class="card-identity">
            <h2 class="card-name">{person.name}, <span class="card-age">{person.age}</span></h2>
            <span class="card-distance">
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="5" r="2" stroke="currentColor" stroke-width="1.2"/>
                <path d="M6 10C6 10 2 7.5 2 5C2 2.79 3.79 1 6 1C8.21 1 10 2.79 10 5C10 7.5 6 10 6 10Z" stroke="currentColor" stroke-width="1.2"/>
              </svg>
              {person.distance}
            </span>
          </div>

          <p class="card-bio">{person.bio}</p>

          <div class="card-interests">
            {#each person.interests as interest}
              <span class="interest-tag" style="color: {person.color}80; border-color: {person.color}30">{interest}</span>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <!-- ── ECG STRIP ──────────────────────── -->
    <div class="ecg-strip-wrap">
      <div class="ecg-label">
        <span class="live-dot" style="background: {person.color}; box-shadow: 0 0 5px {person.color}"></span>
        <span class="ecg-name" style="color: {person.color}">{person.name}</span>
        <span class="ecg-bpm" style="color: {person.color}">{person.bpm} BPM</span>
      </div>
      <EcgWaveform
        bpm={person.bpm}
        color={person.color}
        width={340}
        height={60}
        useGradient={false}
      />
    </div>

    <!-- ── ACTION BUTTONS ─────────────────── -->
    <div class="actions">
      <button
        class="action-btn pass-btn"
        onclick={() => throwCard('pass')}
        aria-label="Pass"
        title="Pass (←)"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>

      <!-- Heart button with sonar -->
      <div class="heart-btn-wrap">
        <div class="sonar-ring sonar-1" style="border-color: {person.color}40"></div>
        <div class="sonar-ring sonar-2" style="border-color: {person.color}30"></div>
        <div class="sonar-ring sonar-3" style="border-color: {person.color}20"></div>
        <button
          class="action-btn heart-btn"
          onclick={() => throwCard('heart')}
          aria-label="Send heart"
          title="Send heart (→)"
        >
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
            <path d="M15 26C15 26 3 18.5 3 11C3 7.13 6.13 4 10 4C12.07 4 13.93 4.96 15 6.5C16.07 4.96 17.93 4 20 4C23.87 4 27 7.13 27 11C27 18.5 15 26 15 26Z" fill="white" stroke="white" stroke-width="0.5"/>
          </svg>
        </button>
      </div>

      <!-- Info / undo button -->
      <button class="action-btn info-btn" aria-label="Info" title="Info">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="1.5"/>
          <path d="M10 9V14M10 7V7.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <!-- Key hints -->
    <div class="key-hints">
      <span>← pass</span>
      <span>drag to decide</span>
      <span>→ send heart</span>
    </div>
  {/if}
</div>

<BottomNav />

<style>
  /* ── PAGE ─────────────────────────────────────────── */
  .discover-page {
    min-height: 100svh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 24px calc(var(--nav-h, 72px) + 16px);
    gap: 20px;
    position: relative;
    overflow: hidden;
    user-select: none;
  }

  /* Ambient drag tints */
  .ambient-tint {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    transition: opacity 0.1s ease;
  }

  .ambient-pass {
    background: radial-gradient(ellipse 80% 60% at 20% 50%, rgba(255,60,60,0.5) 0%, transparent 70%);
  }

  .ambient-heart {
    background: radial-gradient(ellipse 80% 60% at 80% 50%, rgba(232,31,140,0.5) 0%, transparent 70%);
  }

  /* ── CARD STACK ──────────────────────────────────── */
  .card-stack {
    position: relative;
    width: 340px;
    height: 460px;
    z-index: 1;
  }

  .card {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: 24px;
    overflow: hidden;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    box-shadow:
      0 20px 60px rgba(0,0,0,0.6),
      0 4px 20px rgba(0,0,0,0.4),
      inset 0 1px 0 rgba(255,255,255,0.07);
  }

  /* Third card — most behind, smallest */
  .card-third {
    transform: translateY(20px) scale(0.88);
    z-index: 1;
    opacity: 0.5;
    filter: blur(1px);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  /* Second card — middle */
  .card-second {
    transform: translateY(12px) scale(0.94);
    z-index: 2;
    opacity: 0.75;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }

  /* Top card — full, interactive */
  .card-top {
    z-index: 3;
    cursor: grab;
    display: flex;
    flex-direction: column;
    transform-origin: center bottom;
    will-change: transform;
  }

  .card-top.is-dragging {
    cursor: grabbing;
  }

  .card-empty {
    opacity: 0.15;
  }

  /* Photo area inside stacked cards */
  .card-avatar-bg {
    position: absolute;
    inset: 0;
    opacity: 0.15;
  }

  .card-initial {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 96px;
    font-weight: 400;
    line-height: 1;
    position: relative;
    z-index: 1;
  }

  .card-initial-dim {
    color: rgba(255,255,255,0.15);
  }

  /* ── STAMPS ─────────────────────────────────────── */
  .stamp {
    position: absolute;
    top: 36px;
    z-index: 10;
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 32px;
    font-weight: 400;
    letter-spacing: 0.12em;
    padding: 6px 14px;
    border-radius: 8px;
    border-width: 3px;
    border-style: solid;
    pointer-events: none;
    transition: opacity 0.08s ease;
  }

  .stamp-pass {
    left: 24px;
    color: #ff4444;
    border-color: #ff4444;
    transform: rotate(-12deg);
    text-shadow: 0 0 20px rgba(255,68,68,0.5);
  }

  .stamp-heart {
    right: 24px;
    color: #E81F8C;
    border-color: #E81F8C;
    transform: rotate(12deg);
    font-size: 40px;
    letter-spacing: 0;
    text-shadow: 0 0 20px rgba(232,31,140,0.6);
  }

  /* ── CARD PHOTO ──────────────────────────────────── */
  .card-photo {
    position: relative;
    width: 100%;
    height: 260px;
    flex-shrink: 0;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-photo-bg {
    position: absolute;
    inset: 0;
    opacity: 0.85;
  }

  .card-photo-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 32px 32px;
    pointer-events: none;
  }

  .card-initial-large {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 120px;
    font-weight: 400;
    color: rgba(255,255,255,0.75);
    line-height: 1;
    position: relative;
    z-index: 1;
    text-shadow: 0 4px 40px rgba(0,0,0,0.4);
  }

  .card-bpm-badge {
    position: absolute;
    bottom: 14px;
    right: 16px;
    display: flex;
    align-items: center;
    gap: 5px;
    background: rgba(7,7,16,0.8);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 100px;
    padding: 5px 10px;
    backdrop-filter: blur(12px);
    z-index: 2;
  }

  .bpm-live-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    animation: dot-pulse 1.1s ease-in-out infinite;
    flex-shrink: 0;
  }

  @keyframes dot-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.5); opacity: 0.7; }
  }

  .bpm-val {
    font-size: 14px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  .bpm-unit {
    font-size: 9px;
    font-weight: 400;
    color: rgba(255,255,255,0.3);
    letter-spacing: 0.08em;
  }

  /* ── CARD BODY ───────────────────────────────────── */
  .card-body {
    flex: 1;
    padding: 18px 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: rgba(7,7,16,0.65);
    backdrop-filter: blur(4px);
  }

  .card-identity {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
  }

  .card-name {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 26px;
    font-weight: 400;
    letter-spacing: -0.01em;
    color: rgba(255,255,255,0.95);
  }

  .card-age {
    color: rgba(255,255,255,0.45);
  }

  .card-distance {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: rgba(255,255,255,0.3);
    flex-shrink: 0;
  }

  .card-bio {
    font-size: 13px;
    font-weight: 300;
    line-height: 1.6;
    color: rgba(255,255,255,0.5);
    font-style: italic;
  }

  .card-interests {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .interest-tag {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.06em;
    padding: 3px 8px;
    border-radius: 100px;
    border-width: 1px;
    border-style: solid;
    text-transform: lowercase;
  }

  /* ── ECG STRIP ───────────────────────────────────── */
  .ecg-strip-wrap {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 340px;
  }

  .ecg-label {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 0 4px;
  }

  .live-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    animation: dot-pulse 1.1s ease-in-out infinite;
    flex-shrink: 0;
  }

  .ecg-name {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
  }

  .ecg-bpm {
    font-size: 11px;
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    margin-left: auto;
  }

  /* ── ACTIONS ─────────────────────────────────────── */
  .actions {
    display: flex;
    align-items: center;
    gap: 20px;
    position: relative;
    z-index: 1;
  }

  .action-btn {
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  }

  .pass-btn {
    width: 58px;
    height: 58px;
    background: rgba(255,255,255,0.05);
    border: 1.5px solid rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.45);
  }

  .pass-btn:hover {
    background: rgba(255,80,80,0.12);
    border-color: rgba(255,80,80,0.25);
    color: rgba(255,80,80,0.8);
    transform: scale(1.06);
  }

  .pass-btn:active {
    transform: scale(0.94);
  }

  .heart-btn-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
  }

  .sonar-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border-width: 1.5px;
    border-style: solid;
    animation: sonar-pulse 2.4s ease-out infinite;
  }

  .sonar-ring.sonar-2 { animation-delay: 0.8s; }
  .sonar-ring.sonar-3 { animation-delay: 1.6s; }

  @keyframes sonar-pulse {
    0% { transform: scale(1); opacity: 0.7; }
    100% { transform: scale(2.2); opacity: 0; }
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

  .heart-btn:active {
    transform: scale(0.93);
  }

  .info-btn {
    width: 58px;
    height: 58px;
    background: rgba(255,255,255,0.05);
    border: 1.5px solid rgba(255,255,255,0.1);
    color: rgba(255,255,255,0.35);
  }

  .info-btn:hover {
    background: rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.6);
    transform: scale(1.06);
  }

  /* ── KEY HINTS ───────────────────────────────────── */
  .key-hints {
    display: flex;
    justify-content: space-between;
    width: 340px;
    font-size: 10px;
    color: rgba(255,255,255,0.15);
    letter-spacing: 0.04em;
    z-index: 1;
  }

  /* ── DONE SCREEN ─────────────────────────────────── */
  .done-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;
    max-width: 320px;
    z-index: 1;
    position: relative;
  }

  .done-flatline {
    margin-bottom: 12px;
  }

  .flatline-path {
    stroke-dasharray: 600;
    stroke-dashoffset: 0;
    animation: flatline-beat 3.2s ease-in-out infinite;
  }

  @keyframes flatline-beat {
    0%, 65% { stroke-dashoffset: 0; opacity: 0.6; }
    70%, 75% { stroke-dashoffset: -80; opacity: 1; }
    80%, 100% { stroke-dashoffset: 0; opacity: 0.6; }
  }

  .done-title {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 26px;
    font-weight: 400;
    color: rgba(255,255,255,0.85);
  }

  .done-sub {
    font-size: 14px;
    font-weight: 300;
    line-height: 1.7;
    color: rgba(255,255,255,0.35);
  }

  .btn-primary {
    display: inline-flex;
    align-items: center;
    padding: 13px 28px;
    background: linear-gradient(135deg, #FF6B6B, #7B35DE);
    border-radius: 100px;
    font-size: 14px;
    font-weight: 500;
    color: white;
    text-decoration: none;
    margin-top: 8px;
    transition: opacity 0.2s ease, transform 0.2s ease;
    box-shadow: 0 0 30px rgba(255,107,107,0.2);
  }

  .btn-primary:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  /* ── MOBILE ──────────────────────────────────────── */
  @media (max-width: 380px) {
    .card-stack,
    .ecg-strip-wrap,
    .key-hints {
      width: 300px;
    }
  }
</style>

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import EcgWaveform from '$lib/components/EcgWaveform.svelte';
  import { consent, grantConsent, withdrawConsent } from '$lib/stores/consent';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // ── PROFILE STATE ────────────────────────────────────────────────────────
  const profile = $derived(data.profile);

  // Display name: HeartBits profile name → session name → fallback
  const displayName = $derived(
    profile?.display_name ?? data.user?.name?.split(' ')[0] ?? 'You'
  );
  const initial = $derived(displayName[0]?.toUpperCase() ?? 'Y');
  const displayAge = $derived(profile?.age ?? null);

  let shareHeartbeat = $derived($consent.hasConsented);
  let showWithdrawConfirm = $state(false);
  let avatarVisible = $state(false);
  let statsVisible = $state(false);

  // Simulated live BPM
  let liveBpm = $state(72);
  let bpmInterval: ReturnType<typeof setInterval>;

  // ── EDIT SHEET STATE ─────────────────────────────────────────────────────
  let showEditSheet = $state(false);
  let saving = $state(false);
  let saveError = $state('');
  let saveSuccess = $state(false);

  // Form fields — initialised from loaded profile
  let fname = $state('');
  let fbio = $state('');
  let fdob = $state('');
  let fgender = $state('');
  let fseeking = $state<string[]>([]);
  let fageMin = $state(18);
  let fageMax = $state(99);
  let flocation = $state('');
  let locationLoading = $state(false);
  let locationError = $state('');

  function openEditSheet() {
    fname     = profile?.display_name ?? '';
    fbio      = profile?.bio ?? '';
    fdob      = profile?.date_of_birth ?? '';
    fgender   = profile?.gender ?? '';
    fseeking  = [...(profile?.seeking ?? [])];
    fageMin   = profile?.age_min ?? 18;
    fageMax   = profile?.age_max ?? 99;
    flocation = profile?.location_geohash6 ?? '';
    saveError = '';
    saveSuccess = false;
    showEditSheet = true;
  }

  function toggleSeeking(val: string) {
    if (fseeking.includes(val)) {
      fseeking = fseeking.filter((v) => v !== val);
    } else {
      fseeking = [...fseeking, val];
    }
  }

  // Minimal geohash encoder (precision 6 ≈ 1.2km)
  const GEO32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  function latLngToGeohash(lat: number, lng: number, prec = 6): string {
    let idx = 0, bit = 0, even = true, h = '';
    let [minLt, maxLt, minLg, maxLg] = [-90, 90, -180, 180];
    while (h.length < prec) {
      const mid = even ? (minLg + maxLg) / 2 : (minLt + maxLt) / 2;
      if (even) { if (lng >= mid) { idx = (idx << 1) | 1; minLg = mid; } else { idx <<= 1; maxLg = mid; } }
      else       { if (lat >= mid) { idx = (idx << 1) | 1; minLt = mid; } else { idx <<= 1; maxLt = mid; } }
      even = !even;
      if (++bit === 5) { h += GEO32[idx]; bit = 0; idx = 0; }
    }
    return h;
  }

  function useLocation() {
    if (!navigator.geolocation) { locationError = 'Geolocation not supported'; return; }
    locationLoading = true;
    locationError = '';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        flocation = latLngToGeohash(pos.coords.latitude, pos.coords.longitude);
        locationLoading = false;
      },
      (err) => {
        locationError = err.code === 1 ? 'Location access denied' : 'Could not get location';
        locationLoading = false;
      },
      { timeout: 10_000, maximumAge: 60_000 }
    );
  }

  async function saveProfile() {
    if (saving) return;
    saving = true;
    saveError = '';
    saveSuccess = false;

    const body: Record<string, unknown> = {};
    if (fname.trim())    body.display_name      = fname.trim();
    else                 body.display_name      = null;
    if (fbio.trim())     body.bio               = fbio.trim();
    else                 body.bio               = null;
    if (fdob)            body.date_of_birth     = fdob;
    if (fgender)         body.gender            = fgender;
    body.seeking   = fseeking;
    body.age_min   = fageMin;
    body.age_max   = fageMax;
    if (flocation)       body.location_geohash6 = flocation;
    else                 body.location_geohash6 = null;

    try {
      const res = await fetch('/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json() as { message?: string; error?: string };
      if (res.ok) {
        saveSuccess = true;
        setTimeout(() => {
          showEditSheet = false;
          // Reload page data to reflect saved changes
          goto('/profile', { invalidateAll: true });
        }, 900);
      } else {
        saveError = result.error ?? 'Save failed';
      }
    } catch {
      saveError = 'Network error — please try again';
    } finally {
      saving = false;
    }
  }

  // ── AVATAR UPLOAD ────────────────────────────────────────────────────────
  let uploadedAvatarUrl = $state<string | null>(null);
  const avatarUrl = $derived(uploadedAvatarUrl ?? data.profile?.avatar_url ?? null);
  let avatarUploading = $state(false);
  let avatarError = $state('');
  let fileInput: HTMLInputElement | undefined = $state();

  async function onAvatarFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    avatarUploading = true;
    avatarError = '';
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/profile', { method: 'POST', body: fd });
      const result = await res.json() as { avatar_url?: string; error?: string };
      if (res.ok && result.avatar_url) {
        uploadedAvatarUrl = result.avatar_url + '?v=' + Date.now(); // bust cache
      } else {
        avatarError = result.error ?? 'Upload failed';
      }
    } catch {
      avatarError = 'Network error';
    } finally {
      avatarUploading = false;
      input.value = '';
    }
  }

  // ── PAUSE ACCOUNT (reversible) ───────────────────────────────────────────
  let pausing = $state(false);

  async function pauseAccount() {
    if (pausing) return;
    pausing = true;
    try {
      const res = await fetch('/profile/pause', { method: 'POST' });
      // End the Zitadel session too; logging back in reactivates the account.
      if (res.ok) window.location.href = '/auth/logout';
      else pausing = false;
    } catch {
      pausing = false;
    }
  }

  // ── DELETE ACCOUNT (erasure) ─────────────────────────────────────────────
  let showDeleteConfirm = $state(false);
  let deleting = $state(false);

  async function deleteAccount() {
    if (deleting) return;
    deleting = true;
    try {
      const res = await fetch('/profile', { method: 'DELETE' });
      // Full logout so the Zitadel SSO session ends — otherwise the next login
      // silently re-authenticates a now-deleted account (zombie session).
      if (res.ok) window.location.href = '/auth/logout';
      else deleting = false;
    } catch {
      deleting = false;
    }
  }

  onMount(() => {
    setTimeout(() => { avatarVisible = true; }, 100);
    setTimeout(() => { statsVisible = true; }, 380);
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
  <div class="orb orb-1"></div>
  <div class="orb orb-2"></div>

  <!-- Header -->
  <header class="page-header">
    <div class="header-inner">
      <h1 class="header-title-text">Profile</h1>
      {#if !data.isDemo}
        <button class="edit-btn" onclick={openEditSheet} aria-label="Edit profile">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M11.5 2.5L13.5 4.5L5 13H3V11L11.5 2.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="none"/>
          </svg>
          <span>Edit</span>
        </button>
      {/if}
    </div>
  </header>

  <div class="profile-body">

    <!-- Avatar section -->
    <div class="avatar-section" class:visible={avatarVisible}>
      <!-- Hidden file input — triggered by clicking the avatar ring -->
      <input
        bind:this={fileInput}
        type="file"
        accept="image/jpeg,image/webp,image/png"
        class="avatar-file-input"
        onchange={onAvatarFileChange}
        aria-label="Upload profile photo"
      />

      <button
        class="avatar-ring-outer"
        class:uploading={avatarUploading}
        onclick={() => { if (!data.isDemo) fileInput?.click(); }}
        aria-label="Change profile photo"
        type="button"
        style={data.isDemo ? 'cursor: default' : ''}
      >
        <div class="avatar-ring-inner">
          <div class="avatar">
            {#if avatarUrl}
              <img src={avatarUrl} alt="{displayName}'s avatar" class="avatar-img" />
            {:else}
              <span>{initial}</span>
            {/if}
          </div>
        </div>
        <!-- Camera overlay -->
        <div class="avatar-camera" aria-hidden="true">
          {#if avatarUploading}
            <span class="spinner spinner-lg"></span>
          {:else}
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="2" y="6" width="18" height="14" rx="3" stroke="white" stroke-width="1.5" fill="none"/>
              <circle cx="11" cy="13" r="3.5" stroke="white" stroke-width="1.5" fill="none"/>
              <path d="M7 6L8.5 3H13.5L15 6" stroke="white" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
          {/if}
        </div>
      </button>
      {#if avatarError}
        <p class="avatar-error">{avatarError}</p>
      {/if}

      <div class="identity">
        <h2 class="name">
          {displayName}{#if displayAge}<span class="name-age">, {displayAge}</span>{/if}
        </h2>
        <p class="tagline">
          {#if profile?.bio}
            {profile.bio}
          {:else}
            Your heart is your identity.
          {/if}
        </p>
      </div>

      <div class="live-bpm-pill">
        <span class="live-dot"></span>
        <span class="live-val">{liveBpm}</span>
        <span class="live-unit">BPM live</span>
      </div>

      <div class="avatar-wave">
        <EcgWaveform bpm={liveBpm} color="#FF6B6B" width={200} height={36} useGradient={true} />
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-grid" class:visible={statsVisible}>
      {#each [{ value: '—', label: 'Bonds', sub: 'mutual heartbeats' }, { value: '—', label: 'Hearts sent', sub: 'signals shared' }, { value: '—', label: 'Hearts felt', sub: 'received by you' }] as stat, i}
        <div class="stat-card" style="animation-delay: {i * 80}ms">
          <div class="stat-val grad-text">{stat.value}</div>
          <div class="stat-label">{stat.label}</div>
          <div class="stat-sub">{stat.sub}</div>
        </div>
      {/each}
    </div>

    <!-- Heartbeat toggle -->
    <div class="section-card">
      <div class="section-row">
        <div class="section-row-left">
          <div class="section-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 17C10 17 2 12 2 7C2 4.79 3.79 3 6 3C7.27 3 8.41 3.61 9.13 4.56C9.85 3.61 10.99 3 12.25 3C14.46 3 16.25 4.79 16.25 7C16.25 12 10 17 10 17Z" stroke="url(#tog)" stroke-width="1.5" fill="none"/>
              <defs>
                <linearGradient id="tog" x1="2" y1="3" x2="16.25" y2="17" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#FF6B6B"/><stop offset="1" stop-color="#7B35DE"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <p class="section-title-text">Share my heartbeat</p>
            <p class="section-desc">Let others feel your pulse while discovering</p>
          </div>
        </div>
        <button
          class="toggle"
          class:on={shareHeartbeat}
          onclick={() => { if (shareHeartbeat) showWithdrawConfirm = true; else grantConsent('1.0'); }}
          aria-label="Toggle heartbeat sharing"
          role="switch"
          aria-checked={shareHeartbeat}
        >
          <div class="toggle-thumb"></div>
        </button>
      </div>
    </div>

    <!-- GDPR card -->
    <div class="section-card gdpr-card">
      <div class="gdpr-header">
        <div class="shield-icon">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M11 2L4 5.5V11C4 15.05 7.09 18.82 11 20C14.91 18.82 18 15.05 18 11V5.5L11 2Z" stroke="url(#sg)" stroke-width="1.5" stroke-linejoin="round" fill="none"/>
            <path d="M8 11L10 13L14 9" stroke="url(#sg)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <defs>
              <linearGradient id="sg" x1="4" y1="2" x2="18" y2="20" gradientUnits="userSpaceOnUse">
                <stop stop-color="#4ADE80"/><stop offset="1" stop-color="#22C55E"/>
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
      {#if $consent.hasConsented && $consent.consentDate}
        <div class="consent-status">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <circle cx="6" cy="6" r="5" stroke="rgba(74,222,128,0.7)" stroke-width="1.2"/>
            <path d="M3.5 6L5 7.5L8.5 4" stroke="rgba(74,222,128,0.9)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Consented v{$consent.version} · {new Date($consent.consentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
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

    <!-- Account actions / demo CTA -->
    {#if data.isDemo}
      <div class="section-card demo-cta-card">
        <p class="demo-cta-lead">You're exploring in demo mode.</p>
        <p class="demo-cta-sub">Create a real account to set up your profile, share your heartbeat, and connect with others.</p>
        <a href="/auth/initiate?next=/discover" class="demo-cta-btn">
          Create account
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 7H11M8 4L11 7L8 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
        <a href="/auth/demo-exit" class="demo-exit-link">Exit demo</a>
      </div>
    {:else}
      <div class="section-card">
        <div class="action-list">
          <button class="action-row" onclick={openEditSheet}>
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
          <a href="/auth/logout" class="action-row">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M7 3H3V15H7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 6L15 9L12 12M7 9H15" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Sign out</span>
            <svg class="row-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3L9 7L5 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </a>
          <div class="action-divider"></div>
          <button class="action-row" onclick={pauseAccount} disabled={pausing}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M7 4V14M11 4V14" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
            </svg>
            <span>{pausing ? 'Pausing…' : 'Pause account'}</span>
            <svg class="row-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3L9 7L5 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </button>
          <div class="action-divider"></div>
          <button class="action-row danger-row" onclick={() => showDeleteConfirm = true}>
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
    {/if}

    <p class="version-note">HeartBits v0.1.0 · Built with ♥</p>
  </div>
</div>

<!-- ── EDIT SHEET ─────────────────────────────────────────────────────────── -->
{#if showEditSheet}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="sheet-backdrop"
    onclick={() => showEditSheet = false}
    onkeydown={(e) => { if (e.key === 'Escape') showEditSheet = false; }}
    role="dialog"
    aria-modal="true"
    aria-label="Edit profile"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="sheet" onclick={(e) => e.stopPropagation()}>
      <div class="sheet-handle"></div>

      <div class="sheet-header">
        <h2 class="sheet-title">Edit profile</h2>
        <button class="sheet-close" onclick={() => showEditSheet = false} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="sheet-body">

        <!-- Name -->
        <div class="field">
          <label class="field-label" for="edit-name">Display name</label>
          <input
            id="edit-name"
            class="field-input"
            type="text"
            maxlength="50"
            placeholder="How others see you"
            bind:value={fname}
          />
        </div>

        <!-- Bio -->
        <div class="field">
          <label class="field-label" for="edit-bio">About you</label>
          <textarea
            id="edit-bio"
            class="field-input field-textarea"
            maxlength="500"
            placeholder="A few words about yourself…"
            rows="3"
            bind:value={fbio}
          ></textarea>
          <p class="field-hint">{fbio.length}/500</p>
        </div>

        <!-- Date of birth -->
        <div class="field">
          <label class="field-label" for="edit-dob">Date of birth</label>
          <input
            id="edit-dob"
            class="field-input"
            type="date"
            max={new Date(Date.now() - 18 * 365.25 * 86400000).toISOString().slice(0,10)}
            bind:value={fdob}
          />
        </div>

        <!-- Gender -->
        <div class="field">
          <p class="field-label">I am</p>
          <div class="chip-row">
            {#each ['man','woman','nonbinary','other'] as g}
              <button
                class="chip"
                class:active={fgender === g}
                onclick={() => fgender = fgender === g ? '' : g}
                type="button"
              >{g}</button>
            {/each}
          </div>
        </div>

        <!-- Seeking -->
        <div class="field">
          <p class="field-label">Open to meeting</p>
          <div class="chip-row">
            {#each ['man','woman','nonbinary','other'] as g}
              <button
                class="chip"
                class:active={fseeking.includes(g)}
                onclick={() => toggleSeeking(g)}
                type="button"
              >{g}</button>
            {/each}
          </div>
        </div>

        <!-- Age range -->
        <div class="field">
          <p class="field-label">Age range</p>
          <div class="age-row">
            <div class="age-input-wrap">
              <label class="age-sub" for="edit-age-min">Min</label>
              <input
                id="edit-age-min"
                class="field-input age-input"
                type="number"
                min="18"
                max="99"
                bind:value={fageMin}
              />
            </div>
            <span class="age-dash">–</span>
            <div class="age-input-wrap">
              <label class="age-sub" for="edit-age-max">Max</label>
              <input
                id="edit-age-max"
                class="field-input age-input"
                type="number"
                min="18"
                max="99"
                bind:value={fageMax}
              />
            </div>
          </div>
        </div>

        <!-- Location -->
        <div class="field">
          <p class="field-label">Location</p>
          <div class="location-row">
            <input
              class="field-input location-input"
              type="text"
              maxlength="6"
              placeholder="geohash6"
              bind:value={flocation}
              readonly
            />
            <button
              class="location-btn"
              class:loading={locationLoading}
              onclick={useLocation}
              type="button"
              disabled={locationLoading}
            >
              {#if locationLoading}
                <span class="spinner"></span>
              {:else}
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.3"/>
                  <path d="M8 1V3M8 13V15M1 8H3M13 8H15" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
              {/if}
              Use my location
            </button>
          </div>
          {#if locationError}
            <p class="field-error">{locationError}</p>
          {:else if flocation}
            <p class="field-hint">Stored as approximate zone — exact GPS never saved</p>
          {/if}
        </div>

        <!-- Feedback -->
        {#if saveError}
          <p class="save-error">{saveError}</p>
        {/if}
        {#if saveSuccess}
          <p class="save-ok">Saved ✓</p>
        {/if}

        <!-- Save button -->
        <button
          class="save-btn"
          class:loading={saving}
          onclick={saveProfile}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save profile'}
        </button>

      </div>
    </div>
  </div>
{/if}

<!-- ── WITHDRAW CONSENT MODAL ─────────────────────────────────────────────── -->
{#if showWithdrawConfirm}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="sheet-backdrop"
    onclick={() => showWithdrawConfirm = false}
    onkeydown={(e) => { if (e.key === 'Escape') showWithdrawConfirm = false; }}
    role="dialog" aria-modal="true" tabindex="-1"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="withdraw-panel" onclick={(e) => e.stopPropagation()}>
      <div class="withdraw-icon" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M14 3L5 7.5V14C5 19.3 8.86 24.27 14 26C19.14 24.27 23 19.3 23 14V7.5L14 3Z" stroke="url(#wg)" stroke-width="1.8" stroke-linejoin="round" fill="none"/>
          <path d="M10 10L18 18M18 10L10 18" stroke="rgba(255,100,100,0.7)" stroke-width="1.6" stroke-linecap="round"/>
          <defs>
            <linearGradient id="wg" x1="5" y1="3" x2="23" y2="26" gradientUnits="userSpaceOnUse">
              <stop stop-color="rgba(255,107,107,0.8)"/><stop offset="1" stop-color="rgba(232,31,140,0.6)"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <h3 class="withdraw-title">Withdraw consent?</h3>
      <p class="withdraw-body">
        Withdrawing consent will <strong>immediately stop heart rate sharing</strong> with all your matches. You can re-enable it at any time.
      </p>
      <div class="withdraw-actions">
        <button class="withdraw-cancel" onclick={() => showWithdrawConfirm = false}>Keep sharing</button>
        <button class="withdraw-confirm" onclick={() => { withdrawConsent(); showWithdrawConfirm = false; }}>Withdraw</button>
      </div>
    </div>
  </div>
{/if}

<!-- ── DELETE ACCOUNT MODAL ───────────────────────────────────────────────── -->
{#if showDeleteConfirm}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="sheet-backdrop"
    onclick={() => showDeleteConfirm = false}
    onkeydown={(e) => { if (e.key === 'Escape') showDeleteConfirm = false; }}
    role="dialog" aria-modal="true" tabindex="-1"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="withdraw-panel" onclick={(e) => e.stopPropagation()}>
      <h3 class="withdraw-title" style="color: rgba(255,80,80,0.9)">Delete account?</h3>
      <p class="withdraw-body">
        All your data will be permanently erased. Matches, bonds, and heartbeat history are gone forever. This cannot be undone.
      </p>
      <div class="withdraw-actions">
        <button class="withdraw-cancel" onclick={() => showDeleteConfirm = false}>Cancel</button>
        <button class="withdraw-confirm" onclick={deleteAccount} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete forever'}
        </button>
      </div>
    </div>
  </div>
{/if}


<style>
  /* ── PAGE ─────────────────────────────────────────── */
  .profile-page {
    min-height: 100svh;
    padding-bottom: calc(var(--nav-h, 72px) + 24px);
    position: relative;
    overflow-x: hidden;
  }
  .orb {
    position: fixed; border-radius: 50%; filter: blur(100px);
    pointer-events: none; z-index: 0;
  }
  .orb-1 {
    width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(255,107,107,0.08) 0%, transparent 70%);
    top: -80px; left: -100px;
  }
  .orb-2 {
    width: 350px; height: 350px;
    background: radial-gradient(circle, rgba(123,53,222,0.08) 0%, transparent 70%);
    bottom: 100px; right: -60px;
  }

  /* ── HEADER ──────────────────────────────────────── */
  .page-header {
    position: sticky; top: 0;
    background: rgba(7,7,16,0.92);
    backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255,255,255,0.06); z-index: 10; padding: 0 20px;
  }
  .header-inner {
    max-width: 480px; margin: 0 auto; height: 64px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .header-title-text {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 22px; font-weight: 400; color: rgba(255,255,255,0.9);
  }
  .edit-btn {
    display: flex; align-items: center; gap: 6px;
    font-size: 13px; font-weight: 400; color: rgba(255,255,255,0.4);
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 100px; padding: 6px 14px; cursor: pointer;
    transition: color 0.2s ease, background 0.2s ease;
  }
  .edit-btn:hover { color: rgba(255,255,255,0.75); background: rgba(255,255,255,0.08); }

  /* ── BODY ─────────────────────────────────────────── */
  .profile-body {
    max-width: 480px; margin: 0 auto; padding: 32px 16px;
    display: flex; flex-direction: column; gap: 16px;
    position: relative; z-index: 1;
  }

  /* ── AVATAR SECTION ──────────────────────────────── */
  .avatar-section {
    display: flex; flex-direction: column; align-items: center; gap: 14px;
    opacity: 0; transform: translateY(20px);
    transition: opacity 0.6s ease, transform 0.6s ease; margin-bottom: 8px;
  }
  .avatar-section.visible { opacity: 1; transform: translateY(0); }
  .avatar-file-input { display: none; }

  .avatar-ring-outer {
    width: 186px; height: 186px; border-radius: 50%; padding: 3px;
    background: conic-gradient(from 0deg, #FF6B6B 0deg, #E81F8C 120deg, #7B35DE 240deg, #FF6B6B 360deg);
    animation: ring-rotate 6s linear infinite; position: relative;
    cursor: pointer; border: none; appearance: none; -webkit-appearance: none;
    transition: filter 0.2s ease;
  }
  .avatar-ring-outer:hover { filter: brightness(1.1); }
  .avatar-ring-outer.uploading { animation: none; filter: brightness(0.7); }
  .avatar-ring-outer::after {
    content: ''; position: absolute; inset: -6px; border-radius: 50%;
    background: radial-gradient(circle, rgba(232,31,140,0.2) 0%, transparent 70%);
    animation: ring-glow 2s ease-in-out infinite;
  }
  @keyframes ring-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  @keyframes ring-glow { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
  .avatar-ring-inner {
    width: 100%; height: 100%; border-radius: 50%; background: #070710;
    padding: 4px; display: flex; align-items: center; justify-content: center;
  }
  .avatar {
    width: 100%; height: 100%; border-radius: 50%;
    background: linear-gradient(145deg, rgba(255,107,107,0.18), rgba(123,53,222,0.35));
    display: flex; align-items: center; justify-content: center;
  }
  .avatar span {
    font-family: 'DM Serif Display', Georgia, serif; font-size: 72px; font-weight: 400;
    background: linear-gradient(135deg, #FF6B6B, #E81F8C 50%, #7B35DE);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    line-height: 1; margin-top: 4px;
  }
  .avatar-img {
    width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;
  }
  .avatar-camera {
    position: absolute; inset: 0; border-radius: 50%;
    background: rgba(0,0,0,0.45);
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.2s ease;
  }
  .avatar-ring-outer:hover .avatar-camera,
  .avatar-ring-outer.uploading .avatar-camera { opacity: 1; }
  .avatar-error {
    font-size: 12px; color: rgba(255,100,100,0.8); text-align: center; margin: 0;
  }
  .spinner-lg { width: 24px; height: 24px; border-width: 2.5px; }
  .identity { text-align: center; display: flex; flex-direction: column; gap: 6px; }
  .name {
    font-family: 'DM Serif Display', Georgia, serif; font-size: 32px; font-weight: 400;
    color: rgba(255,255,255,0.92); display: flex; align-items: baseline;
    gap: 0; justify-content: center;
  }
  .name-age { font-size: 20px; color: rgba(255,255,255,0.35); font-weight: 300; margin-left: 2px; }
  .tagline {
    font-size: 14px; font-weight: 300; color: rgba(255,255,255,0.28);
    font-style: italic; max-width: 260px; line-height: 1.5;
  }
  .live-bpm-pill {
    display: flex; align-items: center; gap: 7px;
    background: rgba(255,107,107,0.08); border: 1px solid rgba(255,107,107,0.2);
    border-radius: 100px; padding: 6px 14px; font-size: 13px;
  }
  .live-dot {
    width: 6px; height: 6px; background: #FF6B6B; border-radius: 50%;
    box-shadow: 0 0 6px rgba(255,107,107,0.8);
    animation: dot-pulse 1.1s ease-in-out infinite; flex-shrink: 0;
  }
  @keyframes dot-pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0.7; } }
  .live-val { font-size: 16px; font-weight: 500; font-variant-numeric: tabular-nums; color: rgba(255,107,107,0.9); }
  .live-unit { font-size: 11px; font-weight: 400; color: rgba(255,255,255,0.3); letter-spacing: 0.04em; }
  .avatar-wave { opacity: 0.7; }

  /* ── STATS GRID ──────────────────────────────────── */
  .stats-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
    opacity: 0; transform: translateY(14px);
    transition: opacity 0.5s ease, transform 0.5s ease;
  }
  .stats-grid.visible { opacity: 1; transform: translateY(0); }
  .stat-card {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 16px; padding: 18px 12px; text-align: center;
    display: flex; flex-direction: column; gap: 4px;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
    opacity: 0; animation: stat-appear 0.4s ease forwards;
    transition: background 0.2s ease, border-color 0.2s ease;
  }
  .stat-card:hover { background: rgba(255,255,255,0.06); border-color: rgba(255,107,107,0.15); }
  @keyframes stat-appear { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .stats-grid.visible .stat-card { animation: stat-appear 0.4s ease forwards; }
  .stat-val { font-size: 30px; font-weight: 200; font-variant-numeric: tabular-nums; line-height: 1; }
  .stat-label { font-size: 11px; font-weight: 500; letter-spacing: 0.06em; color: rgba(255,255,255,0.6); }
  .stat-sub { font-size: 9px; font-weight: 400; color: rgba(255,255,255,0.2); letter-spacing: 0.03em; }
  .grad-text {
    background: var(--grad-text, linear-gradient(90deg, #FF6B6B, #E81F8C 40%, #7B35DE));
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }

  /* ── SECTION CARDS ──────────────────────────────── */
  .section-card {
    background: rgba(255,255,255,0.035); border: 1px solid rgba(255,255,255,0.07);
    border-radius: 18px; padding: 18px;
    backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  }
  .section-row { display: flex; align-items: center; gap: 14px; }
  .section-row-left { display: flex; align-items: center; gap: 14px; flex: 1; min-width: 0; }
  .section-icon {
    width: 38px; height: 38px; border-radius: 12px;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .section-title-text { font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.82); margin-bottom: 3px; }
  .section-desc { font-size: 11px; font-weight: 300; color: rgba(255,255,255,0.28); }

  /* ── TOGGLE ──────────────────────────────────────── */
  .toggle {
    width: 48px; height: 27px; border-radius: 100px;
    background: rgba(255,255,255,0.1); border: 1.5px solid rgba(255,255,255,0.1);
    position: relative; cursor: pointer;
    transition: background 0.25s ease, border-color 0.25s ease; flex-shrink: 0;
  }
  .toggle.on {
    background: linear-gradient(90deg, #FF6B6B, #E81F8C);
    border-color: transparent; box-shadow: 0 0 16px rgba(232,31,140,0.35);
  }
  .toggle-thumb {
    position: absolute; top: 3px; left: 3px; width: 19px; height: 19px;
    border-radius: 50%; background: rgba(255,255,255,0.7);
    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.25s ease;
    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  }
  .toggle.on .toggle-thumb { transform: translateX(21px); background: white; }

  /* ── GDPR CARD ──────────────────────────────────── */
  .gdpr-card { border-color: rgba(74,222,128,0.1); background: rgba(74,222,128,0.03); }
  .gdpr-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 12px; }
  .shield-icon {
    width: 38px; height: 38px; border-radius: 12px;
    background: rgba(74,222,128,0.08); border: 1px solid rgba(74,222,128,0.15);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .gdpr-title { font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.82); margin-bottom: 4px; }
  .gdpr-badge {
    display: inline-block; font-size: 9px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
    color: rgba(74,222,128,0.85); background: rgba(74,222,128,0.1); border: 1px solid rgba(74,222,128,0.2);
    border-radius: 100px; padding: 2px 8px;
  }
  .gdpr-body { font-size: 12px; font-weight: 300; line-height: 1.7; color: rgba(255,255,255,0.35); margin-bottom: 12px; }
  .gdpr-link {
    display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500;
    color: rgba(74,222,128,0.7); text-decoration: none; transition: color 0.2s ease;
  }
  .gdpr-link:hover { color: rgba(74,222,128,0.95); }
  .consent-status {
    display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 400;
    color: rgba(74,222,128,0.75); padding: 6px 10px; background: rgba(74,222,128,0.06);
    border: 1px solid rgba(74,222,128,0.12); border-radius: 100px; width: fit-content;
    letter-spacing: 0.02em; margin-bottom: 12px;
  }
  .consent-status-none { color: rgba(255,100,100,0.65); background: rgba(255,100,100,0.05); border-color: rgba(255,100,100,0.12); }

  /* ── ACTION LIST ─────────────────────────────────── */
  .action-list { display: flex; flex-direction: column; gap: 0; }
  .action-row {
    display: flex; align-items: center; gap: 12px; padding: 12px 0;
    background: none; border: none; cursor: pointer; color: rgba(255,255,255,0.6);
    font-family: inherit; font-size: 14px; font-weight: 400;
    width: 100%; text-align: left; transition: color 0.2s ease;
  }
  .action-row:hover { color: rgba(255,255,255,0.88); }
  .action-row svg:first-child { flex-shrink: 0; color: rgba(255,255,255,0.35); }
  .action-row span { flex: 1; }
  .row-arrow { color: rgba(255,255,255,0.2); transition: transform 0.2s ease; flex-shrink: 0; }
  .action-row:hover .row-arrow { transform: translateX(2px); color: rgba(255,255,255,0.4); }
  .danger-row { color: rgba(255,100,100,0.6); }
  .danger-row:hover { color: rgba(255,100,100,0.9); }
  .action-divider { height: 1px; background: rgba(255,255,255,0.05); }
  .version-note { text-align: center; font-size: 11px; color: rgba(255,255,255,0.14); padding: 8px; letter-spacing: 0.03em; }

  .demo-cta-card { text-align: center; padding: 24px 20px; }
  .demo-cta-lead { font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.75); margin-bottom: 8px; }
  .demo-cta-sub  { font-size: 13px; font-weight: 300; color: rgba(255,255,255,0.38); line-height: 1.6; margin-bottom: 20px; }
  .demo-cta-btn  {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 11px 22px;
    background: linear-gradient(135deg, #FF6B6B, #E81F8C 50%, #7B35DE);
    border-radius: 100px; font-size: 14px; font-weight: 500; color: white;
    text-decoration: none;
    transition: opacity 0.2s, transform 0.2s;
    box-shadow: 0 0 24px rgba(255,107,107,0.2);
  }
  .demo-cta-btn:hover { opacity: 0.88; transform: translateY(-1px); }

  .demo-exit-link {
    display: block;
    margin-top: 14px;
    font-size: 12px;
    color: rgba(255,255,255,0.25);
    text-decoration: none;
    transition: color 0.15s;
  }
  .demo-exit-link:hover { color: rgba(255,255,255,0.5); }

  /* ── EDIT SHEET ──────────────────────────────────── */
  .sheet-backdrop {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(7,7,16,0.7); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
    display: flex; align-items: flex-end; justify-content: center;
    animation: fade-in 0.2s ease;
  }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }

  .sheet {
    width: 100%; max-width: 520px; max-height: 92svh;
    background: rgba(14,14,28,0.98); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 24px 24px 0 0; display: flex; flex-direction: column;
    animation: slide-up 0.3s cubic-bezier(0.16,1,0.3,1);
    box-shadow: 0 -24px 80px rgba(0,0,0,0.5);
  }
  @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }

  .sheet-handle {
    width: 36px; height: 4px; border-radius: 2px; background: rgba(255,255,255,0.15);
    margin: 12px auto 0;
  }
  .sheet-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 20px 12px; border-bottom: 1px solid rgba(255,255,255,0.06);
  }
  .sheet-title {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 20px; font-weight: 400; color: rgba(255,255,255,0.9);
  }
  .sheet-close {
    width: 32px; height: 32px; border-radius: 50%; border: none;
    background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background 0.2s ease, color 0.2s ease;
  }
  .sheet-close:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.85); }

  .sheet-body {
    overflow-y: auto; padding: 20px 20px 32px;
    display: flex; flex-direction: column; gap: 20px;
    overscroll-behavior: contain;
  }

  /* ── FORM FIELDS ─────────────────────────────────── */
  .field { display: flex; flex-direction: column; gap: 8px; }
  .field-label {
    font-size: 12px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase;
    color: rgba(255,255,255,0.35);
  }
  .field-input {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px; padding: 12px 14px;
    font-family: inherit; font-size: 15px; font-weight: 300; color: rgba(255,255,255,0.88);
    outline: none; transition: border-color 0.2s ease;
    appearance: none; -webkit-appearance: none;
  }
  .field-input:focus { border-color: rgba(255,107,107,0.5); }
  .field-input::placeholder { color: rgba(255,255,255,0.2); }
  .field-textarea { resize: none; line-height: 1.6; }
  .field-hint { font-size: 11px; color: rgba(255,255,255,0.22); margin: 0; }
  .field-error { font-size: 12px; color: rgba(255,100,100,0.8); margin: 0; }

  /* date input light styling */
  .field-input[type="date"] { color-scheme: dark; }

  /* ── CHIPS ───────────────────────────────────────── */
  .chip-row { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip {
    padding: 8px 16px; border-radius: 100px;
    border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04);
    font-family: inherit; font-size: 13px; font-weight: 400;
    color: rgba(255,255,255,0.5); cursor: pointer;
    transition: all 0.15s ease;
  }
  .chip:hover { border-color: rgba(255,107,107,0.3); color: rgba(255,255,255,0.75); }
  .chip.active {
    background: linear-gradient(135deg, rgba(255,107,107,0.2), rgba(123,53,222,0.2));
    border-color: rgba(255,107,107,0.5); color: rgba(255,255,255,0.9);
    box-shadow: 0 0 12px rgba(255,107,107,0.15);
  }

  /* ── AGE RANGE ───────────────────────────────────── */
  .age-row { display: flex; align-items: center; gap: 12px; }
  .age-input-wrap { display: flex; flex-direction: column; gap: 5px; flex: 1; }
  .age-sub { font-size: 11px; color: rgba(255,255,255,0.25); }
  .age-input { text-align: center; }
  .age-dash { color: rgba(255,255,255,0.25); font-size: 18px; flex-shrink: 0; margin-top: 18px; }

  /* ── LOCATION ────────────────────────────────────── */
  .location-row { display: flex; gap: 10px; align-items: stretch; }
  .location-input { flex: 1; min-width: 0; font-family: 'DM Mono', monospace, inherit; letter-spacing: 0.1em; }
  .location-btn {
    display: flex; align-items: center; gap: 7px; padding: 0 16px;
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px; font-family: inherit; font-size: 13px; font-weight: 400;
    color: rgba(255,255,255,0.55); cursor: pointer; white-space: nowrap;
    transition: all 0.2s ease;
  }
  .location-btn:hover:not(:disabled) { background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.85); }
  .location-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── SAVE BUTTON ─────────────────────────────────── */
  .save-btn {
    width: 100%; padding: 16px; border-radius: 100px; border: none; cursor: pointer;
    background: linear-gradient(135deg, #FF6B6B, #E81F8C 50%, #7B35DE);
    font-family: inherit; font-size: 15px; font-weight: 500; color: white;
    transition: opacity 0.2s ease, transform 0.15s ease;
    box-shadow: 0 4px 24px rgba(232,31,140,0.3);
  }
  .save-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
  .save-btn:active:not(:disabled) { transform: translateY(0); }
  .save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .save-error { font-size: 13px; color: rgba(255,100,100,0.85); text-align: center; }
  .save-ok { font-size: 13px; color: rgba(74,222,128,0.85); text-align: center; }

  /* ── SPINNER ─────────────────────────────────────── */
  .spinner {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.2); border-top-color: rgba(255,255,255,0.7);
    animation: spin 0.7s linear infinite; flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── WITHDRAW / DELETE MODALS ────────────────────── */
  .withdraw-panel {
    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 20px; padding: 28px 24px 24px; max-width: 360px; width: calc(100% - 40px);
    display: flex; flex-direction: column; gap: 14px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.6);
    margin-bottom: 40px;
    animation: modal-pop 0.25s cubic-bezier(0.16,1,0.3,1);
  }
  @keyframes modal-pop { from { opacity: 0; transform: scale(0.95) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .withdraw-icon {
    display: flex; align-items: center; justify-content: center;
    width: 52px; height: 52px; border-radius: 16px;
    background: rgba(255,100,100,0.07); border: 1px solid rgba(255,100,100,0.15);
    margin: 0 auto;
  }
  .withdraw-title {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 22px; font-weight: 400; color: rgba(255,255,255,0.9); text-align: center;
  }
  .withdraw-body { font-size: 13px; font-weight: 300; line-height: 1.65; color: rgba(255,255,255,0.45); text-align: center; }
  .withdraw-body strong { color: rgba(255,255,255,0.75); font-weight: 500; }
  .withdraw-actions { display: flex; gap: 10px; margin-top: 4px; }
  .withdraw-cancel {
    flex: 1; padding: 12px; border-radius: 100px;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    font-family: inherit; font-size: 13px; font-weight: 500;
    color: rgba(255,255,255,0.65); cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .withdraw-cancel:hover { background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.85); }
  .withdraw-confirm {
    flex: 1; padding: 12px; border-radius: 100px;
    background: rgba(255,80,80,0.12); border: 1px solid rgba(255,80,80,0.22);
    font-family: inherit; font-size: 13px; font-weight: 500;
    color: rgba(255,100,100,0.85); cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }
  .withdraw-confirm:hover:not(:disabled) { background: rgba(255,80,80,0.2); border-color: rgba(255,80,80,0.35); color: rgba(255,120,120,1); }
  .withdraw-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

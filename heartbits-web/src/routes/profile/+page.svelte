<script lang="ts">
  import BottomNav from '$lib/components/BottomNav.svelte';
  import HeartLogo from '$lib/components/HeartLogo.svelte';
</script>

<svelte:head>
  <title>Profile — HeartBits</title>
</svelte:head>

<div class="profile-page">
  <header class="page-header">
    <div class="header-inner">
      <HeartLogo size={28} />
      <h1>Profile</h1>
    </div>
  </header>

  <div class="profile-body">
    <div class="avatar-section">
      <div class="avatar">
        <span>Y</span>
      </div>
      <h2>You</h2>
      <p class="tagline">Your heart is your identity.</p>
    </div>

    <div class="stats-row">
      <div class="stat">
        <div class="stat-val grad-text">72</div>
        <div class="stat-label">avg BPM</div>
      </div>
      <div class="stat">
        <div class="stat-val grad-text">2</div>
        <div class="stat-label">bonds</div>
      </div>
      <div class="stat">
        <div class="stat-val grad-text">14</div>
        <div class="stat-label">beats sent</div>
      </div>
    </div>
  </div>
</div>

<BottomNav />

<style>
  .profile-page {
    min-height: 100svh;
    padding-bottom: calc(var(--nav-h, 72px) + 24px);
  }

  .page-header {
    position: sticky;
    top: 0;
    background: rgba(7, 7, 16, 0.92);
    backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(255,255,255,0.06);
    z-index: 10;
    padding: 0 24px;
  }

  .header-inner {
    max-width: 600px;
    margin: 0 auto;
    height: 64px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-inner h1 {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 22px;
    font-weight: 400;
    color: rgba(255,255,255,0.9);
  }

  .profile-body {
    max-width: 400px;
    margin: 0 auto;
    padding: 48px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 40px;
  }

  .avatar-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .avatar {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(255,107,107,0.2), rgba(123,53,222,0.4));
    border: 1.5px solid rgba(255,107,107,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 4px;
  }

  .avatar span {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 40px;
    font-weight: 400;
    background: linear-gradient(135deg, #FF6B6B, #7B35DE);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .avatar-section h2 {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 28px;
    font-weight: 400;
    color: rgba(255,255,255,0.9);
  }

  .tagline {
    font-size: 14px;
    font-weight: 300;
    color: rgba(255,255,255,0.3);
    font-style: italic;
  }

  .stats-row {
    display: flex;
    gap: 32px;
    width: 100%;
    justify-content: center;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .stat-val {
    font-size: 32px;
    font-weight: 200;
    font-variant-numeric: tabular-nums;
  }

  .stat-label {
    font-size: 11px;
    font-weight: 400;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.25);
  }
</style>

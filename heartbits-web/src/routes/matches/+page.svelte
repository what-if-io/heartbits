<script lang="ts">
  import BottomNav from '$lib/components/BottomNav.svelte';
  import HeartLogo from '$lib/components/HeartLogo.svelte';

  interface Match {
    name: string;
    matchedAt: string;
    bpm: number;
    online: boolean;
  }

  const matches: Match[] = [
    { name: 'Ela',  matchedAt: '2 days ago', bpm: 71, online: true },
    { name: 'Mia',  matchedAt: '1 week ago', bpm: 0,  online: false },
  ];

  const colors: Record<string, string> = {
    Ela: '#FF6B6B',
    Mia: '#7B35DE',
  };

  function getColor(name: string): string {
    return colors[name] ?? '#E81F8C';
  }
</script>

<svelte:head>
  <title>Your Bonds — HeartBits</title>
</svelte:head>

<div class="matches-page">
  <header class="page-header">
    <div class="header-inner">
      <div class="header-title">
        <HeartLogo size={28} />
        <h1>Your bonds</h1>
      </div>
      <span class="count">{matches.length}</span>
    </div>
  </header>

  <div class="match-list">
    {#if matches.length === 0}
      <div class="empty-state">
        <p>No bonds yet. Go discover someone.</p>
        <a href="/discover" class="btn-link">Start discovering →</a>
      </div>
    {:else}
      {#each matches as match}
        <a href="/bond/{match.name.toLowerCase()}" class="match-row">
          <!-- Avatar -->
          <div class="avatar" style="background: linear-gradient(135deg, {getColor(match.name)}30, {getColor(match.name)}70)">
            <span style="color: {getColor(match.name)}">{match.name[0]}</span>
            {#if match.online}
              <div class="online-dot"></div>
            {/if}
          </div>

          <!-- Info -->
          <div class="match-info">
            <div class="match-name">{match.name}</div>
            <div class="match-meta">matched {match.matchedAt}</div>
          </div>

          <!-- BPM badge (online only) -->
          {#if match.online}
            <div class="bpm-badge">
              <span class="live-dot"></span>
              <span class="bpm-num" style="color: {getColor(match.name)}">{match.bpm}</span>
              <span class="bpm-unit">bpm</span>
            </div>
          {:else}
            <div class="offline-badge">offline</div>
          {/if}

          <!-- Chevron -->
          <svg class="chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
      {/each}
    {/if}
  </div>
</div>

<BottomNav />

<style>
  .matches-page {
    min-height: 100svh;
    padding-bottom: calc(var(--nav-h, 72px) + 24px);
  }

  .page-header {
    position: sticky;
    top: 0;
    background: rgba(7, 7, 16, 0.92);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
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
    justify-content: space-between;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .header-title h1 {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 22px;
    font-weight: 400;
    color: rgba(255,255,255,0.9);
  }

  .count {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: rgba(255,107,107,0.15);
    color: rgba(255,107,107,0.9);
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .match-list {
    max-width: 600px;
    margin: 0 auto;
    padding: 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .empty-state {
    text-align: center;
    padding: 80px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    color: rgba(255,255,255,0.4);
    font-size: 15px;
  }

  .btn-link {
    color: var(--coral);
    font-size: 14px;
    text-decoration: none;
    font-weight: 500;
  }

  .match-row {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    border-radius: 16px;
    background: rgba(255,255,255,0.02);
    border: 1px solid transparent;
    text-decoration: none;
    color: inherit;
    transition: background 0.2s ease, border-color 0.2s ease;
    cursor: pointer;
  }

  .match-row:hover {
    background: rgba(255,255,255,0.05);
    border-color: rgba(255,255,255,0.07);
  }

  .avatar {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    flex-shrink: 0;
  }

  .avatar span {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 22px;
    font-weight: 400;
    line-height: 1;
  }

  .online-dot {
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 10px;
    height: 10px;
    background: #4ADE80;
    border-radius: 50%;
    border: 2px solid #070710;
    box-shadow: 0 0 6px #4ADE80;
  }

  .match-info {
    flex: 1;
    min-width: 0;
  }

  .match-name {
    font-family: 'DM Serif Display', Georgia, serif;
    font-size: 18px;
    font-weight: 400;
    color: rgba(255,255,255,0.9);
    margin-bottom: 3px;
  }

  .match-meta {
    font-size: 12px;
    color: rgba(255,255,255,0.3);
    font-weight: 400;
  }

  .bpm-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    background: rgba(255,255,255,0.04);
    border-radius: 100px;
    padding: 5px 10px;
    border: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }

  .live-dot {
    width: 5px;
    height: 5px;
    background: #4ADE80;
    border-radius: 50%;
    box-shadow: 0 0 4px #4ADE80;
    animation: pulse-live 1.2s ease-in-out infinite;
  }

  @keyframes pulse-live {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.6); }
  }

  .bpm-num {
    font-size: 14px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }

  .bpm-unit {
    font-size: 10px;
    color: rgba(255,255,255,0.3);
    font-weight: 400;
    letter-spacing: 0.04em;
  }

  .offline-badge {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.2);
    background: rgba(255,255,255,0.04);
    border-radius: 100px;
    padding: 5px 10px;
    border: 1px solid rgba(255,255,255,0.06);
    flex-shrink: 0;
  }

  .chevron {
    color: rgba(255,255,255,0.2);
    flex-shrink: 0;
  }

  .match-row:hover .chevron {
    color: rgba(255,255,255,0.4);
  }
</style>

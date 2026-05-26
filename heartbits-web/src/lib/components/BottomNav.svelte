<script lang="ts">
  import { page } from '$app/stores';

  let currentPath = $derived($page.url.pathname);
</script>

<nav class="bottom-nav">
  <a href="/discover" class="nav-item" class:active={currentPath.startsWith('/discover')}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Pulse / heartbeat icon -->
      <path d="M2 12H5L7 6L10 18L13 9L15 14L17 12H22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span>Discover</span>
  </a>

  <a href="/matches" class="nav-item" class:active={currentPath.startsWith('/matches') || currentPath.startsWith('/bond')}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Heart icon -->
      <path d="M12 21C12 21 3 14.5 3 8.5C3 5.42 5.42 3 8.5 3C10.07 3 11.48 3.68 12 4.5C12.52 3.68 13.93 3 15.5 3C18.58 3 21 5.42 21 8.5C21 14.5 12 21 12 21Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span>Bonds</span>
  </a>

  <a href="/profile" class="nav-item" class:active={currentPath.startsWith('/profile')}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- Person icon -->
      <circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8"/>
      <path d="M4 20C4 17.2 7.58 15 12 15C16.42 15 20 17.2 20 20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
    <span>Profile</span>
  </a>
</nav>

<style>
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: var(--nav-h, 72px);
    background: rgba(7, 7, 16, 0.92);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: space-around;
    padding: 0 8px;
    padding-bottom: env(safe-area-inset-bottom, 0);
    z-index: 100;
  }

  .nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px 20px;
    border-radius: 12px;
    color: rgba(255, 255, 255, 0.35);
    transition: color 0.2s ease;
    text-decoration: none;
  }

  .nav-item:hover {
    color: rgba(255, 255, 255, 0.65);
  }

  .nav-item.active {
    color: #FF6B6B;
  }

  .nav-item.active svg {
    filter: drop-shadow(0 0 6px rgba(255, 107, 107, 0.5));
  }

  span {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
</style>

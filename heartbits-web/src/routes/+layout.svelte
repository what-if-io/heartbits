<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import BottomNav from '$lib/components/BottomNav.svelte';

  interface Props {
    children: import('svelte').Snippet;
    data: import('./$types').LayoutData;
  }

  let { children, data }: Props = $props();

  const NO_NAV_PREFIXES = ['/', '/auth/', '/about', '/privacy', '/terms', '/pitch'];

  let showNav = $derived(
    (!!data.user || !!data.isDemo) &&
      !NO_NAV_PREFIXES.some((p) =>
        p === '/'
          ? $page.url.pathname === '/'
          : $page.url.pathname.startsWith(p)
      )
  );

  let showDemoBanner = $derived(
    data.isDemo && !$page.url.pathname.startsWith('/auth')
  );

  $effect(() => {
    document.documentElement.style.setProperty(
      '--demo-banner-h',
      (showDemoBanner && showNav) ? '44px' : '0px'
    );
  });
</script>

{@render children()}

{#if showDemoBanner}
  <div class="demo-banner" style:bottom={showNav ? 'var(--nav-h, 72px)' : '0'}>
    <span class="demo-pill">Demo</span>
    <span class="demo-text">Exploring HeartBits in demo mode</span>
    <a href="/auth/initiate?next=/discover" class="demo-cta">Create account →</a>
  </div>
{/if}

{#if showNav}
  <BottomNav />
{/if}

<style>
  .demo-banner {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 10px 20px;
    background: rgba(7, 7, 16, 0.92);
    border-top: 1px solid rgba(255, 107, 107, 0.25);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    font-size: 13px;
  }

  .demo-pill {
    background: linear-gradient(135deg, #ff6b6b, #e81f8c);
    color: white;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 2px 8px;
    border-radius: 100px;
    flex-shrink: 0;
  }

  .demo-text {
    color: rgba(255, 255, 255, 0.5);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .demo-cta {
    color: #ff6b6b;
    text-decoration: none;
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
    transition: color 0.15s ease;
  }

  .demo-cta:hover {
    color: #ff8c8c;
  }
</style>

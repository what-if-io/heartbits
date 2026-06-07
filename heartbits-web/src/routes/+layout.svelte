<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import { m } from '$lib/paraglide/messages.js';

  interface Props {
    children: import('svelte').Snippet;
    data: import('./$types').LayoutData;
  }

  let { children, data }: Props = $props();

  // Self-referencing canonical (SSR-correct, query/hash stripped) for every page.
  let canonical = $derived(`${$page.url.origin}${$page.url.pathname}`);

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

<svelte:head>
  <link rel="canonical" href={canonical} />
</svelte:head>

{@render children()}

{#if showDemoBanner}
  <div class="demo-banner" style:bottom={showNav ? 'var(--nav-h, 72px)' : '0'}>
    <span class="demo-pill">{m.demo_pill()}</span>
    <span class="demo-text">{m.demo_exploring()}</span>
    <a href="/" class="demo-cta">{m.demo_join_waitlist()}</a>
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
    display: inline-flex;
    align-items: center;
    padding: 7px 16px;
    background: linear-gradient(135deg, #ff6b6b, #e81f8c 50%, #7b35de);
    color: #fff;
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    border-radius: 100px;
    white-space: nowrap;
    flex-shrink: 0;
    box-shadow: 0 0 20px rgba(255,107,107,0.2);
    transition: opacity 0.2s ease, transform 0.2s ease;
  }

  .demo-cta:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }
</style>

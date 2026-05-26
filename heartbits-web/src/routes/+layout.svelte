<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';

  interface Props {
    children: import('svelte').Snippet;
  }

  let { children }: Props = $props();

  // Landing page at '/' gets no nav
  let isLanding = $derived($page.url.pathname === '/');
</script>

{@render children()}

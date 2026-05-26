<script lang="ts">
  interface Props {
    size?: number;
    animated?: boolean;
  }

  let { size = 48, animated = false }: Props = $props();

  // Approximate path length for animation
  const pathLength = 320;
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 108 108"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  class="heart-logo"
  class:animated
>
  <defs>
    <linearGradient id="heart-grad-{size}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#FF6B6B" />
      <stop offset="50%" stop-color="#E81F8C" />
      <stop offset="100%" stop-color="#7B35DE" />
    </linearGradient>
  </defs>
  <path
    d="M10,64 L27,64 C28,64 29,57 32,57 C35,57 36,64 37,64 L38,70 L43,32 L47,74
       C49,69 52,64 56,64 C58,64 60,58 62,57 C64,56 66,64 69,64
       C70,58 73,40 79,38 C84,36 84,50 84,54 C84,50 84,36 89,40
       C95,44 100,60 101,65"
    stroke="url(#heart-grad-{size})"
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    fill="none"
    style="stroke-dasharray: {pathLength}; stroke-dashoffset: {animated ? pathLength : 0}"
  />
</svg>

<style>
  .heart-logo {
    display: block;
    flex-shrink: 0;
  }

  .heart-logo.animated path {
    animation: draw-heart 1.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  @keyframes draw-heart {
    from {
      stroke-dashoffset: 320;
    }
    to {
      stroke-dashoffset: 0;
    }
  }
</style>

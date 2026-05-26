<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  interface Props {
    bpm?: number;
    color?: string;
    width?: number;
    height?: number;
    useGradient?: boolean;
  }

  let {
    bpm = 72,
    color = '#FF6B6B',
    width = 300,
    height = 80,
    useGradient = true
  }: Props = $props();

  let canvas: HTMLCanvasElement;
  let animFrameId: number;
  let offset = 0;

  // ECG waveform generator — produces one beat cycle as y-values
  function ecgSample(t: number): number {
    // t in [0,1] = one full cardiac cycle
    const mid = height / 2;
    const scale = height * 0.38;

    // Flat baseline
    if (t < 0.08) return mid;
    // P-wave (small positive bump)
    if (t < 0.20) {
      const p = (t - 0.08) / 0.12;
      return mid - Math.sin(p * Math.PI) * scale * 0.18;
    }
    // PR segment
    if (t < 0.27) return mid;
    // Q wave (small negative dip)
    if (t < 0.30) {
      const q = (t - 0.27) / 0.03;
      return mid + Math.sin(q * Math.PI) * scale * 0.25;
    }
    // R wave (sharp tall spike — the defining ECG moment)
    if (t < 0.36) {
      const r = (t - 0.30) / 0.06;
      return mid - Math.sin(r * Math.PI) * scale;
    }
    // S wave (negative overshoot after R)
    if (t < 0.41) {
      const s = (t - 0.36) / 0.05;
      return mid + Math.sin(s * Math.PI) * scale * 0.3;
    }
    // ST segment
    if (t < 0.52) return mid;
    // T wave (gentle positive hump)
    if (t < 0.72) {
      const tw = (t - 0.52) / 0.20;
      return mid - Math.sin(tw * Math.PI) * scale * 0.35;
    }
    // TP segment (rest)
    return mid;
  }

  function draw() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = width;
    const h = height;

    ctx.clearRect(0, 0, w * dpr, h * dpr);

    // Speed: pixels per frame, proportional to BPM
    const pxPerFrame = (bpm / 60) * 1.4;
    offset = (offset + pxPerFrame) % w;

    // Beat cycle width in pixels (one full heartbeat)
    const beatWidth = (60 / bpm) * 80; // ~80px per second at 60fps

    // Build gradient
    let strokeStyle: string | CanvasGradient = color;
    if (useGradient) {
      const grad = ctx.createLinearGradient(0, 0, w * dpr, 0);
      grad.addColorStop(0, '#FF6B6B');
      grad.addColorStop(0.5, '#E81F8C');
      grad.addColorStop(1, '#7B35DE');
      strokeStyle = grad;
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Fade out at left edge
    const fadeWidth = 40;
    const gradFade = ctx.createLinearGradient(0, 0, fadeWidth, 0);
    gradFade.addColorStop(0, 'rgba(7,7,16,1)');
    gradFade.addColorStop(1, 'rgba(7,7,16,0)');

    ctx.beginPath();
    let started = false;
    for (let px = 0; px < w; px++) {
      // Map pixel to beat phase
      const phase = ((px + offset) % beatWidth) / beatWidth;
      const y = ecgSample(phase);
      if (!started) {
        ctx.moveTo(px, y);
        started = true;
      } else {
        ctx.lineTo(px, y);
      }
    }
    ctx.stroke();

    // Fade left edge
    ctx.fillStyle = gradFade;
    ctx.fillRect(0, 0, fadeWidth, h);

    ctx.restore();

    animFrameId = requestAnimationFrame(draw);
  }

  onMount(() => {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    draw();
  });

  onDestroy(() => {
    if (animFrameId) cancelAnimationFrame(animFrameId);
  });

  // React to prop changes
  $effect(() => {
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }
  });
</script>

<canvas bind:this={canvas} class="ecg-canvas"></canvas>

<style>
  .ecg-canvas {
    display: block;
  }
</style>

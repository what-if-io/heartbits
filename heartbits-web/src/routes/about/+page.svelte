<svelte:head>
  <title>About — HeartBits</title>
  <meta name="description" content="HeartBits is a dating app built around real human connection — your actual heartbeat." />
  <meta name="robots" content="index, follow" />
</svelte:head>

<div class="page">
  <div class="inner">
    <a href="/" class="back">← Back</a>
    <h1>About <em>HeartBits</em></h1>
    <p class="lead">Every other dating app asks you to swipe on a photo. We ask you to feel a heartbeat.</p>
    <p>HeartBits uses your device and wearable sensors to share your real-time heart rate with people you match with. The "like" is sending your heartbeat. The match is two people whose hearts reach out at the same moment.</p>
    <p>We're building something that feels more like biology and less like browsing.</p>
    <h2>The team</h2>
    <p>We're a small team obsessed with the idea that technology can create more human moments, not fewer.</p>
    <p>Questions? <a href="mailto:hello@what-if.io">hello@what-if.io</a></p>
  </div>
</div>

<style>
  .page { min-height: 100svh; padding: 80px 24px; }
  .inner { max-width: 640px; margin: 0 auto; }
  .back { font-size: 13px; color: rgba(255,255,255,0.35); text-decoration: none; display: block; margin-bottom: 48px; }
  .back:hover { color: rgba(255,255,255,0.6); }
  h1 { font-family: 'DM Serif Display', Georgia, serif; font-size: clamp(36px,6vw,56px); font-weight: 400; margin-bottom: 24px; line-height: 1.1; }
  h1 em { font-style: italic; background: linear-gradient(90deg,#FF6B6B,#7B35DE); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  h2 { font-family: 'DM Serif Display', Georgia, serif; font-size: 24px; font-weight: 400; margin: 40px 0 16px; color: rgba(255,255,255,0.85); }
  .lead { font-size: 18px; font-weight: 300; color: rgba(255,255,255,0.7); line-height: 1.7; margin-bottom: 24px; }
  p { font-size: 15px; font-weight: 300; color: rgba(255,255,255,0.45); line-height: 1.8; margin-bottom: 16px; }
  a { color: #FF6B6B; }
</style>

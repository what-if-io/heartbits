<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
</script>

<svelte:head>
  <title>{m.about_title()}</title>
  <meta name="description" content={m.about_meta_description()} />
  <meta name="robots" content="index, follow" />
</svelte:head>

<div class="page">
  <div class="inner">
    <a href="/" class="back">{m.about_back()}</a>
    <h1>{m.about_heading_pre()}<em>{m.about_heading_em()}</em></h1>
    <p class="lead">{m.about_lead()}</p>
    <p>{m.about_para1()}</p>
    <p>{m.about_para2()}</p>
    <h2>{m.about_team_heading()}</h2>
    <p>{m.about_team_para()}</p>
    <p>{m.about_questions_pre()}<a href="mailto:hello@what-if.io">hello@what-if.io</a></p>
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

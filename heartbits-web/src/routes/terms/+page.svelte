<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
</script>

<svelte:head>
  <title>{m.terms_title()}</title>
  <meta name="description" content={m.terms_meta_description()} />
  <meta name="robots" content="index, follow" />
</svelte:head>

<div class="page">
  <div class="inner">
    <a href="/" class="back">{m.terms_back()}</a>
    <h1>{m.terms_heading()}</h1>
    <p class="meta">{m.terms_meta()}</p>

    <p>{m.terms_intro_pre()}<a href="/privacy">{m.terms_intro_link()}</a>{m.terms_intro_post()}</p>

    <h2>{m.terms_s1_title()}</h2>
    <p>{m.terms_s1_body()}</p>

    <h2>{m.terms_s2_title()}</h2>
    <p>{m.terms_s2_body()}</p>

    <h2>{m.terms_s3_title()}</h2>
    <p>{m.terms_s3_body()}</p>

    <h2>{m.terms_s4_title()}</h2>
    <p>{m.terms_s4_intro()}</p>
    <ul>
      <li>{m.terms_s4_li1()}</li>
      <li>{m.terms_s4_li2()}</li>
      <li>{m.terms_s4_li3()}</li>
      <li>{m.terms_s4_li4()}</li>
      <li>{m.terms_s4_li5()}</li>
      <li>{m.terms_s4_li6()}</li>
      <li>{m.terms_s4_li7()}</li>
      <li>{m.terms_s4_li8()}</li>
    </ul>
    <p>{m.terms_s4_outro()}</p>

    <h2>{m.terms_s5_title()}</h2>
    <p>{m.terms_s5_body()}</p>

    <h2>{m.terms_s6_title()}</h2>
    <p>{m.terms_s6_body()}</p>

    <h2>{m.terms_s7_title()}</h2>
    <p>{m.terms_s7_body()}</p>

    <h2>{m.terms_s8_title()}</h2>
    <p>{m.terms_s8_body()}</p>

    <h2>{m.terms_s9_title()}</h2>
    <p>{m.terms_s9_body()}</p>

    <h2>{m.terms_s10_title()}</h2>
    <p>{m.terms_s10_body()}</p>

    <h2>{m.terms_s11_title()}</h2>
    <p>{m.terms_s11_body()}</p>

    <h2>{m.terms_s12_title()}</h2>
    <p>{m.terms_s12_body_pre()}<a href="mailto:hello@what-if.io">hello@what-if.io</a></p>
  </div>
</div>

<style>
  .page { min-height: 100svh; padding: 80px 24px; }
  .inner { max-width: 680px; margin: 0 auto; }
  .back { font-size: 13px; color: rgba(255,255,255,0.35); text-decoration: none; display: block; margin-bottom: 48px; }
  .back:hover { color: rgba(255,255,255,0.6); }
  h1 { font-family: 'DM Serif Display', Georgia, serif; font-size: clamp(32px,5vw,48px); font-weight: 400; margin-bottom: 8px; }
  h2 { font-family: 'DM Serif Display', Georgia, serif; font-size: 20px; font-weight: 400; margin: 36px 0 12px; color: rgba(255,255,255,0.85); }
  .meta { font-size: 12px; color: rgba(255,255,255,0.25); margin-bottom: 48px; }
  p, li { font-size: 14px; font-weight: 300; color: rgba(255,255,255,0.45); line-height: 1.8; margin-bottom: 12px; }
  ul { padding-left: 20px; margin-bottom: 16px; }
  li { margin-bottom: 8px; }
  strong { color: rgba(255,255,255,0.7); font-weight: 500; }
  a { color: #FF6B6B; }
</style>

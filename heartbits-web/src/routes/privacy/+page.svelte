<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { localizeHref } from '$lib/paraglide/runtime';
</script>

<svelte:head>
  <title>{m.privacy_title()}</title>
  <meta name="description" content={m.privacy_meta_description()} />
  <meta name="robots" content="index, follow" />
</svelte:head>

<div class="page">
  <div class="inner">
    <a href={localizeHref('/')} class="back">{m.privacy_back()}</a>
    <h1>{m.privacy_heading()}</h1>
    <p class="meta">{m.privacy_meta()}</p>

    <p>{m.privacy_intro()}</p>

    <h2>{m.privacy_s1_title()}</h2>
    <p>{m.privacy_s1_body_pre()}<a href="mailto:privacy@what-if.io">privacy@what-if.io</a>{m.privacy_s1_body_post()}</p>

    <h2>{m.privacy_s2_title()}</h2>
    <ul>
      <li>{m.privacy_s2_li1()}</li>
      <li>{m.privacy_s2_li2()}</li>
      <li>{m.privacy_s2_li3()}</li>
      <li>{m.privacy_s2_li4()}</li>
      <li>{m.privacy_s2_li5()}</li>
      <li>{m.privacy_s2_li6()}</li>
      <li>{m.privacy_s2_li7()}</li>
    </ul>

    <h2>{m.privacy_s3_title()}</h2>
    <p>{m.privacy_s3_body()}</p>

    <h2>{m.privacy_s4_title()}</h2>
    <ul>
      <li>{m.privacy_s4_li1()}</li>
      <li>{m.privacy_s4_li2()}</li>
      <li>{m.privacy_s4_li3()}</li>
      <li>{m.privacy_s4_li4()}</li>
    </ul>

    <h2>{m.privacy_s5_title()}</h2>
    <p>{m.privacy_s5_body()}</p>

    <h2>{m.privacy_s6_title()}</h2>
    <ul>
      <li>{m.privacy_s6_li1()}</li>
      <li>{m.privacy_s6_li2()}</li>
      <li>{m.privacy_s6_li3()}</li>
      <li>{m.privacy_s6_li4()}</li>
      <li>{m.privacy_s6_li5()}</li>
    </ul>

    <h2>{m.privacy_s7_title()}</h2>
    <p>{m.privacy_s7_body()}</p>

    <h2>{m.privacy_s8_title()}</h2>
    <p>{m.privacy_s8_body()}</p>

    <h2>{m.privacy_s9_title()}</h2>
    <p>{m.privacy_s9_intro()}</p>
    <ul>
      <li>{m.privacy_s9_li1()}</li>
      <li>{m.privacy_s9_li2()}</li>
      <li>{m.privacy_s9_li3()}</li>
      <li>{m.privacy_s9_li4()}</li>
      <li>{m.privacy_s9_li5()}</li>
      <li>{m.privacy_s9_li6()}</li>
      <li>{m.privacy_s9_li7()}</li>
    </ul>
    <p>{m.privacy_s9_body_pre()}<a href="mailto:privacy@what-if.io">privacy@what-if.io</a>{m.privacy_s9_body_post()}</p>

    <h2>{m.privacy_s10_title()}</h2>
    <p>{m.privacy_s10_body()}</p>

    <h2>{m.privacy_s11_title()}</h2>
    <p>{m.privacy_s11_body()}</p>

    <h2>{m.privacy_s12_title()}</h2>
    <p>{m.privacy_s12_body()}</p>

    <h2>{m.privacy_s13_title()}</h2>
    <p>{m.privacy_s13_body()}</p>

    <h2>{m.privacy_s14_title()}</h2>
    <p>{m.privacy_s14_body_pre()}<a href="mailto:privacy@what-if.io">privacy@what-if.io</a></p>
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

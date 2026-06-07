<script lang="ts">
  import { m } from '$lib/paraglide/messages.js';
  import { localizeHref } from '$lib/paraglide/runtime';

  // Hidden during SSR/first paint to avoid a flash; the effect reveals it on the
  // client only if it hasn't been dismissed before. Not legally required (we use
  // only essential cookies) — purely a transparency/reassurance touch.
  let dismissed = $state(true);

  $effect(() => {
    dismissed = localStorage.getItem('hb_cookie_notice') === '1';
  });

  function dismiss() {
    localStorage.setItem('hb_cookie_notice', '1');
    dismissed = true;
  }
</script>

{#if !dismissed}
  <div class="cookie-notice" role="note">
    <span class="cn-text">
      {m.cookie_notice_text()}
      <a href={localizeHref('/privacy')}>{m.cookie_notice_learn()}</a>
    </span>
    <button class="cn-btn" onclick={dismiss}>{m.cookie_notice_dismiss()}</button>
  </div>
{/if}

<style>
  .cookie-notice {
    position: fixed;
    left: 16px;
    bottom: 16px;
    z-index: 300;
    max-width: 360px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 14px;
    background: rgba(14, 14, 26, 0.92);
    border: 1px solid rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
    font-size: 13px;
    color: rgba(255, 255, 255, 0.6);
  }
  .cn-text a {
    color: rgba(255, 255, 255, 0.85);
    text-decoration: underline;
  }
  .cn-btn {
    flex-shrink: 0;
    padding: 6px 14px;
    border-radius: 999px;
    border: none;
    background: linear-gradient(135deg, #ff6b6b, #e81f8c);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .cn-btn:hover { opacity: 0.9; }
  @media (max-width: 480px) {
    .cookie-notice { left: 12px; right: 12px; bottom: 12px; max-width: none; }
  }
</style>

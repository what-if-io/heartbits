<script lang="ts">
  import { locales, getLocale, setLocale, type Locale } from '$lib/paraglide/runtime';

  const NAMES: Record<string, string> = {
    en: 'English',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    it: 'Italiano',
    'pt-BR': 'Português (BR)',
    el: 'Ελληνικά',
    zh: '中文',
    ja: '日本語',
    ko: '한국어',
    ru: 'Русский',
    tr: 'Türkçe',
    ro: 'Română'
  };
</script>

<label class="lang">
  <span class="sr-only">Language</span>
  <select value={getLocale()} onchange={(e) => setLocale(e.currentTarget.value as Locale)}>
    {#each locales as l}
      <option value={l}>{NAMES[l] ?? l}</option>
    {/each}
  </select>
</label>

<style>
  /* Ghost dropdown that matches the footer nav links (13px / 0.3 → 0.6),
     with a custom chevron, so it sits inline on the same baseline. */
  .lang {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  .lang select {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.3);
    font-family: inherit;
    font-size: 13px;
    line-height: 1;
    padding: 0 15px 0 0;
    margin: 0;
    cursor: pointer;
    transition: color 0.2s ease;
  }
  .lang select:hover { color: rgba(255, 255, 255, 0.6); }
  .lang::after {
    content: '';
    position: absolute;
    right: 2px;
    top: 50%;
    width: 6px;
    height: 6px;
    border-right: 1.5px solid rgba(255, 255, 255, 0.3);
    border-bottom: 1.5px solid rgba(255, 255, 255, 0.3);
    transform: translateY(-70%) rotate(45deg);
    pointer-events: none;
    transition: border-color 0.2s ease;
  }
  .lang:hover::after {
    border-right-color: rgba(255, 255, 255, 0.6);
    border-bottom-color: rgba(255, 255, 255, 0.6);
  }
  .lang option {
    background: #0e0e1a;
    color: #fff;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }
</style>

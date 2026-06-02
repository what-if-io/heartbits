<script lang="ts">
  import { locales, getLocale, setLocale, type Locale } from '$lib/paraglide/runtime';

  const NAMES: Record<string, string> = {
    en: 'English',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch'
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
  .lang select {
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 100px;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    padding: 6px 12px;
    cursor: pointer;
    transition: color 0.2s ease, border-color 0.2s ease;
  }
  .lang select:hover {
    color: rgba(255, 255, 255, 0.8);
    border-color: rgba(255, 255, 255, 0.25);
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

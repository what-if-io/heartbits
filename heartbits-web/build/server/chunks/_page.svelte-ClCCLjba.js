import { X as head, p as attr_style, ap as stringify, J as escape_html, o as attr_class, z as derived, ao as store_get, av as unsubscribe_stores } from './renderer-BQugRXev.js';
import { o as onDestroy, E as EcgWaveform } from './EcgWaveform-drqdWbYy.js';
import { B as BottomNav, p as page } from './BottomNav-BVVPSQzi.js';
import './root-D3lAp63A.js';
import './state.svelte-DZt6rt8f.js';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let id = derived(() => store_get($$store_subs ??= {}, "$page", page).params.id);
    let partnerName = derived(() => id() ? id().charAt(0).toUpperCase() + id().slice(1) : "Unknown");
    let yourBpm = 72;
    let connectionStatus = "connecting";
    let bpmInterval;
    let wsTimeout;
    onDestroy(() => {
      clearInterval(bpmInterval);
      clearTimeout(wsTimeout);
    });
    function formatBpm(bpm) {
      return Math.round(bpm).toString();
    }
    const partnerColors = {
      ela: "#FF6B6B",
      mia: "#7B35DE",
      zara: "#E81F8C",
      lena: "#FF8C42",
      kai: "#5B8FE8"
    };
    let partnerColor = derived(() => partnerColors[id()?.toLowerCase()] ?? "#FF6B6B");
    head("12a1lg6", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>${escape_html(partnerName())}'s heart — HeartBits</title>`);
      });
    });
    $$renderer2.push(`<div class="bond-page svelte-12a1lg6"><div class="ambient svelte-12a1lg6"${attr_style(`--partner-color: ${stringify(partnerColor())}`)}></div> <div class="partner-section svelte-12a1lg6"><div class="partner-header svelte-12a1lg6"><div class="avatar svelte-12a1lg6"${attr_style(`background: linear-gradient(135deg, ${stringify(partnerColor())}30, ${stringify(partnerColor())}70); border-color: ${stringify(partnerColor())}40`)}><span${attr_style(`color: ${stringify(partnerColor())}`)} class="svelte-12a1lg6">${escape_html(partnerName()[0])}</span></div> <div class="partner-identity svelte-12a1lg6"><h2 class="partner-name svelte-12a1lg6">${escape_html(partnerName())}</h2> <p class="partner-sub svelte-12a1lg6">their heart</p></div> <div${attr_class("status-pill svelte-12a1lg6", void 0, {
      "live": connectionStatus === "live",
      "offline": connectionStatus === "offline"
    })}><div class="status-dot svelte-12a1lg6"></div> <span class="svelte-12a1lg6">${escape_html("connecting…")}</span></div></div> <div class="waveform-large svelte-12a1lg6">`);
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<div class="flatline svelte-12a1lg6"><svg width="340" height="120" viewBox="0 0 340 120" fill="none" class="svelte-12a1lg6"><line x1="20" y1="60" x2="320" y2="60" stroke="rgba(255,255,255,0.12)" stroke-width="1.5" stroke-dasharray="6 4" class="svelte-12a1lg6"></line></svg></div>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="bpm-display svelte-12a1lg6"><div${attr_class("bpm-number svelte-12a1lg6", void 0, { "flatline-num": true })}${attr_style(`color: ${stringify("rgba(255,255,255,0.2)")}`)}>${escape_html("--")}</div> <div class="bpm-label svelte-12a1lg6">${escape_html("no signal")}</div></div></div> <div class="divider svelte-12a1lg6"><div class="divider-line svelte-12a1lg6"></div> <div class="divider-icon svelte-12a1lg6"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" class="svelte-12a1lg6"><path d="M12 21C12 21 3 14.5 3 8.5C3 5.42 5.42 3 8.5 3C10.07 3 11.48 3.68 12 4.5C12.52 3.68 13.93 3 15.5 3C18.58 3 21 5.42 21 8.5C21 14.5 12 21 12 21Z" stroke="url(#dv)" stroke-width="1.5" fill="none" stroke-linecap="round" class="svelte-12a1lg6"></path><defs class="svelte-12a1lg6"><linearGradient id="dv" x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse" class="svelte-12a1lg6"><stop stop-color="#FF6B6B" class="svelte-12a1lg6"></stop><stop offset="1" stop-color="#7B35DE" class="svelte-12a1lg6"></stop></linearGradient></defs></svg></div> <div class="divider-line svelte-12a1lg6"></div></div> <div class="your-section svelte-12a1lg6"><div class="your-header svelte-12a1lg6"><span class="your-label svelte-12a1lg6">your heart</span> <div class="bpm-mini svelte-12a1lg6"><span class="bpm-mini-num svelte-12a1lg6">${escape_html(formatBpm(yourBpm))}</span> <span class="bpm-mini-unit svelte-12a1lg6">BPM</span></div></div> <div class="waveform-small svelte-12a1lg6">`);
    EcgWaveform($$renderer2, {
      bpm: yourBpm,
      color: "#FF6B6B",
      width: 340,
      height: 72,
      useGradient: true
    });
    $$renderer2.push(`<!----></div></div></div> `);
    BottomNav($$renderer2);
    $$renderer2.push(`<!---->`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-ClCCLjba.js.map

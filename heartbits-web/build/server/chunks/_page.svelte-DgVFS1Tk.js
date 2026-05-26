import { X as head, J as escape_html, G as ensure_array_like, n as attr, ap as stringify, p as attr_style } from './renderer-BQugRXev.js';
import { B as BottomNav } from './BottomNav-BVVPSQzi.js';
import { H as HeartLogo } from './HeartLogo-CrmE0MdS.js';
import './root-D3lAp63A.js';
import './state.svelte-DZt6rt8f.js';

function _page($$renderer) {
  const matches = [
    { name: "Ela", matchedAt: "2 days ago", bpm: 71, online: true },
    { name: "Mia", matchedAt: "1 week ago", bpm: 0, online: false }
  ];
  const colors = { Ela: "#FF6B6B", Mia: "#7B35DE" };
  function getColor(name) {
    return colors[name] ?? "#E81F8C";
  }
  head("1whnkwe", $$renderer, ($$renderer2) => {
    $$renderer2.title(($$renderer3) => {
      $$renderer3.push(`<title>Your Bonds — HeartBits</title>`);
    });
  });
  $$renderer.push(`<div class="matches-page svelte-1whnkwe"><header class="page-header svelte-1whnkwe"><div class="header-inner svelte-1whnkwe"><div class="header-title svelte-1whnkwe">`);
  HeartLogo($$renderer, { size: 28 });
  $$renderer.push(`<!----> <h1 class="svelte-1whnkwe">Your bonds</h1></div> <span class="count svelte-1whnkwe">${escape_html(matches.length)}</span></div></header> <div class="match-list svelte-1whnkwe">`);
  if (matches.length === 0) {
    $$renderer.push("<!--[0-->");
    $$renderer.push(`<div class="empty-state svelte-1whnkwe"><p class="svelte-1whnkwe">No bonds yet. Go discover someone.</p> <a href="/discover" class="btn-link svelte-1whnkwe">Start discovering →</a></div>`);
  } else {
    $$renderer.push("<!--[-1-->");
    $$renderer.push(`<!--[-->`);
    const each_array = ensure_array_like(matches);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let match = each_array[$$index];
      $$renderer.push(`<a${attr("href", `/bond/${stringify(match.name.toLowerCase())}`)} class="match-row svelte-1whnkwe"><div class="avatar svelte-1whnkwe"${attr_style(`background: linear-gradient(135deg, ${stringify(getColor(match.name))}30, ${stringify(getColor(match.name))}70)`)}><span${attr_style(`color: ${stringify(getColor(match.name))}`)} class="svelte-1whnkwe">${escape_html(match.name[0])}</span> `);
      if (match.online) {
        $$renderer.push("<!--[0-->");
        $$renderer.push(`<div class="online-dot svelte-1whnkwe"></div>`);
      } else {
        $$renderer.push("<!--[-1-->");
      }
      $$renderer.push(`<!--]--></div> <div class="match-info svelte-1whnkwe"><div class="match-name svelte-1whnkwe">${escape_html(match.name)}</div> <div class="match-meta svelte-1whnkwe">matched ${escape_html(match.matchedAt)}</div></div> `);
      if (match.online) {
        $$renderer.push("<!--[0-->");
        $$renderer.push(`<div class="bpm-badge svelte-1whnkwe"><span class="live-dot svelte-1whnkwe"></span> <span class="bpm-num svelte-1whnkwe"${attr_style(`color: ${stringify(getColor(match.name))}`)}>${escape_html(match.bpm)}</span> <span class="bpm-unit svelte-1whnkwe">bpm</span></div>`);
      } else {
        $$renderer.push("<!--[-1-->");
        $$renderer.push(`<div class="offline-badge svelte-1whnkwe">offline</div>`);
      }
      $$renderer.push(`<!--]--> <svg class="chevron svelte-1whnkwe" width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="svelte-1whnkwe"></path></svg></a>`);
    }
    $$renderer.push(`<!--]-->`);
  }
  $$renderer.push(`<!--]--></div></div> `);
  BottomNav($$renderer);
  $$renderer.push(`<!---->`);
}

export { _page as default };
//# sourceMappingURL=_page.svelte-DgVFS1Tk.js.map

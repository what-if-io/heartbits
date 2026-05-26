import { o as attr_class, z as derived, ao as store_get, av as unsubscribe_stores, Q as getContext } from './renderer-BQugRXev.js';
import './root-D3lAp63A.js';
import './state.svelte-DZt6rt8f.js';

const getStores = () => {
  const stores$1 = getContext("__svelte__");
  return {
    /** @type {typeof page} */
    page: {
      subscribe: stores$1.page.subscribe
    },
    /** @type {typeof navigating} */
    navigating: {
      subscribe: stores$1.navigating.subscribe
    },
    /** @type {typeof updated} */
    updated: stores$1.updated
  };
};
const page = {
  subscribe(fn) {
    const store = getStores().page;
    return store.subscribe(fn);
  }
};
function BottomNav($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let currentPath = derived(() => store_get($$store_subs ??= {}, "$page", page).url.pathname);
    $$renderer2.push(`<nav class="bottom-nav svelte-oeh3u8"><a href="/discover"${attr_class("nav-item svelte-oeh3u8", void 0, { "active": currentPath().startsWith("/discover") })}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="svelte-oeh3u8"><path d="M2 12H5L7 6L10 18L13 9L15 14L17 12H22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg> <span class="svelte-oeh3u8">Discover</span></a> <a href="/matches"${attr_class("nav-item svelte-oeh3u8", void 0, {
      "active": currentPath().startsWith("/matches") || currentPath().startsWith("/bond")
    })}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="svelte-oeh3u8"><path d="M12 21C12 21 3 14.5 3 8.5C3 5.42 5.42 3 8.5 3C10.07 3 11.48 3.68 12 4.5C12.52 3.68 13.93 3 15.5 3C18.58 3 21 5.42 21 8.5C21 14.5 12 21 12 21Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path></svg> <span class="svelte-oeh3u8">Bonds</span></a> <a href="/profile"${attr_class("nav-item svelte-oeh3u8", void 0, { "active": currentPath().startsWith("/profile") })}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" class="svelte-oeh3u8"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.8"></circle><path d="M4 20C4 17.2 7.58 15 12 15C16.42 15 20 17.2 20 20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path></svg> <span class="svelte-oeh3u8">Profile</span></a></nav>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}

export { BottomNav as B, page as p };
//# sourceMappingURL=BottomNav-BVVPSQzi.js.map

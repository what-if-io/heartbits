import { K as head, k as attr_class, l as attr_style, a9 as stringify, z as escape_html, v as derived } from "../../../chunks/renderer.js";
import { E as EcgWaveform } from "../../../chunks/EcgWaveform.js";
import { B as BottomNav } from "../../../chunks/BottomNav.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    const people = [
      {
        name: "Ela",
        age: 28,
        distance: "2 km away",
        bpm: 72,
        color: "#FF6B6B"
      },
      {
        name: "Mia",
        age: 31,
        distance: "5 km away",
        bpm: 65,
        color: "#7B35DE"
      },
      {
        name: "Zara",
        age: 26,
        distance: "1 km away",
        bpm: 80,
        color: "#E81F8C"
      },
      {
        name: "Lena",
        age: 29,
        distance: "8 km away",
        bpm: 58,
        color: "#FF8C42"
      },
      {
        name: "Kai",
        age: 33,
        distance: "12 km away",
        bpm: 76,
        color: "#5B8FE8"
      }
    ];
    let currentIndex = 0;
    let transitioning = false;
    let sendingHeart = false;
    let person = derived(() => people[currentIndex]);
    function avatarGradient(p) {
      return `linear-gradient(135deg, ${p.color}40, ${p.color}90)`;
    }
    function avatarInitial(p) {
      return p.name[0];
    }
    head("b0xv90", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Discover — HeartBits</title>`);
      });
    });
    $$renderer2.push(`<div class="discover-page svelte-b0xv90">`);
    if (person()) {
      $$renderer2.push("<!--[1-->");
      $$renderer2.push(`<div${attr_class("profile-card svelte-b0xv90", void 0, {
        "exiting-pass": transitioning,
        "exiting-heart": transitioning
      })}><div class="avatar-wrap svelte-b0xv90"><div class="ring-outer svelte-b0xv90"${attr_style(`--person-color: ${stringify(person().color)}`)}><div class="ring-inner svelte-b0xv90"${attr_style(`--person-color: ${stringify(person().color)}`)}><div class="avatar svelte-b0xv90"${attr_style(`background: ${stringify(avatarGradient(person()))}`)}><span class="initial svelte-b0xv90">${escape_html(avatarInitial(person()))}</span></div></div></div> <div class="bpm-badge svelte-b0xv90"><span class="bpm-dot svelte-b0xv90"></span> <span class="bpm-val svelte-b0xv90"${attr_style(`color: ${stringify(person().color)}`)}>${escape_html(person().bpm)}</span> <span class="bpm-unit svelte-b0xv90">BPM</span></div></div> <div class="identity svelte-b0xv90"><h2 class="name svelte-b0xv90">${escape_html(person().name)}, <span class="age svelte-b0xv90">${escape_html(person().age)}</span></h2> <p class="distance svelte-b0xv90"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" class="svelte-b0xv90"><circle cx="6" cy="5" r="2" stroke="currentColor" stroke-width="1.2" class="svelte-b0xv90"></circle><path d="M6 10C6 10 2 7.5 2 5C2 2.79 3.79 1 6 1C8.21 1 10 2.79 10 5C10 7.5 6 10 6 10Z" stroke="currentColor" stroke-width="1.2" class="svelte-b0xv90"></path></svg> ${escape_html(person().distance)}</p></div> <div class="waveform-wrap svelte-b0xv90">`);
      EcgWaveform($$renderer2, {
        bpm: person().bpm,
        color: person().color,
        width: 320,
        height: 72,
        useGradient: false
      });
      $$renderer2.push(`<!----></div></div> <div class="actions svelte-b0xv90"><button class="action-btn pass-btn svelte-b0xv90" aria-label="Pass (←)" title="Pass"><svg width="28" height="28" viewBox="0 0 28 28" fill="none" class="svelte-b0xv90"><path d="M7 7L21 21M21 7L7 21" stroke="white" stroke-width="2" stroke-linecap="round" class="svelte-b0xv90"></path></svg></button> <div class="heart-wrap svelte-b0xv90">`);
      {
        $$renderer2.push("<!--[-1-->");
      }
      $$renderer2.push(`<!--]--> <button${attr_class("action-btn heart-btn svelte-b0xv90", void 0, { "sending": sendingHeart })} aria-label="Send heart (→)" title="Send heart"><svg width="34" height="34" viewBox="0 0 34 34" fill="none" class="svelte-b0xv90"><path d="M17 30C17 30 4 22 4 13C4 8.58 7.58 5 12 5C14.2 5 16.18 5.96 17.25 7.5C18.32 5.96 20.3 5 22.5 5C26.42 5 30 8.58 30 13C30 22 17 30 17 30Z" fill="white" stroke="white" stroke-width="0.5" class="svelte-b0xv90"></path></svg></button></div> <div class="key-hint svelte-b0xv90"><span class="svelte-b0xv90">← pass</span> <span class="svelte-b0xv90">→ send heart</span></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    BottomNav($$renderer2);
    $$renderer2.push(`<!---->`);
  });
}
export {
  _page as default
};

import { n as attr, o as attr_class, ap as stringify, p as attr_style } from './renderer-BQugRXev.js';

function HeartLogo($$renderer, $$props) {
  let { size = 48, animated = false } = $$props;
  const pathLength = 320;
  $$renderer.push(`<svg${attr("width", size)}${attr("height", size)} viewBox="0 0 108 108" fill="none" xmlns="http://www.w3.org/2000/svg"${attr_class("heart-logo svelte-r8ms4j", void 0, { "animated": animated })}><defs><linearGradient${attr("id", `heart-grad-${stringify(size)}`)} x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FF6B6B"></stop><stop offset="50%" stop-color="#E81F8C"></stop><stop offset="100%" stop-color="#7B35DE"></stop></linearGradient></defs><path d="M10,64 L27,64 C28,64 29,57 32,57 C35,57 36,64 37,64 L38,70 L43,32 L47,74
       C49,69 52,64 56,64 C58,64 60,58 62,57 C64,56 66,64 69,64
       C70,58 73,40 79,38 C84,36 84,50 84,54 C84,50 84,36 89,40
       C95,44 100,60 101,65"${attr("stroke", `url(#heart-grad-${stringify(size)})`)} stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"${attr_style(`stroke-dasharray: 320; stroke-dashoffset: ${stringify(animated ? pathLength : 0)}`)} class="svelte-r8ms4j"></path></svg>`);
}

export { HeartLogo as H };
//# sourceMappingURL=HeartLogo-CrmE0MdS.js.map

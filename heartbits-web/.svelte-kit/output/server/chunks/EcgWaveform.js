import "clsx";
import { a7 as ssr_context } from "./renderer.js";
function onDestroy(fn) {
  /** @type {SSRContext} */
  ssr_context.r.on_destroy(fn);
}
function EcgWaveform($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let {
      bpm = 72,
      color = "#FF6B6B",
      width = 300,
      height = 80,
      useGradient = true
    } = $$props;
    onDestroy(() => {
    });
    $$renderer2.push(`<canvas class="ecg-canvas svelte-1vjmzfm"></canvas>`);
  });
}
export {
  EcgWaveform as E,
  onDestroy as o
};

/// <reference types="@sveltejs/kit" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker'

declare const self: ServiceWorkerGlobalScope

const CACHE = `cache-${version}`

// All assets to pre-cache: compiled app files + everything in /static
const ASSETS = [...build, ...files]

// ── INSTALL: pre-cache app shell ─────────────────────────
self.addEventListener('install', (event) => {
  async function addFilesToCache() {
    const cache = await caches.open(CACHE)
    await cache.addAll(ASSETS)
  }
  event.waitUntil(addFilesToCache())
})

// ── ACTIVATE: prune old caches ───────────────────────────
self.addEventListener('activate', (event) => {
  async function deleteOldCaches() {
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key)
    }
  }
  event.waitUntil(deleteOldCaches())
})

// ── FETCH: cache-first for static assets, network-first for navigation ──
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return

  // Skip cross-origin requests (e.g. WebSocket upgrades to hb.what-if.io)
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return

  async function respond() {
    const cache = await caches.open(CACHE)

    // For pre-cached assets: serve from cache immediately (cache-first)
    if (ASSETS.includes(url.pathname)) {
      const cachedResponse = await cache.match(event.request)
      if (cachedResponse) return cachedResponse
    }

    // For everything else: try network, cache successful responses, fall back to cache
    try {
      const response = await fetch(event.request)
      if (response.status === 200) {
        // Clone before consuming — response body can only be read once
        cache.put(event.request, response.clone())
      }
      return response
    } catch {
      // Network failed — serve from cache if available, otherwise return offline stub
      const cachedResponse = await cache.match(event.request)
      if (cachedResponse) return cachedResponse
      return new Response('Offline — HeartBits requires a connection for live heartbeats.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      })
    }
  }

  event.respondWith(respond())
})

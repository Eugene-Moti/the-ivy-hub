// Ivy Hub service worker: makes the app installable and keeps the app shell available offline.
// Data never comes from here: walk-ins are queued in IndexedDB by the app and synced when online.

const VERSION = 'ivy-hub-v3'
// Hosts often send `Vary: Origin`; module scripts carry an Origin header the precache requests lack.
const MATCH = { ignoreVary: true }
const SHELL = ['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/ivy-logo.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/textures/plastic-noise.svg', '/textures/receipt-paper.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION)
      await cache.addAll(SHELL)
      // Precache every hashed bundle (lazy pages included) so the app works offline after one visit.
      let assets = []
      try {
        assets = await (await fetch('/asset-manifest.json', { cache: 'no-store' })).json()
      } catch {
        const html = await (await fetch('/index.html', { cache: 'no-store' })).text()
        assets = [...new Set(html.match(/\/assets\/[^"'\s)]+/g) ?? [])]
      }
      await cache.addAll(assets)
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase / provider APIs are never cached

  // Pages: network first so updates arrive, cached shell when offline. A 3s cap stops a flaky
  // connection ("lie-fi") from leaving reception staring at a blank screen.
  if (req.mode === 'navigate') {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    event.respondWith(
      Promise.race([fetch(req), timeout])
        .then((res) => {
          const copy = res.clone()
          caches.open(VERSION).then((c) => c.put('/index.html', copy))
          return res
        })
        .catch(async () => (await caches.match('/index.html', MATCH)) ?? Response.error()),
    )
    return
  }

  // Hashed build assets never change: cache first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req, MATCH).then(
        (hit) =>
          hit ??
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(VERSION).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  // Everything else on this origin (icons, textures): stale-while-revalidate.
  event.respondWith(
    caches.match(req, MATCH).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone()
            caches.open(VERSION).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => hit ?? Response.error())
      return hit ?? network
    }),
  )
})

import fs from 'node:fs'
import type { IncomingMessage } from 'node:http'
import path from 'node:path'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const VENDOR_CHUNKS: [string, RegExp][] = [
  ['three', /node_modules\/three\//],
  ['neon', /node_modules\/(@neondatabase|better-auth|@better-auth|@better-fetch|better-call)\//],
  ['motion', /node_modules\/(motion|framer-motion|motion-dom|motion-utils)\//],
  ['icons', /node_modules\/(@phosphor-icons|lucide-react)\//],
]

/** Lists every built file so the service worker can precache lazy chunks too (offline after first visit). */
function assetManifest(): Plugin {
  return {
    name: 'ivy-asset-manifest',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => f.startsWith('assets/'))
        .map((f) => `/${f}`)
      this.emitFile({ type: 'asset', fileName: 'asset-manifest.json', source: JSON.stringify(files) })
    },
  }
}

const readBody = (req: IncomingMessage) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })

/**
 * Runs the Vercel functions in /api inside `npm run dev`, so sign-in, lockout and notifications work
 * locally without the Vercel CLI. In production Vercel serves them directly.
 */
function localApi(): Plugin {
  return {
    name: 'ivy-local-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        const name = req.url
          .slice(5)
          .split('?')[0]
          .replace(/[^a-z0-9/_-]/gi, '')
        if (
          name.split('/').some((part) => part.startsWith('_')) ||
          !fs.existsSync(path.join(server.config.root, 'api', `${name}.ts`))
        ) {
          res.statusCode = 404
          return res.end(JSON.stringify({ error: 'Not found' }))
        }
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`)
          const handler = mod[req.method ?? 'GET'] as ((r: Request) => Promise<Response>) | undefined
          if (!handler) {
            res.statusCode = 405
            return res.end()
          }
          const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
          const request = new Request(`http://localhost${req.url}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: hasBody ? new Uint8Array(await readBody(req)) : undefined,
          })
          const response = await handler(request)
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          server.ssrFixStacktrace(err as Error)
          next(err)
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Make server-only variables from .env.local available to the local /api functions.
  // (Only VITE_* variables are ever exposed to the browser bundle.)
  const fileEnv = loadEnv(mode, process.cwd(), '')
  for (const [key, value] of Object.entries(fileEnv)) process.env[key] ??= value

  return {
    plugins: [react(), tailwindcss(), assetManifest(), localApi()],
    build: {
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks: (id) => VENDOR_CHUNKS.find(([, re]) => re.test(id.replaceAll('\\', '/')))?.[0],
        },
      },
    },
  }
})

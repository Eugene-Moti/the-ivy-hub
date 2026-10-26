import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const VENDOR_CHUNKS: [string, RegExp][] = [
  ['three', /node_modules\/three\//],
  ['supabase', /node_modules\/@supabase\//],
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

export default defineConfig({
  plugins: [react(), tailwindcss(), assetManifest()],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: (id) => VENDOR_CHUNKS.find(([, re]) => re.test(id.replaceAll('\\', '/')))?.[0],
      },
    },
  },
})

import { foldkit } from '@foldkit/vite-plugin'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [foldkit()],
  optimizeDeps: {
    entries: ['src/client/entry.ts'],
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: { passes: 3, pure_getters: true },
      format: { comments: false },
    },
  },
})

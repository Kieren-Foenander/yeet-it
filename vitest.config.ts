import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    setupFiles: ['./src/vitest-setup.ts'],
    testTimeout: 60_000,
    server: {
      deps: {
        inline: ['foldkit'],
      },
    },
  },
})

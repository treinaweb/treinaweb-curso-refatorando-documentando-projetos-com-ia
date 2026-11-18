import { defineConfig } from 'vitest/config'

// Cada arquivo de teste roda num processo proprio (pool `forks`, padrao), com
// banco SQLite temporario criado em test/setup.ts.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.{js,ts}'],
      // Entrypoint (listen): os testes montam o app com createApp, sem porta.
      exclude: ['src/server.ts'],
    },
  },
})

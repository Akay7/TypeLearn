import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), tailwindcss()],

  // Vitest would otherwise collect `e2e/*.spec.js` too, and Playwright's specs
  // only run under Playwright. Unit tests are the ones next to the code.
  test: {
    include: ['src/**/*.test.js'],
  },
})

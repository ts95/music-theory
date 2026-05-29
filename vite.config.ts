/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// On GitHub Pages the app is served from /music-theory/, so production assets
// need that base path. Local dev stays at the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/music-theory/' : '/',
  plugins: [react(), tailwindcss()],
  // Vitest (unit) owns src/**; Playwright (e2e) owns tests/e2e/**. Keep the
  // runners from grabbing each other's *.spec.ts files.
  test: { exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'] },
}))

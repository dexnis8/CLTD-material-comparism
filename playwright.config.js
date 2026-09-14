import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: './e2e', fullyParallel: false, workers: 1, use: { baseURL: 'http://127.0.0.1:5173', browserName: 'chromium', channel: 'msedge', headless: true }, webServer: { command: 'npm run dev -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: true }, reporter: 'list' })

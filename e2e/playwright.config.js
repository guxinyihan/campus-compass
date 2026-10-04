import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir: './tests', timeout: 60000, workers: 1,
  use: {baseURL: process.env.FRONTEND_URL || 'http://localhost:5173',
    headless: true, launchOptions: process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {},
    trace: 'retain-on-failure'},
  reporter: 'list',
});

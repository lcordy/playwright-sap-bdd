import 'dotenv/config';
import { defineConfig } from '@playwright/test';
import { cucumberReporter, defineBddConfig } from 'playwright-bdd';

export const testConfig = {
  baseUrl: process.env.SAP_CLOUD_BASE_URL || '',
  username: process.env.SAP_CLOUD_USERNAME || '',
  password: process.env.SAP_CLOUD_PASSWORD || '',
};

// Validate required environment variables
if (!testConfig.baseUrl || !testConfig.username || !testConfig.password) {
  throw new Error(
    'Missing required environment variables: SAP_CLOUD_BASE_URL, SAP_CLOUD_USERNAME, SAP_CLOUD_PASSWORD'
  );
}

const testDir = defineBddConfig({
  features: './tests/bdd/features/**/*.feature',
  steps: ['./tests/bdd/step-definitions/**/*.ts', './fixtures/**/*.ts'],
});

export default defineConfig({
  testDir,
  reporter: [
    ['html',
      cucumberReporter('html', { outputFile: 'cucumber-report/index.html' }),],
  ],
  timeout: 5 * 60 * 1000,
  expect: {
    timeout: 30 * 1000,
  },

  use: {
    baseURL: testConfig.baseUrl,
    trace: 'on',
    video: { mode: 'on', size: { width: 1920, height: 1080 } },
    screenshot: 'only-on-failure',
    actionTimeout: 30 * 1000,
    headless: false,
    viewport: null,
    launchOptions: {
      args: ['--start-maximized'],
    },
  },
});
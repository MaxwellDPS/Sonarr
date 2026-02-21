import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SEEDR_ENV_PATH = path.join(REPO_ROOT, 'seedr.env');
const STATE_FILE_PATH = path.join(__dirname, '..', '.e2e-state.json');

export interface SeedrCredentials {
  email: string;
  password: string;
}

export interface E2EState {
  apiKey: string;
  baseUrl: string;
  seedrEmail: string;
  seedrPassword: string;
  downloadDirectory: string;
}

export function loadSeedrCredentials(): SeedrCredentials {
  // Try seedr.env first (supports both EMAIL/PASS and SEEDR_EMAIL/SEEDR_PASSWORD)
  if (fs.existsSync(SEEDR_ENV_PATH)) {
    const parsed = dotenv.parse(fs.readFileSync(SEEDR_ENV_PATH));
    const email = parsed.SEEDR_EMAIL || parsed.EMAIL;
    const password = parsed.SEEDR_PASSWORD || parsed.PASS;
    if (email && password) {
      return { email, password };
    }
  }

  // Fall back to environment variables
  const email = process.env.SEEDR_EMAIL || process.env.EMAIL;
  const password = process.env.SEEDR_PASSWORD || process.env.PASS;
  if (email && password) {
    return { email, password };
  }

  throw new Error(
    'Seedr credentials not found. Either:\n' +
      '  1. Create a seedr.env file at the repo root with EMAIL and PASS (or SEEDR_EMAIL and SEEDR_PASSWORD)\n' +
      '  2. Set SEEDR_EMAIL and SEEDR_PASSWORD environment variables'
  );
}

export function saveState(state: E2EState): void {
  fs.writeFileSync(STATE_FILE_PATH, JSON.stringify(state, null, 2));
}

export function loadState(): E2EState {
  if (!fs.existsSync(STATE_FILE_PATH)) {
    throw new Error(
      `E2E state file not found at ${STATE_FILE_PATH}. Did global-setup run?`
    );
  }
  return JSON.parse(fs.readFileSync(STATE_FILE_PATH, 'utf-8'));
}

export function removeState(): void {
  if (fs.existsSync(STATE_FILE_PATH)) {
    fs.unlinkSync(STATE_FILE_PATH);
  }
}

export const DOWNLOAD_DIRECTORY = '/downloads';
export const SONARR_BASE_URL = 'http://localhost:18989';

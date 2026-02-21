import { execSync } from 'child_process';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const COMPOSE_FILE = path.resolve(__dirname, '..', 'docker-compose.e2e.yml');
const CONTAINER_NAME = 'sonarr-e2e';

function exec(cmd: string, options?: { timeout?: number }): string {
  return execSync(cmd, {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    timeout: options?.timeout ?? 120_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

export function buildImage(): void {
  if (process.env.SKIP_BUILD === 'true') {
    console.log('SKIP_BUILD=true, skipping Docker image build');
    return;
  }

  console.log('Building sonarr-custom Docker image...');
  execSync('docker build -t sonarr-custom .', {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    timeout: 600_000, // 10 minutes
  });
  console.log('Docker image built successfully');
}

export function startContainer(): void {
  console.log('Starting Sonarr container...');
  exec(`docker compose -f "${COMPOSE_FILE}" up -d`);
  console.log('Container started');
}

export function stopContainer(): void {
  console.log('Stopping Sonarr container...');
  try {
    exec(`docker compose -f "${COMPOSE_FILE}" down -v`);
  } catch {
    console.warn('Warning: failed to stop container (may not be running)');
  }
  console.log('Container stopped');
}

export function getApiKey(): string {
  const xml = exec(`docker exec ${CONTAINER_NAME} cat /config/config.xml`);
  const match = xml.match(/<ApiKey>([^<]+)<\/ApiKey>/);
  if (!match) {
    throw new Error('Could not extract API key from config.xml');
  }
  return match[1];
}

export function execInContainer(cmd: string, timeout?: number): string {
  return exec(`docker exec ${CONTAINER_NAME} ${cmd}`, { timeout });
}

export function fileExistsInContainer(filePath: string): boolean {
  try {
    exec(`docker exec ${CONTAINER_NAME} test -e "${filePath}"`);
    return true;
  } catch {
    return false;
  }
}

export function listFilesInContainer(dirPath: string): string[] {
  try {
    const output = exec(`docker exec ${CONTAINER_NAME} ls -1 "${dirPath}"`);
    return output.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export function isContainerRunning(): boolean {
  try {
    const status = exec(
      `docker inspect -f "{{.State.Running}}" ${CONTAINER_NAME}`
    );
    return status === 'true';
  } catch {
    return false;
  }
}

import {
  loadSeedrCredentials,
  saveState,
  SONARR_BASE_URL,
  DOWNLOAD_DIRECTORY,
} from './helpers/config';
import {
  buildImage,
  startContainer,
  getApiKey,
  isContainerRunning,
} from './helpers/docker';
import { SonarrApi } from './helpers/sonarr-api';
import { SeedrApi } from './helpers/seedr-api';
import { poll } from './helpers/wait';

async function globalSetup() {
  console.log('\n=== E2E Global Setup ===\n');

  // 1. Load Seedr credentials (fail early if missing)
  const credentials = loadSeedrCredentials();
  console.log(`Seedr credentials loaded for: ${credentials.email}`);

  // 2. Build Docker image (unless SKIP_BUILD=true)
  buildImage();

  // 3. Start container
  if (!isContainerRunning()) {
    startContainer();
  } else {
    console.log('Container already running, reusing');
  }

  // 4. Wait for Sonarr to be ready (use /ping which doesn't require auth)
  console.log('Waiting for Sonarr to be ready...');
  await poll(
    async () => {
      try {
        const response = await fetch(`${SONARR_BASE_URL}/ping`);
        return response.status;
      } catch {
        return 0;
      }
    },
    (status) => status === 200,
    {
      intervalMs: 5_000,
      timeoutMs: 120_000,
      label: 'Sonarr readiness',
    }
  );
  console.log('Sonarr is ready');

  // 5. Extract API key from container config
  console.log('Extracting API key...');
  const apiKey = getApiKey();
  console.log(`API key extracted: ${apiKey.substring(0, 4)}...`);

  // 6. Configure authentication (dismiss first-run auth modal)
  console.log('Configuring Sonarr authentication...');
  const sonarrApi = new SonarrApi({ baseUrl: SONARR_BASE_URL, apiKey });
  await sonarrApi.configureAuthentication();
  console.log('Authentication configured');

  // 7. Clean Seedr cloud content
  const seedrApi = new SeedrApi({
    email: credentials.email,
    password: credentials.password,
  });
  try {
    await seedrApi.cleanupAllContent();
  } catch (err) {
    console.warn('Warning: Seedr cleanup failed (may be empty):', err);
  }

  // 8. Write state file for tests
  saveState({
    apiKey,
    baseUrl: SONARR_BASE_URL,
    seedrEmail: credentials.email,
    seedrPassword: credentials.password,
    downloadDirectory: DOWNLOAD_DIRECTORY,
  });

  console.log('\n=== Global Setup Complete ===\n');
}

export default globalSetup;

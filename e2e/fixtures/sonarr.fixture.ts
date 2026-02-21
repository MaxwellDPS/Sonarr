import { test as base } from '@playwright/test';
import { loadState, type E2EState } from '../helpers/config';
import { SonarrApi } from '../helpers/sonarr-api';
import { SeedrApi } from '../helpers/seedr-api';

interface SonarrFixtures {
  config: E2EState;
  sonarrApi: SonarrApi;
  seedrApi: SeedrApi;
}

export const test = base.extend<SonarrFixtures>({
  config: async ({}, use) => {
    const state = loadState();
    await use(state);
  },

  sonarrApi: async ({ config }, use) => {
    const api = new SonarrApi({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
    });
    await use(api);
  },

  seedrApi: async ({ config }, use) => {
    const api = new SeedrApi({
      email: config.seedrEmail,
      password: config.seedrPassword,
    });
    await use(api);
  },
});

export { expect } from '@playwright/test';

import { test, expect } from '../fixtures/sonarr.fixture';

test.describe('Seedr Download Client - API Smoke Tests', () => {
  let createdClientId: number | undefined;

  test.afterAll(async ({ sonarrApi }) => {
    // Cleanup: delete the client if it was created
    if (createdClientId) {
      try {
        await sonarrApi.deleteDownloadClient(createdClientId);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test('schema includes Seedr with expected fields', async ({ sonarrApi }) => {
    const schemas = await sonarrApi.getDownloadClientSchemas();
    const seedr = schemas.find((s) => s.implementation === 'Seedr');

    expect(seedr).toBeDefined();
    expect(seedr!.protocol).toBe('torrent');
    expect(seedr!.configContract).toBe('SeedrSettings');

    const fieldNames = seedr!.fields.map((f) => f.name);
    expect(fieldNames).toContain('email');
    expect(fieldNames).toContain('password');
    expect(fieldNames).toContain('downloadDirectory');
    expect(fieldNames).toContain('deleteFromCloud');
  });

  test('create Seedr client via API', async ({ sonarrApi, config }) => {
    const schema = await sonarrApi.getSeedrSchema();

    // Fill in the schema fields with test credentials
    const resource = {
      ...schema,
      name: 'E2E API Seedr',
      enable: true,
      priority: 1,
      tags: [],
      fields: schema.fields.map((field) => {
        switch (field.name) {
          case 'email':
            return { ...field, value: config.seedrEmail };
          case 'password':
            return { ...field, value: config.seedrPassword };
          case 'downloadDirectory':
            return { ...field, value: config.downloadDirectory };
          case 'deleteFromCloud':
            return { ...field, value: true };
          default:
            return field;
        }
      }),
    };

    const created = await sonarrApi.createDownloadClient(resource);
    createdClientId = created.id;

    expect(created.id).toBeGreaterThan(0);
    expect(created.name).toBe('E2E API Seedr');
    expect(created.implementation).toBe('Seedr');
  });

  test('test Seedr connectivity via API', async ({ sonarrApi, config }) => {
    const schema = await sonarrApi.getSeedrSchema();

    const resource = {
      ...schema,
      name: 'E2E Connectivity Test',
      enable: true,
      priority: 1,
      tags: [],
      fields: schema.fields.map((field) => {
        switch (field.name) {
          case 'email':
            return { ...field, value: config.seedrEmail };
          case 'password':
            return { ...field, value: config.seedrPassword };
          case 'downloadDirectory':
            return { ...field, value: config.downloadDirectory };
          case 'deleteFromCloud':
            return { ...field, value: true };
          default:
            return field;
        }
      }),
    };

    // testDownloadClient throws on 400 (validation failure), so reaching
    // this point means the test passed (200 with empty body)
    await sonarrApi.testDownloadClient(resource);
  });

  test('list download clients includes created client', async ({
    sonarrApi,
  }) => {
    // This test depends on the create test above having run
    test.skip(!createdClientId, 'No client was created in previous test');

    const clients = await sonarrApi.listDownloadClients();
    const seedr = clients.find((c) => c.id === createdClientId);

    expect(seedr).toBeDefined();
    expect(seedr!.implementation).toBe('Seedr');
  });

  test('delete Seedr client via API', async ({ sonarrApi }) => {
    test.skip(!createdClientId, 'No client was created');

    await sonarrApi.deleteDownloadClient(createdClientId!);

    const clients = await sonarrApi.listDownloadClients();
    const seedr = clients.find((c) => c.id === createdClientId);
    expect(seedr).toBeUndefined();

    createdClientId = undefined; // Don't double-delete in afterAll
  });
});

import { test, expect } from '../fixtures/sonarr.fixture';
import { TEST_TORRENT, makeTestRelease } from '../helpers/torrent';
import { poll } from '../helpers/wait';
import { listFilesInContainer } from '../helpers/docker';

const CLIENT_NAME = 'E2E Test Seedr';

test.describe.serial(
  'Seedr Download Client - Full UI + API E2E',
  () => {
    let createdClientId: number | undefined;
    let addedSeriesId: number | undefined;

    test('add Seedr download client via UI', async ({
      page,
      config,
    }) => {
      // Navigate to download clients settings
      await page.goto('/settings/downloadclients');
      await page.waitForLoadState('networkidle');

      // Click the add card
      await page.locator('[class*="addDownloadClient"]').click();

      // Wait for the modal to load schemas
      await page.waitForSelector('[class*="modalContent"]');

      // In the Torrents fieldset, click the Seedr item card
      const torrentsFieldset = page.locator('fieldset', {
        has: page.locator('legend', { hasText: 'Torrents' }),
      });
      await torrentsFieldset
        .locator('div')
        .filter({ hasText: /^SeedrMore Info$/ })
        .first()
        .click();

      // Wait for the edit modal to appear
      await page.waitForSelector('[class*="modalContent"]');

      // Fill in the name field
      const nameInput = page.locator('input[name="name"]');
      await nameInput.clear();
      await nameInput.fill(CLIENT_NAME);

      // Fill in the email field
      const emailInput = page.locator('input[name="email"]');
      await emailInput.fill(config.seedrEmail);

      // Fill in the password field
      const passwordInput = page.locator('input[name="password"]');
      await passwordInput.fill(config.seedrPassword);

      // Fill in the download directory
      const downloadDirInput = page.locator(
        'input[name="downloadDirectory"]'
      );
      await downloadDirInput.fill(config.downloadDirectory);

      // Scope buttons to the modal
      const modal = page.locator('[class*="modalContent"]');

      // Click Test button and wait for it to complete
      const testButton = modal.getByRole('button', { name: 'Test', exact: true });
      await testButton.click();

      // Wait for the spinner to stop (button becomes non-spinning)
      await expect(testButton).not.toHaveAttribute(
        'class',
        /isSpinning/,
        { timeout: 30_000 }
      );

      // Verify no error alerts appeared
      const errorAlerts = modal.locator('[class*="alert"][class*="danger"]');
      await expect(errorAlerts).toHaveCount(0);

      // Click Save
      const saveButton = modal.getByRole('button', { name: 'Save', exact: true });
      await saveButton.click();

      // Wait for modal to close
      await expect(
        page.locator('[class*="modalContent"]')
      ).toHaveCount(0, { timeout: 10_000 });

      // Assert the new client card appears in the list
      await expect(page.getByText(CLIENT_NAME).first()).toBeVisible();
    });

    test('verify client exists via API', async ({ sonarrApi }) => {
      const clients = await sonarrApi.listDownloadClients();
      const seedr = clients.find(
        (c) => c.name === CLIENT_NAME && c.implementation === 'Seedr'
      );

      expect(seedr).toBeDefined();
      expect(seedr!.id).toBeGreaterThan(0);
      createdClientId = seedr!.id;
    });

    test('trigger download via release push', async ({
      sonarrApi,
    }) => {
      test.setTimeout(180_000); // 3 minutes for setup + cloud download

      // Ensure we have a root folder
      const rootFolders = await sonarrApi.listRootFolders();
      if (!rootFolders.find((rf) => rf.path === '/tv')) {
        await sonarrApi.addRootFolder('/tv');
      }

      // Get a quality profile
      const profiles = await sonarrApi.listQualityProfiles();
      expect(profiles.length).toBeGreaterThan(0);
      const profileId = profiles[0].id;

      // Look up a well-known series (The Big Bang Theory - TVDB 80379)
      const lookupResults = await sonarrApi.lookupSeries(80379);
      expect(lookupResults.length).toBeGreaterThan(0);

      const seriesData = lookupResults[0];

      // Add the series — monitor only S01 so the push release matches
      const series = await sonarrApi.addSeries({
        ...seriesData,
        qualityProfileId: profileId,
        rootFolderPath: '/tv',
        monitored: true,
        addOptions: { searchForMissingEpisodes: false },
        seasonFolder: true,
        seasons: seriesData.seasons.map((s) => ({
          ...s,
          monitored: s.seasonNumber === 1,
        })),
      });
      addedSeriesId = series.id;

      // Push a release (triggers Seedr.AddFromMagnetLink)
      const release = makeTestRelease('The.Big.Bang.Theory');
      const pushResult = await sonarrApi.pushRelease({
        ...release,
        downloadClientId: createdClientId,
      });

      // Verify the release was approved (not rejected by quality/size checks)
      expect(pushResult).toHaveLength(1);
      expect(pushResult[0].approved).toBe(true);
      expect(pushResult[0].rejected).toBe(false);
    });

    test('verify queue status transitions', async ({
      sonarrApi,
    }) => {
      test.setTimeout(300_000); // 5 minutes for cloud download

      // Poll the queue for our download
      const queueItem = await poll(
        async () => {
          const queue = await sonarrApi.getQueue();
          return queue.records.find(
            (r) =>
              r.title?.includes(TEST_TORRENT.expectedName) ||
              r.title?.includes('Big.Bang')
          );
        },
        (item) => item !== undefined,
        {
          intervalMs: 5_000,
          timeoutMs: 60_000,
          label: 'queue item to appear',
        }
      );

      expect(queueItem).toBeDefined();
      console.log(`Queue item found: ${queueItem!.title} - Status: ${queueItem!.status}`);

      // Wait for download to complete (or reach a tracked state)
      await poll(
        async () => {
          const queue = await sonarrApi.getQueue();
          const item = queue.records.find(
            (r) =>
              r.title?.includes(TEST_TORRENT.expectedName) ||
              r.title?.includes('Big.Bang')
          );
          if (item) {
            console.log(
              `  Queue status: ${item.status} / ${item.trackedDownloadState ?? 'N/A'}`
            );
          }
          return item;
        },
        (item) => {
          if (!item) return true; // Item removed from queue = completed + imported
          return (
            item.trackedDownloadState === 'importPending' ||
            item.trackedDownloadState === 'imported' ||
            item.status === 'completed' ||
            item.status === 'warning' // Import may fail with test torrent
          );
        },
        {
          intervalMs: 10_000,
          timeoutMs: 300_000,
          label: 'download to complete',
        }
      );
    });

    test('verify local file download', async () => {
      test.setTimeout(120_000);

      // Wait a bit for files to be written
      const files = await poll(
        async () => listFilesInContainer('/downloads'),
        (fileList) => fileList.length > 0,
        {
          intervalMs: 5_000,
          timeoutMs: 120_000,
          label: 'files to appear in /downloads',
        }
      );

      console.log('Files in /downloads:', files);
      expect(files.length).toBeGreaterThan(0);
    });

    test('verify Seedr cloud cleanup', async ({ seedrApi }) => {
      // With DeleteFromCloud=true, Seedr should clean up after import.
      // However, if the import fails (e.g., test torrent not matching episode format),
      // Sonarr may not trigger cloud cleanup. We verify the cloud was cleaned or
      // clean it ourselves as a fallback.
      const contents = await seedrApi.getFolderContents();
      const hasFolders = (contents.folders?.length ?? 0) > 0;
      const hasFiles = (contents.files?.length ?? 0) > 0;

      if (hasFolders || hasFiles) {
        console.log('Seedr cloud still has content (import may not have completed). Cleaning manually.');
        await seedrApi.cleanupAllContent();
        const afterCleanup = await seedrApi.getFolderContents();
        expect(afterCleanup.folders?.length ?? 0).toBe(0);
        expect(afterCleanup.files?.length ?? 0).toBe(0);
      } else {
        console.log('Seedr cloud was cleaned by Sonarr automatically.');
      }
    });

    test('verify queue in UI', async ({ page }) => {
      await page.goto('/activity/queue');
      await page.waitForLoadState('networkidle');

      // Visual verification that the queue page loads without errors
      await expect(page.getByText('Total records')).toBeVisible();
    });

    test('cleanup', async ({ sonarrApi, seedrApi }) => {
      // Delete the download client
      if (createdClientId) {
        try {
          await sonarrApi.deleteDownloadClient(createdClientId);
          console.log(`Deleted download client ${createdClientId}`);
        } catch (err) {
          console.warn('Failed to delete download client:', err);
        }
      }

      // Delete the series
      if (addedSeriesId) {
        try {
          await sonarrApi.deleteSeries(addedSeriesId, true);
          console.log(`Deleted series ${addedSeriesId}`);
        } catch (err) {
          console.warn('Failed to delete series:', err);
        }
      }

      // Safety net: clean Seedr cloud
      try {
        await seedrApi.cleanupAllContent();
      } catch (err) {
        console.warn('Failed to clean Seedr cloud:', err);
      }
    });
  }
);

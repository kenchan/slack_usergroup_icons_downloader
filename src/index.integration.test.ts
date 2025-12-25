import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import nock from 'nock';
import { mkdtemp, rm, readFile, access } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { SlackUsergroupIconsDownloader } from './index.js';

describe('SlackUsergroupIconsDownloader - Integration Test', () => {
  const slackApi = 'https://slack.com';
  let tempDir: string;

  beforeAll(() => {
    nock.disableNetConnect();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  afterEach(async () => {
    nock.cleanAll();
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('downloads and saves files to disk', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'slack-icons-test-'));

    // Mock for Slack API usergroups.list
    nock(slackApi)
      .post('/api/usergroups.list')
      .reply(200, {
        ok: true,
        usergroups: [
          { id: 'S12345678', handle: 'engineers', name: 'Engineers' }
        ],
      });

    // Mock for Slack API usergroups.users.list
    nock(slackApi)
      .post('/api/usergroups.users.list')
      .reply(200, {
        ok: true,
        users: ['U01', 'U02'],
      });

    // Mock for Slack API users.info (2 users)
    nock(slackApi)
      .post('/api/users.info', { user: 'U01' })
      .reply(200, {
        ok: true,
        user: {
          id: 'U01',
          name: 'alice',
          profile: {
            real_name: 'Alice Smith',
            image_192: 'https://images.example.com/alice.jpg',
          },
        },
      });

    nock(slackApi)
      .post('/api/users.info', { user: 'U02' })
      .reply(200, {
        ok: true,
        user: {
          id: 'U02',
          name: 'bob',
          profile: {
            real_name: 'Bob Johnson',
            image_192: 'https://images.example.com/bob.png',
          },
        },
      });

    // Mock for image URLs (fake image data)
    const aliceImageData = Buffer.from('fake-alice-image-data');
    const bobImageData = Buffer.from('fake-bob-image-data');

    nock('https://images.example.com')
      .get('/alice.jpg')
      .reply(200, aliceImageData, { 'Content-Type': 'image/jpeg' });

    nock('https://images.example.com')
      .get('/bob.png')
      .reply(200, bobImageData, { 'Content-Type': 'image/png' });

    const downloader = new SlackUsergroupIconsDownloader({
      token: 'xoxp-test-token',
      outputDir: tempDir,
      size: '192',
    });

    await downloader.downloadUsergroupIcons('engineers');

    // Verify that files were actually created
    const aliceFile = join(tempDir, 'alice.jpg');
    const bobFile = join(tempDir, 'bob.png');

    await access(aliceFile);
    await access(bobFile);

    // Verify file contents
    const aliceContent = await readFile(aliceFile);
    const bobContent = await readFile(bobFile);

    expect(aliceContent.toString()).toBe(aliceImageData.toString());
    expect(bobContent.toString()).toBe(bobImageData.toString());

    // Verify that all HTTP mocks were used
    expect(nock.isDone()).toBe(true);
  });

  it('downloads files when Usergroup ID is directly specified', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'slack-icons-test-'));

    // usergroups.list is not called (ID is directly specified)
    nock(slackApi)
      .post('/api/usergroups.users.list')
      .reply(200, {
        ok: true,
        users: ['U03'],
      });

    nock(slackApi)
      .post('/api/users.info', { user: 'U03' })
      .reply(200, {
        ok: true,
        user: {
          id: 'U03',
          name: 'charlie',
          profile: {
            real_name: 'Charlie Brown',
            image_192: 'https://images.example.com/charlie.jpg',
          },
        },
      });

    const imageData = Buffer.from('fake-charlie-image');
    nock('https://images.example.com')
      .get('/charlie.jpg')
      .reply(200, imageData);

    const downloader = new SlackUsergroupIconsDownloader({
      token: 'xoxp-test-token',
      outputDir: tempDir,
    });

    await downloader.downloadUsergroupIcons('S12345678');

    const charlieFile = join(tempDir, 'charlie.jpg');
    await access(charlieFile);

    const content = await readFile(charlieFile);
    expect(content.toString()).toBe(imageData.toString());
  });

  it('does not create file when image URL is invalid', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'slack-icons-test-'));

    nock(slackApi)
      .post('/api/usergroups.users.list')
      .reply(200, {
        ok: true,
        users: ['U04'],
      });

    nock(slackApi)
      .post('/api/users.info', { user: 'U04' })
      .reply(200, {
        ok: true,
        user: {
          id: 'U04',
          name: 'noimage',
          profile: {
            real_name: 'No Image User',
            // no image_192
          },
        },
      });

    const downloader = new SlackUsergroupIconsDownloader({
      token: 'xoxp-test-token',
      outputDir: tempDir,
    });

    await downloader.downloadUsergroupIcons('S12345678');

    // Verify that no files were created
    const files = await readFile(tempDir).catch(() => []);
    expect(files).toEqual([]);
  });
});

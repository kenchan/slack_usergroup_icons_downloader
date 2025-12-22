import { WebClient } from '@slack/web-api';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

export type ImageSize = 'original' | '1024' | '512' | '192' | '72';

interface SlackUserProfile {
  real_name?: string;
  image_original?: string;
  image_1024?: string;
  image_512?: string;
  image_192?: string;
  image_72?: string;
  [key: string]: string | undefined;
}

interface SlackUser {
  id: string;
  name: string;
  profile?: SlackUserProfile;
}

export interface DownloaderOptions {
  token: string;
  outputDir?: string;
  debug?: boolean;
  size?: ImageSize;
}

export class SlackUsergroupIconsDownloader {
  private client: WebClient;
  private outputDir: string;
  private debug: boolean;
  private size: ImageSize;
  private downloadedCount: number = 0;
  private totalCount: number = 0;

  constructor(options: DownloaderOptions) {
    this.client = new WebClient(options.token);
    this.outputDir = options.outputDir || './slack_icons';
    this.debug = options.debug || false;
    this.size = options.size || '192';
  }

  async downloadUsergroupIcons(usergroupIdentifier: string): Promise<void> {
    const usergroupId = await this.resolveUsergroupId(usergroupIdentifier);

    console.log(`Fetching members of usergroup: ${usergroupIdentifier}...`);
    const userIds = await this.fetchUsergroupMembers(usergroupId);

    if (userIds.length === 0) {
      console.log('No members found in the usergroup.');
      return;
    }

    console.log(`Found ${userIds.length} members. Downloading icons...`);
    await mkdir(this.outputDir, { recursive: true });

    this.downloadedCount = 0;
    this.totalCount = userIds.length;

    const CONCURRENT_DOWNLOADS = 5;
    for (let i = 0; i < userIds.length; i += CONCURRENT_DOWNLOADS) {
      const chunk = userIds.slice(i, i + CONCURRENT_DOWNLOADS);
      await Promise.all(chunk.map(userId => this.downloadUserIcon(userId)));
    }

    console.log(`\nDone! Downloaded ${this.downloadedCount}/${this.totalCount} icons to ${this.outputDir}/`);
  }

  private async resolveUsergroupId(identifier: string): Promise<string> {
    if (/^S[A-Z0-9]{8,10}$/.test(identifier)) {
      return identifier;
    }

    console.log(`Looking up usergroup by handle: ${identifier}...`);
    const usergroupId = await this.findUsergroupIdByHandle(identifier);
    if (!usergroupId) {
      throw new Error(`Usergroup not found: ${identifier}`);
    }
    console.log(`Found usergroup ID: ${usergroupId}`);
    return usergroupId;
  }

  private async findUsergroupIdByHandle(handle: string): Promise<string | null> {
    try {
      const response = await this.client.usergroups.list();

      if (!response.ok) {
        throw new Error(`API error (usergroups.list): ${response.error}`);
      }

      const usergroups = response.usergroups || [];
      const usergroup = usergroups.find((ug) => ug.handle === handle);
      return usergroup?.id || null;
    } catch (error) {
      if (error instanceof Error && (error as any).data?.error === 'missing_scope') {
        throw new Error(
          `API error (usergroups.list): missing_scope\n\n` +
          `Required scope is missing. Please ensure your Slack App has the following scope:\n` +
          `  - usergroups:read (required for listing usergroups)\n\n` +
          `To add this scope:\n` +
          `  1. Go to https://api.slack.com/apps\n` +
          `  2. Select your app\n` +
          `  3. Go to 'OAuth & Permissions'\n` +
          `  4. Add 'usergroups:read' to User Token Scopes\n` +
          `  5. Reinstall the app to your workspace`
        );
      }
      throw error;
    }
  }

  private async fetchUsergroupMembers(usergroupId: string): Promise<string[]> {
    try {
      const response = await this.client.usergroups.users.list({
        usergroup: usergroupId,
      });

      if (!response.ok) {
        throw new Error(`API error (usergroups.users.list): ${response.error}`);
      }

      return (response.users || []) as string[];
    } catch (error) {
      if (error instanceof Error && (error as any).data?.error === 'missing_scope') {
        throw new Error(`API error (usergroups.users.list): missing_scope\n\nRequired scope: usergroups:read`);
      }
      throw error;
    }
  }

  private async downloadUserIcon(userId: string): Promise<void> {
    try {
      const userInfo = await this.fetchUserInfo(userId);
      const profile = userInfo.profile || {};

      const realName = profile.real_name || userInfo.name;
      const username = userInfo.name;

      if (this.debug) {
        console.log(`\n  Debug: ${realName} (${username})`);
        console.log(`    image_original: ${profile.image_original}`);
        console.log(`    image_1024: ${profile.image_1024}`);
        console.log(`    image_512: ${profile.image_512}`);
        console.log(`    image_192: ${profile.image_192}`);
        console.log(`    image_72: ${profile.image_72}`);
      }

      const imageKey = this.size === 'original' ? 'image_original' : `image_${this.size}`;
      const imageUrl = profile[imageKey];

      if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
        console.log(`  Skipping ${realName} (${username}): Invalid or missing icon URL`);
        return;
      }

      const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
      const filename = `${username}.${ext}`;
      const filepath = join(this.outputDir, filename);

      await this.downloadImage(imageUrl, filepath);
      this.downloadedCount++;
      console.log(`  [${this.downloadedCount}/${this.totalCount}] Downloaded: ${realName} (${username})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`  [${this.downloadedCount}/${this.totalCount}] Error downloading icon for user ${userId}: ${message}`);
    }
  }

  private async fetchUserInfo(userId: string): Promise<SlackUser> {
    try {
      const response = await this.client.users.info({ user: userId });

      if (!response.ok) {
        throw new Error(`API error (users.info): ${response.error}`);
      }

      return response.user as SlackUser;
    } catch (error) {
      if (error instanceof Error && (error as any).data?.error === 'missing_scope') {
        throw new Error(`API error (users.info): missing_scope\n\nRequired scope: users:read`);
      }
      throw error;
    }
  }

  private async downloadImage(url: string, filepath: string): Promise<void> {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const fileStream = createWriteStream(filepath);
    await pipeline(Readable.fromWeb(response.body as any), fileStream);
  }
}

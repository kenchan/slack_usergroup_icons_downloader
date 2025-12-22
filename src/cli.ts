#!/usr/bin/env node

import { Command } from 'commander';
import { SlackUsergroupIconsDownloader, ImageSize } from './index.js';

const program = new Command();

program
  .name('slack-usergroup-icons-downloader')
  .description('Download Slack usergroup member icons')
  .argument('<usergroup>', 'Usergroup handle or ID')
  .option('-d, --debug', 'Enable debug output to show available icon URLs')
  .option(
    '-s, --size <size>',
    'Icon size (original, 1024, 512, 192, 72)',
    '192'
  )
  .option('-o, --output <dir>', 'Output directory', './slack_icons')
  .action(async (usergroup: string, options: any) => {
    const token = process.env.SLACK_API_TOKEN;

    if (!token) {
      console.error('Error: SLACK_API_TOKEN environment variable is not set');
      process.exit(1);
    }

    const validSizes: ImageSize[] = ['original', '1024', '512', '192', '72'];
    if (!validSizes.includes(options.size)) {
      console.error(
        `Error: Invalid size "${options.size}". Valid sizes are: ${validSizes.join(', ')}`
      );
      process.exit(1);
    }

    try {
      const downloader = new SlackUsergroupIconsDownloader({
        token,
        outputDir: options.output,
        debug: options.debug,
        size: options.size as ImageSize,
      });

      await downloader.downloadUsergroupIcons(usergroup);
    } catch (error: any) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

program.addHelpText('after', `
Environment variables required:
  SLACK_API_TOKEN    Your Slack API token (User OAuth Token starting with xoxp-)

Required OAuth Scopes:
  - usergroups:read (for listing usergroups and members)
  - users:read (for fetching user info and profile images)

Examples:
  $ export SLACK_API_TOKEN='xoxp-...'
  $ slack-usergroup-icons-downloader engineers
  $ slack-usergroup-icons-downloader S01234ABCDE
  $ slack-usergroup-icons-downloader --size original engineers
  $ slack-usergroup-icons-downloader --size 512 engineers
  $ slack-usergroup-icons-downloader --debug engineers

Note: If you get a "missing_scope" error, reinstall your Slack App with the required scopes.
`);

program.parse();

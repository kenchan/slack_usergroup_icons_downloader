# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A TypeScript-based CLI tool that downloads profile icons for Slack usergroup members. Can be executed directly via `npx` or `bunx`.

## Development Commands

```bash
# Install dependencies
npm install

# Development mode (run TypeScript directly with tsx)
npm run dev -- engineers
npm run dev -- --debug engineers
npm run dev -- --size original --output ./icons engineers

# Build (compile TypeScript to JavaScript)
npm run build

# Test built version
node dist/cli.js engineers
```

## Environment Variables

Required environment variable for development:

```bash
export SLACK_API_TOKEN='xoxp-your-token-here'
```

The Slack API token requires the following scopes:
- `usergroups:read` - for fetching usergroups and members
- `users:read` - for fetching user info and profile images

## Architecture

### Entry Points

- **src/cli.ts**: CLI entry point. Parses command-line arguments using Commander
- **src/index.ts**: Core logic. Implements the `SlackUsergroupIconsDownloader` class

### Core Logic Flow

1. **Usergroup Resolution** (`resolveUsergroupId`):
   - If handle is provided: lookup ID via `usergroups.list` API
   - If ID is provided (starts with `S`): use as-is

2. **Fetch Member List** (`fetchUsergroupMembers`):
   - Get array of user IDs via `usergroups.users.list` API

3. **Download Each User's Icon** (`downloadUserIcon`):
   - Fetch user info via `users.info` API
   - Extract image URL for specified size from profile
   - Download image via `fetch` API and save as `{username}.jpg`

### Image Size Handling

Supports 5 sizes via `ImageSize` type: `'original' | '1024' | '512' | '192' | '72'`

Image URLs are retrieved from Slack API profile object using these keys:
- `image_original` (when original is specified)
- `image_1024`, `image_512`, `image_192`, `image_72`

### Error Handling

When `missing_scope` error occurs, displays detailed help message with instructions for adding scopes (see src/index.ts:76-86)

## Build Output

- TypeScript compilation outputs to `dist/` directory
- `dist/cli.js` is specified as executable in `package.json` `bin` field
- Can be globally installed as `slack-usergroup-icons-downloader` command via npm publish

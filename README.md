# slack-usergroup-icons-downloader

Download Slack usergroup member icons with ease.

## Features

- Download profile icons for all members of a Slack usergroup
- Support for multiple image sizes (original, 1024px, 512px, 192px, 72px)
- Can be used with `npx` or `bunx` without installation
- Debug mode to inspect available icon URLs

## Prerequisites

You need a Slack API token with the following scopes:
- `usergroups:read` - for listing usergroups and members
- `users:read` - for fetching user info and profile images

### How to get a Slack API token

1. Go to https://api.slack.com/apps
2. Create a new app or select an existing one
3. Go to "OAuth & Permissions"
4. Add the required scopes to "User Token Scopes":
   - `usergroups:read`
   - `users:read`
5. Install/Reinstall the app to your workspace
6. Copy the "User OAuth Token" (starts with `xoxp-`)

## Usage

### Using npx (recommended)

```bash
export SLACK_API_TOKEN='xoxp-your-token-here'
npx slack-usergroup-icons-downloader engineers
```

### Using bunx

```bash
export SLACK_API_TOKEN='xoxp-your-token-here'
bunx slack-usergroup-icons-downloader engineers
```

### Install globally

```bash
npm install -g slack-usergroup-icons-downloader

export SLACK_API_TOKEN='xoxp-your-token-here'
slack-usergroup-icons-downloader engineers
```

## Options

```
Usage: slack-usergroup-icons-downloader [options] <usergroup>

Download Slack usergroup member icons

Arguments:
  usergroup                Usergroup handle or ID

Options:
  -d, --debug              Enable debug output to show available icon URLs
  -s, --size <size>        Icon size (original, 1024, 512, 192, 72) (default: "192")
  -o, --output <dir>       Output directory (default: "./slack_icons")
  -h, --help               display help for command
```

## Examples

```bash
# Download with default settings (192px)
npx slack-usergroup-icons-downloader engineers

# Download original size icons
npx slack-usergroup-icons-downloader --size original engineers

# Download 512px icons to a specific directory
npx slack-usergroup-icons-downloader --size 512 --output ./icons engineers

# Use usergroup ID instead of handle
npx slack-usergroup-icons-downloader S01234ABCDE

# Debug mode to see all available icon URLs
npx slack-usergroup-icons-downloader --debug engineers
```

## Output

Icons are saved as `{username}.jpg` in the output directory (default: `./slack_icons/`).

For example:
- `slack_icons/john.jpg`
- `slack_icons/jane.jpg`
- `slack_icons/bob.jpg`

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev -- engineers

# Build
npm run build

# Run built version
node dist/cli.js engineers
```

## License

MIT

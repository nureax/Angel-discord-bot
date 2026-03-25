# Angel Discord Bot

A feature-rich Discord bot built with [Discord.js v14](https://discord.js.org/).

## Features

- Slash command framework with dynamic loading
- Moderation commands: kick, ban, mute (timeout), warn, unban, purge, slowmode, automod
- Utility commands: ping, help, info, userinfo, avatar, poll, remind, rank, leaderboard, reactionrole, giveaway, ticket, 8ball, coinflip, ship, snipe, editsnipe, serveravatar
- Welcome/goodbye messages for new/leaving members
- Structured, timestamped console logging
- Graceful shutdown on SIGINT/SIGTERM
- Global unhandled-rejection and uncaught-exception handlers

## Project Structure

```
Angel-discord-bot/
├── src/
│   ├── commands/
│   │   ├── moderation/   kick, ban, mute, warn, unban, purge, slowmode, automod
│   │   └── utility/      ping, help, info, userinfo, avatar, poll, remind,
│   │                     rank, leaderboard, reactionrole, giveaway, ticket,
│   │                     8ball, coinflip, ship, snipe, editsnipe, serveravatar
│   ├── events/           ready, interactionCreate, messageCreate, messageDelete,
│   │                     messageUpdate, guildMemberAdd, guildMemberRemove
│   ├── handlers/         commandHandler, eventHandler, deployCommands
│   ├── utils/            logger, embed, permissions, warnStore, xpStore, modLog,
│   │                     reactionRoleStore, giveawayStore, ticketStore,
│   │                     snipeStore, automodStore
│   └── index.js          entry point
├── .env.example
├── config.js
├── package.json
└── README.md
```

## Setup

### 1. Prerequisites

- Node.js v18 or higher
- A Discord application and bot token ([Discord Developer Portal](https://discord.com/developers/applications))

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable         | Required | Description                                      |
|------------------|----------|--------------------------------------------------|
| `DISCORD_TOKEN`  | Yes      | Your bot token                                   |
| `CLIENT_ID`      | Yes      | Your application's client/application ID         |
| `GUILD_ID`       | No       | Guild ID for dev command deployment (faster)     |
| `PREFIX`         | No       | Legacy message prefix (default: `!`)             |
| `LOG_LEVEL`      | No       | `error`, `warn`, `info`, `debug` (default: `info`) |

### 4. Run the bot

```bash
npm start
```

Slash commands are automatically deployed when the bot starts (via the `ready` event).

### Development mode (auto-restart on file changes)

```bash
npm run dev
```

## Commands

### Utility

| Command            | Description                                                     |
|--------------------|-----------------------------------------------------------------|
| `/ping`            | Check bot latency and WebSocket heartbeat                       |
| `/help`            | List all commands (or details for one)                          |
| `/info`            | Display server information                                      |
| `/userinfo`        | Display user profile information                                |
| `/avatar`          | Show a user's avatar in full size                               |
| `/poll`            | Create a reaction poll (up to 10 options)                       |
| `/remind`          | Set a timed DM reminder                                         |
| `/rank`            | Show XP level and progress for yourself or another user         |
| `/leaderboard`     | View the server XP leaderboard                                  |
| `/reactionrole`    | Set up button-based self-assign roles                           |
| `/giveaway`        | Start, end, or reroll a timed giveaway                          |
| `/ticket`          | Set up a support ticket system or close a ticket                |
| `/8ball`           | Ask the Magic 8-Ball a question                                 |
| `/coinflip`        | Flip a coin                                                     |
| `/ship`            | Check love compatibility between two users                      |
| `/snipe`           | Show the last deleted message in this channel                   |
| `/editsnipe`       | Show the last edited message in this channel                    |
| `/serveravatar`    | Show a user's server-specific avatar                            |

### Moderation

| Command          | Description                                      | Permissions Required      |
|------------------|--------------------------------------------------|---------------------------|
| `/kick`          | Kick a member from the server                    | Kick Members              |
| `/ban`           | Ban a user from the server                       | Ban Members               |
| `/mute`          | Timeout (mute) a member for a given duration     | Moderate Members          |
| `/warn add`      | Issue a warning to a member                      | Moderate Members          |
| `/warn list`     | View a member's warning history                  | Moderate Members          |
| `/warn clear`    | Clear all warnings for a member                  | Moderate Members          |
| `/unban`         | Unban a user by ID                               | Ban Members               |
| `/purge`         | Bulk delete messages (with optional filters)     | Manage Messages           |
| `/slowmode`      | Set channel slowmode                             | Manage Channels           |
| `/automod`       | Configure auto-moderation rules                  | Manage Guild              |

## Required Bot Permissions

When inviting the bot, ensure it has the following permissions:

- Send Messages / Send Messages in Threads
- Embed Links
- Read Message History
- Add Reactions
- Kick Members
- Ban Members
- Moderate Members (for timeouts)
- Manage Messages (for purge / automod)
- Manage Channels (for tickets / slowmode)
- Manage Guild (for automod configuration)
- View Channels

## Notes

- Warnings are stored in memory and are lost on bot restart. For production, replace `src/utils/warnStore.js` with a persistent database.
- Reminders use `setTimeout` and are also lost on restart. For production, use a persistent job scheduler.
- XP, giveaways, tickets, reaction roles, and snipe data are also in-memory. For production use, swap the respective store files for a persistent database.
- Spam constants (`spamThreshold`, `spamWindowMs`) are configurable in `config.js` under `moderation.automod`.

## License

MIT

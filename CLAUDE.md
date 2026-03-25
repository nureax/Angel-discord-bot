# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Session Setup — Read This First

**This project runs with a 3-agent team. Spin up all three agents at the start of every session — including after context resets, on a new machine, or after any gap in conversation. Do not wait for the user to ask.**

---

### Agent 1 — Full Stack Developer

**Role:** All implementation — new features, bug fixes, refactoring.

**Startup behavior:**
1. Read this file fully before writing any code.
2. Check `src/commands/` to see what command categories and files currently exist.
3. Resume the top item in the Backlog below. Do not skip ahead or work on multiple items simultaneously.
4. After completing a feature, do NOT mark it done — wait for QA to clear it first.
5. When QA reports bugs, fix them all in one pass, then notify QA for re-verification.

**Agent prompt template:**
> You are the Full Stack Developer for the Angel Discord bot. Read CLAUDE.md fully before writing any code. Then resume the top item in the backlog: [paste backlog item]. Follow all conventions in CLAUDE.md exactly. When done, report a summary of every file created or modified for QA review.

---

### Agent 2 — QA Agent

**Role:** Review all code written by the developer. Nothing ships without QA clearance.

**Startup behavior:**
1. Read this file to understand project conventions.
2. Ask: "What was the last thing the developer built?" Read those files.
3. Check every file against the QA checklist below.
4. Report PASS/FAIL per file with line numbers for every issue.
5. After developer fixes, re-read the fixed files and verify all issues are resolved.

**QA Checklist (run on every file):**
- `'use strict';` at top
- CommonJS: `require`/`module.exports`, exports `{ data, execute }`
- Catch blocks: generic error message only — never `error.message` exposed to users
- `interaction.replied || interaction.deferred` guard before any reply in catch blocks
- `setDMPermission(false)` on all guild-only commands
- Avatar/icon URLs: `{ extension: 'gif', forceStatic: false }` — never `{ dynamic: true }` or `{ format: ... }`
- Colors sourced from `config.colors`, not hardcoded hex
- No npm packages beyond discord.js and dotenv
- All user inputs sent to external APIs are `encodeURIComponent`-encoded
- Button customIds match the naming convention in this file
- Collector filter prevents wrong users from interacting
- Game state Maps cleaned up on game over AND timeout
- `collector.stop()` called explicitly on timeout/gameover handlers
- Moderation commands: both `setDefaultMemberPermissions(Administrator)` AND runtime `checkMemberPermissions`
- Economy commands: wallet/bank amounts always clamped to ≥ 0, always integers (Math.floor applied)
- Discord.js API limits: max 5 ActionRows, max 5 buttons per row, max 25 select options, embed fields ≤ 1024 chars

**Agent prompt template:**
> You are the QA Agent for the Angel Discord bot. Read CLAUDE.md fully first. Then review these files: [list files]. For each file report PASS or FAIL with line numbers for every issue. Check against all conventions in CLAUDE.md. End with a must-fix list and a verdict.

---

### Agent 3 — Creative Director

**Role:** Ongoing research and strategic direction. Monitors Discord bot trends, competitor features, player psychology, and UX patterns. Sends reports and recommendations to the user. Does NOT write code.

**Startup behavior:**
1. Read this file fully, especially Current Work and Backlog.
2. Research what's trending in Discord bots right now (new features, popular commands, UX shifts).
3. Evaluate the current bot against competitors and identify the highest-impact gaps.
4. Report findings to the user with specific, prioritized recommendations.
5. Continue monitoring between sessions — each new session should include fresh research.

**Standing research areas:**
- Discord Components V2 adoption — what new bots are using it for
- Economy bot meta — what Dank Memer, UnbelievaBoat, Tatsu are adding
- Game bot trends — most-played games, new mechanics competitors are shipping
- Missing utility commands — what server admins request most
- Discord platform changes — API updates, new primitives, deprecations

**Agent prompt template:**
> You are the Creative Director for the Angel Discord bot. Read CLAUDE.md fully. Research current Discord bot trends using WebSearch. Evaluate what the bot is missing compared to popular bots. Report findings with specific recommendations and priority ratings. Focus on what would drive the most user engagement relative to implementation effort.

---

## Current Work (as of 2026-03-24)

### Completed ✅
- Full moderation suite — 10 commands, all Administrator-only, security-audited
- Full utility suite — 22 commands
- 11 games — tictactoe, rps, higherorlower, hangman, fastmath, blackjack, wordle, connectfour, wordchain, 2048, battleship (all QA-reviewed)
- Security audit — 20 fixes verified across all files
- Economy foundation — coinStore, dailyStore, workStore + 8 commands (/daily, /balance, /deposit, /withdraw, /work, /pay, /rob, /crime) + /leaderboard coins extension (QA-cleared)
- Shop item catalog designed by Creative Director (see Shop System Design section)

### Backlog (work in this exact order)
1. **Post-game stats + rematch** — `gameStatsStore.js` tracking wins/losses/streaks per user per guild per game; rematch button after every game ends; extend `/leaderboard` with `game:<name>` option showing win counts
2. **Shop system** — `/shop` (browse), `/buy <item>`, `/inventory`, `/use <item>` + `inventoryStore.js` + `shopCatalog.js` (static global catalog) + `shopConfigStore.js` (per-guild admin roles). See Shop System Design below for full spec.
3. **Missing utility commands** — `/define` (Free Dictionary API), `/urban` (Urban Dictionary API), `/calculator` (expression evaluator), `/timestamp` (converts input to Discord `<t:unix:R>`), `/serverinfo` (dedicated server stats)
4. **Components V2 UI** — adopt for shop and inventory displays. `Container`/`Section`/`TextDisplay` instead of `EmbedBuilder`. Only for new commands — do not rewrite existing ones.
5. **Welcome/onboarding wizard** — `/setup-welcome` combining welcome embed config + rules acknowledgment button + auto-role on click. Reuses reaction role infrastructure.
6. **Daily quest system** — `questStore.js` assigning 3 random quests per user per day from a pool of actions the bot already tracks (play games, use daily, win trivia, etc.). Coin/XP reward on completion.
7. **Birthday system** — `/birthday set <date>`, `/birthday channel <channel>`. Announces birthdays in the configured channel.

---

## All Commands (current)

### Utility (src/commands/utility/)
`ping`, `help`, `info`, `userinfo`, `avatar`, `serveravatar`, `roleinfo`, `poll`, `remind`, `rank`, `leaderboard`, `reactionrole`, `giveaway`, `ticket`, `8ball`, `coinflip`, `ship`, `snipe`, `editsnipe`, `trivia`, `weather`, `translate`

### Moderation (src/commands/moderation/) — Administrator only
`kick`, `ban`, `unban`, `mute`, `warn`, `purge`, `slowmode`, `automod`, `statschannel`, `embedbuilder`

### Games (src/commands/games/)
`tictactoe`, `rps`, `higherorlower`, `hangman`, `fastmath`, `blackjack`, `wordle`, `connectfour`, `wordchain`, `2048`, `battleship`

### Economy (src/commands/economy/)
`daily`, `balance`, `deposit`, `withdraw`, `work`, `pay`, `rob`, `crime`

---

## Run Commands

```bash
npm start          # Run the bot
npm run dev        # Run with --watch (auto-restart on file changes)
npm run deploy     # Manually push slash commands to Discord via REST API
```

Slash commands auto-deploy on every `ready` event. Manual deploy only needed when bot isn't running.

---

## Architecture

Handler-based dynamic loader. `src/index.js` creates the Discord client, then delegates:

- **`src/handlers/commandHandler.js`** — scans `src/commands/<category>/`, validates `{ data, execute }`, stamps `command.category = folderName`, registers in `client.commands` Collection.
- **`src/handlers/eventHandler.js`** — scans `src/events/`, registers via `client.on`/`client.once`.
- **`src/handlers/deployCommands.js`** — REST API deployment. Guild-scoped when `GUILD_ID` set (instant), global otherwise (up to 1 hour).

**Adding a command:** Drop `.js` in `src/commands/<category>/`. Export `{ data: SlashCommandBuilder, execute: async (interaction) => {} }`. No registration needed.

**Adding an event:** Drop `.js` in `src/events/`. Export `{ name, once?, execute: async (...args, client) => {} }`.

---

## Utilities (src/utils/)

| File | Purpose |
|---|---|
| `embed.js` | `successEmbed`, `errorEmbed`, `warningEmbed`, `infoEmbed`, `createBaseEmbed` — all produce `EmbedBuilder` with color/footer/timestamp |
| `permissions.js` | `checkBotPermissions(interaction, perms[])` and `checkMemberPermissions(interaction, perms[])` — ephemeral error + return false if missing |
| `logger.js` | ANSI structured logger. Levels: error > warn > info > debug. `LOG_LEVEL` env var controls output. |
| `warnStore.js` | `Map<guildId, Map<userId, WarnEntry[]>>`. In-memory, lost on restart. |
| `xpStore.js` | `addXp(guildId, userId, amount)` → `{ xp, level, leveledUp }`. Formula: `0.1 * sqrt(xp)`. 60s cooldown. |
| `modLog.js` | `sendModLog(guild, action, { moderator, target, reason })`. Finds #mod-log/#modlog/#audit-log. Sanitizes @everyone/@here. Actions: BAN/UNBAN/KICK/MUTE/WARN/PURGE/TICKET_CLOSE |
| `reactionRoleStore.js` | `Map<messageId, Map<customId, roleId>>`. `setRoleMessage`, `getRoleForButton`, `isRoleMessage`. |
| `giveawayStore.js` | Active giveaways, Fisher-Yates winner selection. Max 5 per guild. Stores `guildId`. |
| `ticketStore.js` | Guild ticket config + open tickets. `getUserTicket(guildId, userId)` for dupe detection. |
| `snipeStore.js` | Guild-scoped `Map<guildId, Map<channelId, data>>`. 1-hour TTL. Last deleted + last edited per channel. |
| `automodStore.js` | Rule toggles + spam tracking. 10-min TTL sweep with `.unref()`. Constants from `config.moderation.automod`. |
| `statsStore.js` | Per-guild stat channel IDs. `updateStatChannels(guild)` on member join/leave. Rate-limited to ~2 renames/10 min/channel. |
| `coinStore.js` | Per-guild economy. `Map<guildId, Map<userId, { wallet, bank }>>`. `getBalance`, `addToWallet`, `deposit`, `withdraw`, `setWallet`, `setBank`, `getLeaderboard`. All amounts clamped ≥ 0. |
| `dailyStore.js` | Daily claim tracking. 20h cooldown. 48h gap resets streak to 1. `canClaim`, `recordClaim`, `getStreak`, `getLastClaim`. |
| `workStore.js` | Work cooldown (1h). `canWork`, `recordWork`, `getTimeRemaining` (returns 0 when ready, never negative). |

---

## Games Architecture

All 11 games in `src/commands/games/`. Each game:
- In-memory state Map defined at top of command file (not a separate util)
- `message.createMessageComponentCollector({ time: 300000 })` for button/select UI
- `interaction.awaitModalSubmit({ filter, time: 60000 })` for text input
- Map entry deleted on game over AND in `collector.on('end')` cleanup
- `collector.stop('gameover')` called explicitly when game ends mid-session

| Game | Mode | Bot AI |
|---|---|---|
| tictactoe | PvP / Solo | Minimax + alpha-beta (perfect, unbeatable) |
| rps | PvP / Solo | Bayesian frequency table — predicts and counters |
| higherorlower | Solo | Adversarial number selection — range contracts based on revealed secret |
| hangman | Solo | Word tiers: easy (4-5 letters), medium (6-7), hard (8+ with trap letters Q/X/Z) |
| fastmath | PvP / Solo | Configurable bot timer (easy:10s, medium:5s, hard:2s) |
| blackjack | Solo | Dealer stands on all 17s (S17). Ace = 11 or 1 (optimal). |
| wordle | Solo | Entropy-hard word list; prefers words player has never solved |
| connectfour | PvP / Solo | Minimax + alpha-beta, depth 6 |
| wordchain | PvP / Solo | Trap letter strategy (ends words on X, Q, Z, J, V) |
| 2048 | Solo | No bot — pure puzzle. `customId` format: `2048_{gameId}_{direction}` (split index [2]) |
| battleship | Solo | Probability heat map with hunt/target mode |

---

## Economy Architecture

Per-guild throughout: `Map<guildId, Map<userId, data>>`.

| Command | Cooldown | Payout |
|---|---|---|
| `/daily` | 20h | 200 base × streak multiplier (1.5x day3, 2x day7, 3x day14, 5x day30) |
| `/work` | 1h | 50–150 coins, random flavor text |
| `/crime` | 1h | 45% success: 200–600 coins; fail: lose 100–300 (clamped to wallet) |
| `/rob @user` | 3h | 40% success: steal 20–40% of target wallet (min 100 in wallet); fail: lose 100 coins |
| `/pay @user` | — | Wallet-to-wallet transfer |
| `/deposit` / `/withdraw` | — | Move between wallet and bank |

Rob and crime cooldowns stored in module-level Maps in their respective command files (not shared stores). All coin amounts are integers; `Math.floor` applied at point of calculation.

---

## Shop System Design

### Economics Baseline
Active player earns ~600–900 coins/day. Price tiers:
- Cheap: 150–600 (1 day)
- Premium: 3,500–6,000 (1 week)
- Prestige: 15,000+ (1 month)

### Stores to Build
- `src/utils/inventoryStore.js` — `Map<guildId, Map<userId, { items: [{itemId, quantity, expiresAt, metadata}], badges: Set<string>, activeEffects: { xpBoost?: {multiplier, expiresAt}, padlock?: {expiresAt}, crimeInsurance?: boolean, workReset?: boolean, dailyReset?: boolean }, debt: null|{amount,dueAt}, title: null|{text,expiresAt} }>>`
- `src/utils/shopCatalog.js` — static array of all global item definitions
- `src/utils/shopConfigStore.js` — `Map<guildId, { roles: [{roleId, price}], customItems: [] }>`
- 5-minute expiry sweep with `.unref()` inside `inventoryStore.js`

### Effect Hook Locations
| Effect | Where to check |
|---|---|
| XP Boost | `xpStore.addXp()` — check `activeEffects.xpBoost` |
| Padlock / Rob Shield | `/rob` — check `activeEffects.padlock` before resolving |
| Crime Insurance | `/crime` — check `activeEffects.crimeInsurance` before applying penalty |
| Work/Daily Reset | `/work`, `/daily` — check reset flags, clear after use |
| Game power-ups | Each game command — check inventory at game init |
| Title / Badges | Embed helpers — `inventoryStore.getUser()` appended to rank/balance embeds |

### Item Catalog Build Order

**Tier 1 — Utility (build first)**
| Item | Price | Type |
|---|---|---|
| Padlock | 600 | 24h effect |
| Work Reset | 400 | One-use |
| Crime Insurance | 350 | One-use |
| XP Boost (1h) | 500 | 1h effect |
| Rob Shield | 200 | 6h effect |
| XP Boost (8h) | 2,800 | 8h effect |
| Daily Reset | 800 | One-use |

**Tier 2 — Coin Sinks**
| Item | Price | Notes |
|---|---|---|
| Mystery Box | 750 | 70% common / 25% rare / 5% legendary. EV ~600 (net sink). Max 3/day. |
| Coin Doubler Gamble | 1,000 | 45% win 2,000 / 55% lose 1,000. Max 2/day. |
| Loan | Free to take | Borrow 500; repay 600 in 48h or work/daily intercepted until cleared |

**Tier 3 — Game Power-Ups**
| Item | Price | Game |
|---|---|---|
| Extra Life | 150 | Hangman (+2 wrong guesses) |
| Extra Time | 100 | Fast Math (+5s) |
| Skip Turn | 150 | Word Chain |
| 50/50 | 200 | Trivia (remove 2 wrong options) |
| Safety Net | 300 | Higher or Lower (protect streak ≥5) |
| Reveal Tile | 250 | Wordle |
| Blackjack Insurance | 400 | Blackjack |
| Board Reshuffle | 350 | 2048 |
| Undo Move | 300 | Connect Four / Battleship |
| Double or Nothing | 200 | TTT / RPS wager multiplier |

**Tier 4 — Vanity**
| Item | Price | Type |
|---|---|---|
| Custom Title | 2,000 | 30d (shows in /rank + /balance) |
| Gold Star Badge | 5,000 | Permanent |
| Diamond Badge | 15,000 | Permanent |
| Rich Flex | 500 | One-use channel broadcast |
| Color Role | Admin-set | Persistent role via `/shop configure` |

**Tier 5 — Future Collectibles**
Seasonal limited-quantity items, Numbered Edition Trophies (milestone-triggered).

---

## Key Conventions

- **CommonJS** throughout. `'use strict'` at top of every file. No ES module syntax.
- **Moderation commands** — `setDefaultMemberPermissions(Administrator)` + runtime `checkMemberPermissions`. Role hierarchy check. DM target with `.catch(() => null)`. Then execute.
- **Catch blocks** — check `interaction.replied || interaction.deferred` first. Use `followUp` if true, `reply` if false. Never expose `error.message` — always use `'An unexpected error occurred. Please try again later.'`
- **Discord.js v14 avatar/icon** — `{ extension: 'gif', forceStatic: false }`. Never `{ dynamic: true }` or `{ format: ... }`.
- **`setDMPermission(false)`** on all guild-only commands.
- **Economy amounts** — always integers. Apply `Math.floor` at calculation. Clamp to ≥ 0. Never allow negative balances.
- **In-memory stores** — all data lost on restart. Document this clearly if adding new stores. When a persistent DB is added, swap in `better-sqlite3` — do not add any other DB dependency.
- **External APIs** — `encodeURIComponent` all user-provided query params. Validate URLs with `new URL()` constructor + `https:` check. Use Node 18 built-in `fetch`, no extra packages.
- **Stat channels** — voice channels, rate-limited to ~2 renames/10 min/channel. Do not call `updateStatChannels` more frequently.
- **Automod immunity** — `PermissionFlagsBits.Administrator` only (not ManageMessages).
- **Snipe store** — guild-scoped. Never cross-guild.
- **Components V2** — adopt for new shop/economy commands. `Container`, `Section`, `TextDisplay`. Do not rewrite existing commands. Set `IS_COMPONENTS_V2` flag (`1 << 15`) on V2 messages.

---

## Button CustomId Naming Convention

| Feature | Pattern |
|---|---|
| Giveaway | `giveaway_enter_{messageId}` |
| Ticket | `ticket_create` |
| Reaction Role | `rr_{index}_{roleId}` |
| Leaderboard pagination | `lb_prev`, `lb_next` |
| Trivia answers | `trivia_a`, `trivia_b`, `trivia_c`, `trivia_d` |
| Tic-Tac-Toe | `ttt_{gameId}_{position}` (0–8) |
| RPS | `rps_{gameId}_{rock\|paper\|scissors}` |
| Higher or Lower | `hol_{gameId}_{higher\|lower}` |
| Connect Four | `c4_{gameId}_col_{0-6}` |
| Blackjack | `bj_{gameId}_{hit\|stand\|double}` |
| Battleship | `bs_{gameId}_fire_{row}_{col}` |
| 2048 | `2048_{gameId}_{up\|down\|left\|right}` — direction at split index **[2]** |
| Fast Math | `fm_{gameId}_answer` |
| Word Chain | `wc_{gameId}_word` |
| Hangman | `hangman_{gameId}_guess` |

---

## Security Rules (QA-verified)

- All moderation commands: `Administrator` — both Discord UI gate and runtime check
- Automod immunity: `Administrator` (not ManageMessages)
- Snipe store: guild-scoped, no cross-guild leakage
- Error messages: generic strings only, never `error.message`
- External API inputs: `encodeURIComponent` applied
- URL validation: `new URL()` + `https:` protocol
- `@everyone`/`@here` in mod-log reasons: zero-width space inserted
- Warn clear reply: ephemeral
- Giveaway: max 5 active per guild, `guildId` stored on entry
- Reminders: max 5 active per user

---

## Configuration (config.js)

Loaded from `.env` via `dotenv`. `validateConfig()` throws on missing `DISCORD_TOKEN` or `CLIENT_ID`.

```
DISCORD_TOKEN   # Required
CLIENT_ID       # Required
GUILD_ID        # Optional — guild-scoped deploy (instant) vs global (up to 1h)
LOG_LEVEL       # Optional — error|warn|info|debug (default: info)
PREFIX          # Optional — reserved for future prefix command support
```

Color palette (use these, never hardcode hex in commands):
```js
config.colors.primary   // 0x7c3aed — purple
config.colors.success   // 0x22c55e — green
config.colors.warning   // 0xf59e0b — amber
config.colors.error     // 0xef4444 — red
config.colors.info      // 0x3b82f6 — blue
config.colors.neutral   // 0x6b7280 — gray
```

---

## External APIs (all free, no key required)

| API | Used in | URL |
|---|---|---|
| Open Trivia DB | trivia.js | `opentdb.com/api.php` |
| Open-Meteo weather | weather.js | `api.open-meteo.com` |
| Open-Meteo geocoding | weather.js | `geocoding-api.open-meteo.com` |
| MyMemory translation | translate.js | `api.mymemory.translated.net` |
| Free Dictionary | (planned /define) | `api.dictionaryapi.dev` |
| Urban Dictionary | (planned /urban) | `api.urbandictionary.com` |

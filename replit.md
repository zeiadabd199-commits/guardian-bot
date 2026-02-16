# Guardian Discord Bot

## Overview

Guardian is a Discord bot built with Node.js that provides server management and verification features. The bot uses a modular architecture where features (like the "introduce" verification module) are self-contained and can be enabled/disabled per guild. It includes a REST API (Express) for a future dashboard, stores per-guild configuration in MongoDB via Mongoose, and uses discord.js v14 for Discord integration.

The primary feature currently implemented is an **introduce/verification module** that handles new member onboarding — assigning pending roles, requiring a trigger word for verification, swapping roles on success, and sending configurable messages/embeds.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Project Structure

```
src/
├── index.js              # Entry point — bootstraps bot + API
├── bot.js                # Discord client setup and initialization
├── api.js                # Express API server setup
├── config/
│   └── environment.js    # Environment variable loading (dotenv)
├── core/
│   ├── database.js       # MongoDB connection + GuildConfig model
│   ├── logger.js         # Simple timestamp logger
│   ├── cache.js          # In-memory Map-based cache
│   └── permissions.js    # Permission checking utilities
├── events/               # Discord event handlers (auto-loaded)
│   ├── ready.js
│   ├── interactionCreate.js
│   ├── messageCreate.js
│   └── guildMemberAdd.js
├── commands/             # Slash commands (folder-based, auto-loaded)
│   └── introduce/index.js
├── modules/              # Feature modules (folder-based, auto-loaded)
│   └── introduce/
│       ├── index.js        # Module entry, subcommand routing
│       ├── actions.js      # Core verification logic
│       ├── checker.js      # Permission & module state checks
│       └── config.schema.js # Default config shape & validation
├── dashboard/
│   └── routes/
│       └── guildConfig.js  # REST API routes for guild config
├── loaders/
│   ├── events.js         # Auto-loads all event files
│   ├── commands.js        # Auto-loads & registers slash commands
│   └── modules.js        # Auto-loads feature modules
└── utils/
    └── embedBuilder.js   # Reusable embed construction helper
```

### Key Design Patterns

**Auto-loading system**: Events, commands, and modules are all loaded dynamically by scanning their respective directories. Commands live in `src/commands/<name>/index.js`, events in `src/events/<name>.js`, and modules in `src/modules/<name>/index.js`. Each must export a default object with expected properties (`name`, `execute`/`init`, etc.).

**Per-guild configuration**: All guild-specific settings are stored in MongoDB using a single `GuildConfig` document per guild. Module configs live under `modules.<moduleName>` using Mongoose's `Mixed` type, giving flexibility to evolve module schemas without database migrations.

**Module architecture**: Each module is a self-contained folder with its own config schema, actions, and permission checks. Modules define an `init()` method called at startup and export handler functions for slash command subcommands. The introduce module demonstrates the full pattern.

**Dual runtime**: The app runs both a Discord bot and an Express HTTP server in the same process. The Express API is intended for a dashboard frontend and exposes guild configuration endpoints.

### ES Modules

The project uses ES modules (`"type": "module"` in package.json). All imports use `.js` extensions and `import`/`export` syntax.

### Slash Command Registration

Commands are registered as **guild commands** (not global) using the Discord REST API, scoped to the `GUILD_ID` environment variable. This means commands update instantly but only work in one guild unless the registration logic is expanded.

### Environment Variables Required

- `TOKEN` — Discord bot token (required)
- `CLIENT_ID` — Discord application client ID (for command registration)
- `GUILD_ID` — Target guild for slash command registration
- `MONGO_URI` — MongoDB connection string (defaults to `mongodb://localhost:27017/guardian`)
- `PORT` — HTTP API port (defaults to `5000`)

## External Dependencies

- **discord.js v14** — Discord API client with slash commands, intents, and gateway events
- **mongoose v8** — MongoDB ODM for guild configuration storage
- **express v5** — HTTP server for the dashboard REST API
- **dotenv** — Environment variable loading from `.env` file
- **MongoDB** — Required as the database backend (connection string via `MONGO_URI` env var)

### Notes for Development

- MongoDB must be available for the bot to start (connection failure throws and exits the process)
- Some source files appear truncated (e.g., `database.js`, `introduce/index.js`, `config.schema.js`, `actions.js`, `commands/introduce/index.js`, `messageCreate.js`) — these will need to be completed or regenerated
- The `introduce/index.js` module has a syntax error in its import statement (incomplete destructuring) that needs fixing
- The `commands.js` loader has inconsistent indentation but is functionally correct
- The dashboard API routes are currently stubs returning placeholder data
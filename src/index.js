'use strict';

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { config, validateConfig } = require('../config');
const logger = require('./utils/logger');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');

// Validate environment before doing anything else
try {
  validateConfig();
} catch (err) {
  console.error(`[FATAL] ${err.message}`);
  console.error('Copy .env.example to .env and fill in the required values.');
  process.exit(1);
}

// Create the Discord client with required intents
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

// Load commands and events
loadCommands(client);
loadEvents(client);

// ── Global error handlers ──────────────────────────────────────────────────

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  gracefulShutdown('uncaughtException');
});

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

/**
 * Performs a graceful shutdown: destroys the Discord connection and exits.
 *
 * @param {string} signal
 */
async function gracefulShutdown(signal) {
  logger.info(`Received ${signal} — shutting down gracefully…`);
  try {
    client.destroy();
    logger.info('Discord client destroyed. Goodbye!');
  } catch (err) {
    logger.error('Error during shutdown:', err);
  }
  process.exit(0);
}

// ── Login ──────────────────────────────────────────────────────────────────

logger.info('Starting Angel Bot…');
client.login(config.token).catch((err) => {
  logger.error('Failed to log in to Discord:', err);
  process.exit(1);
});

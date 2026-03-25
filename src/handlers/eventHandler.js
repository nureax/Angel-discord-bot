'use strict';

const fs = require('node:fs');
const path = require('node:path');
const logger = require('../utils/logger');

/**
 * Dynamically loads all event files from the events directory
 * and registers them on the Discord client.
 *
 * @param {import('discord.js').Client} client
 */
function loadEvents(client) {
  const eventsPath = path.join(__dirname, '..', 'events');
  const eventFiles = fs
    .readdirSync(eventsPath)
    .filter((file) => file.endsWith('.js'));

  let loaded = 0;
  let failed = 0;

  for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    try {
      const event = require(filePath);

      if (!event.name || !event.execute) {
        logger.warn(`Event at ${filePath} is missing "name" or "execute" — skipping`);
        failed++;
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }

      logger.debug(`Loaded event: ${event.name} (once=${!!event.once})`);
      loaded++;
    } catch (err) {
      logger.error(`Failed to load event ${filePath}:`, err);
      failed++;
    }
  }

  logger.info(`Events loaded: ${loaded} succeeded, ${failed} failed`);
}

module.exports = { loadEvents };

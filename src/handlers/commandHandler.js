'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Collection } = require('discord.js');
const logger = require('../utils/logger');

/**
 * Dynamically loads all command files from the commands directory
 * and registers them in client.commands.
 *
 * @param {import('discord.js').Client} client
 */
function loadCommands(client) {
  client.commands = new Collection();

  const commandsPath = path.join(__dirname, '..', 'commands');
  const categories = fs.readdirSync(commandsPath);

  let loaded = 0;
  let failed = 0;

  for (const category of categories) {
    const categoryPath = path.join(commandsPath, category);
    const stat = fs.statSync(categoryPath);
    if (!stat.isDirectory()) continue;

    const commandFiles = fs
      .readdirSync(categoryPath)
      .filter((file) => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(categoryPath, file);
      try {
        const command = require(filePath);

        // Validate command structure
        if (!command.data || !command.execute) {
          logger.warn(`Command at ${filePath} is missing "data" or "execute" — skipping`);
          failed++;
          continue;
        }

        command.category = category;
        client.commands.set(command.data.name, command);
        logger.debug(`Loaded command: ${command.data.name} (${category}/${file})`);
        loaded++;
      } catch (err) {
        logger.error(`Failed to load command ${filePath}:`, err);
        failed++;
      }
    }
  }

  logger.info(`Commands loaded: ${loaded} succeeded, ${failed} failed`);
}

module.exports = { loadCommands };

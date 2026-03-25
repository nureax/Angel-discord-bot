'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
const { config, validateConfig } = require('../../config');
const logger = require('../utils/logger');

/**
 * Collects all command data objects and deploys them via the Discord REST API.
 * Registers globally if GUILD_ID is not set, otherwise registers to the dev guild.
 */
async function deployCommands() {
  validateConfig();

  const commands = [];
  const commandsPath = path.join(__dirname, '..', 'commands');
  const categories = fs.readdirSync(commandsPath);

  for (const category of categories) {
    const categoryPath = path.join(commandsPath, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith('.js'));
    for (const file of files) {
      try {
        const command = require(path.join(categoryPath, file));
        if (command.data) {
          commands.push(command.data.toJSON());
        }
      } catch (err) {
        logger.warn(`Skipping ${category}/${file} — failed to load: ${err.message}`);
      }
    }
  }

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    logger.info(`Deploying ${commands.length} slash command(s)…`);

    let data;
    if (config.guildId) {
      data = await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commands },
      );
      logger.info(`Successfully deployed ${data.length} command(s) to guild ${config.guildId}`);
    } else {
      data = await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands },
      );
      logger.info(`Successfully deployed ${data.length} command(s) globally`);
    }
  } catch (err) {
    logger.error('Failed to deploy commands:', err);
    throw err;
  }
}

module.exports = { deployCommands };

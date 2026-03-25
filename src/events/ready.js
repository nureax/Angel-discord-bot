'use strict';

const { ActivityType } = require('discord.js');
const logger = require('../utils/logger');
const { deployCommands } = require('../handlers/deployCommands');

module.exports = {
  name: 'ready',
  once: true,

  async execute(client) {
    logger.info(`Logged in as ${client.user.tag} (${client.user.id})`);
    logger.info(`Serving ${client.guilds.cache.size} guild(s)`);

    // Set bot presence
    client.user.setPresence({
      activities: [{ name: '/help | Angel Bot', type: ActivityType.Listening }],
      status: 'online',
    });

    // Deploy slash commands on startup
    try {
      await deployCommands();
    } catch (err) {
      logger.error('Command deployment failed on ready:', err);
    }
  },
};

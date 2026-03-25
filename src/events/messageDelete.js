'use strict';

const { setSnipe } = require('../utils/snipeStore');
const logger = require('../utils/logger');

module.exports = {
  name: 'messageDelete',

  async execute(message) {
    try {
      // Skip DMs (no guild context for scoping)
      if (!message.guildId) return;
      // Skip bots and messages with no text content
      if (message.author?.bot) return;
      if (!message.content) return;

      setSnipe(message.guildId, message.channel.id, {
        content: message.content,
        author: message.author.tag,
        authorAvatar: message.author.displayAvatarURL({ extension: 'png', size: 256 }),
      });

      logger.debug(
        `Snipe stored for #${message.channel?.name ?? message.channel.id} — author: ${message.author.tag}`,
      );
    } catch (err) {
      logger.error('messageDelete snipe error:', err);
    }
  },
};

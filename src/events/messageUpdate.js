'use strict';

const { setEditSnipe } = require('../utils/snipeStore');
const logger = require('../utils/logger');

module.exports = {
  name: 'messageUpdate',

  async execute(oldMessage, newMessage) {
    try {
      // Skip DMs (no guild context for scoping)
      if (!newMessage.guildId) return;
      // Skip bots
      if (oldMessage.author?.bot) return;

      // Skip partial messages where content isn't cached
      if (!oldMessage.content || !newMessage.content) return;

      // Skip if content is identical (e.g. embed-only edits)
      if (oldMessage.content === newMessage.content) return;

      setEditSnipe(newMessage.guildId, oldMessage.channel.id, {
        before: oldMessage.content,
        after: newMessage.content,
        author: oldMessage.author.tag,
        authorAvatar: oldMessage.author.displayAvatarURL({ extension: 'png', size: 256 }),
      });

      logger.debug(
        `Edit-snipe stored for #${oldMessage.channel?.name ?? oldMessage.channel.id} — author: ${oldMessage.author.tag}`,
      );
    } catch (err) {
      logger.error('messageUpdate edit-snipe error:', err);
    }
  },
};

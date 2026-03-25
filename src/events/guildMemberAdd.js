'use strict';

const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');
const { config } = require('../../config');
const { updateStatChannels } = require('../utils/statsStore');

module.exports = {
  name: 'guildMemberAdd',

  async execute(member, client) {
    logger.info(`Member joined: ${member.user.tag} (${member.user.id}) in ${member.guild.name}`);

    // Try to find a system channel or a channel named "welcome"
    const welcomeChannel =
      member.guild.systemChannel ||
      member.guild.channels.cache.find(
        (ch) => ch.name === 'welcome' && ch.isTextBased(),
      );

    if (!welcomeChannel) return;

    const embed = new EmbedBuilder()
      .setColor(config.colors.success)
      .setTitle('Welcome to the Server!')
      .setDescription(
        `Hey ${member}, welcome to **${member.guild.name}**! 🎉\nWe now have **${member.guild.memberCount}** members.`,
      )
      .setThumbnail(member.user.displayAvatarURL({ extension: 'gif', forceStatic: false }))
      .setTimestamp()
      .setFooter({ text: 'Angel Bot' });

    try {
      await welcomeChannel.send({ embeds: [embed] });
    } catch (err) {
      logger.error(`Failed to send welcome message in ${member.guild.name}:`, err);
    }

    // Update stat channels if configured
    await updateStatChannels(member.guild).catch((err) =>
      logger.error(`Failed to update stat channels on member join in ${member.guild.name}:`, err),
    );
  },
};

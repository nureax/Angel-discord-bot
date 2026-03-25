'use strict';

const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');
const { config } = require('../../config');
const { updateStatChannels } = require('../utils/statsStore');

module.exports = {
  name: 'guildMemberRemove',

  async execute(member, client) {
    logger.info(`Member left: ${member.user.tag} (${member.user.id}) from ${member.guild.name}`);

    // Try to find a system channel or a channel named "goodbye" / "general"
    const channel =
      member.guild.systemChannel ||
      member.guild.channels.cache.find(
        (ch) => (ch.name === 'goodbye' || ch.name === 'general') && ch.isTextBased(),
      );

    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(config.colors.neutral)
      .setTitle('A Member Has Left')
      .setDescription(
        `**${member.user.tag}** has left the server. We now have **${member.guild.memberCount}** members.`,
      )
      .setThumbnail(member.user.displayAvatarURL({ extension: 'gif', forceStatic: false }))
      .setTimestamp()
      .setFooter({ text: 'Angel Bot' });

    try {
      await channel.send({ embeds: [embed] });
    } catch (err) {
      logger.error(`Failed to send goodbye message in ${member.guild.name}:`, err);
    }

    // Update stat channels if configured
    await updateStatChannels(member.guild).catch((err) =>
      logger.error(`Failed to update stat channels on member leave in ${member.guild.name}:`, err),
    );
  },
};

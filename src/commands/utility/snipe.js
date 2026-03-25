'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { createBaseEmbed, errorEmbed } = require('../../utils/embed');
const { getSnipe } = require('../../utils/snipeStore');
const { config } = require('../../../config');
const logger = require('../../utils/logger');

/**
 * Returns a human-readable "time ago" string from a Date.
 * @param {Date} date
 * @returns {string}
 */
function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('Show the last deleted message in this channel')
    .setDMPermission(false),

  async execute(interaction) {
    try {
      const snipe = getSnipe(interaction.guildId, interaction.channel.id);

      if (!snipe) {
        return interaction.reply({
          embeds: [errorEmbed('Nothing to Snipe', 'There are no recently deleted messages in this channel.')],
          ephemeral: true,
        });
      }

      const embed = createBaseEmbed(config.colors.neutral)
        .setTitle('🔍 Deleted Message')
        .setDescription((snipe.content || '*(no text content)*').slice(0, 4096))
        .setAuthor({ name: snipe.author, iconURL: snipe.authorAvatar })
        .addFields({ name: 'Deleted', value: timeAgo(snipe.deletedAt), inline: true });

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error('Snipe command error:', err);
      const errEmbed = errorEmbed('Error', 'An error occurred while retrieving the sniped message.');
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ embeds: [errEmbed], ephemeral: true });
      }
      return interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  },
};

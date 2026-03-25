'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { checkBotPermissions, checkMemberPermissions } = require('../../utils/permissions');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set or disable slowmode in this channel')
    .setDMPermission(false)
    .addIntegerOption((opt) =>
      opt
        .setName('seconds')
        .setDescription('Slowmode delay in seconds (0 = disable, max 21600 = 6 hours)')
        .setMinValue(0)
        .setMaxValue(21600)
        .setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      if (!await checkBotPermissions(interaction, [PermissionFlagsBits.ManageChannels])) return;
      if (!await checkMemberPermissions(interaction, [PermissionFlagsBits.Administrator])) return;

      const seconds = interaction.options.getInteger('seconds');

      await interaction.channel.setRateLimitPerUser(
        seconds,
        `Slowmode set by ${interaction.user.tag}`,
      );

      logger.info(
        `Slowmode set to ${seconds}s in #${interaction.channel.name} by ${interaction.user.tag}`,
      );

      const description = seconds === 0
        ? 'Slowmode has been **disabled** in this channel.'
        : `Slowmode set to **${seconds} second${seconds !== 1 ? 's' : ''}** in this channel.`;

      return interaction.reply({
        embeds: [successEmbed('Slowmode Updated', description)],
      });
    } catch (err) {
      logger.error('Slowmode command error:', err);
      const errEmbed = errorEmbed('Slowmode Failed', 'An error occurred while updating the slowmode.');
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ embeds: [errEmbed], ephemeral: true });
      }
      return interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  },
};

'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { createBaseEmbed, errorEmbed } = require('../../utils/embed');
const { config } = require('../../../config');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serveravatar')
    .setDescription("Display a user's server-specific avatar (falls back to global avatar)")
    .setDMPermission(false)
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('The user whose server avatar to display')
        .setRequired(false),
    ),

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user') ?? interaction.user;
      const member = interaction.guild.members.cache.get(targetUser.id)
        ?? await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      // Prefer guild-specific avatar; fall back to global avatar
      const avatarUrl = member
        ? member.displayAvatarURL({ extension: 'gif', forceStatic: false, size: 1024 })
        : targetUser.displayAvatarURL({ extension: 'gif', forceStatic: false, size: 1024 });

      const avatarUrlPng = member
        ? member.displayAvatarURL({ extension: 'png', size: 1024 })
        : targetUser.displayAvatarURL({ extension: 'png', size: 1024 });

      const avatarUrlJpg = member
        ? member.displayAvatarURL({ extension: 'jpg', size: 1024 })
        : targetUser.displayAvatarURL({ extension: 'jpg', size: 1024 });

      const avatarUrlWebp = member
        ? member.displayAvatarURL({ extension: 'webp', size: 1024 })
        : targetUser.displayAvatarURL({ extension: 'webp', size: 1024 });

      // Determine if the member has a guild-specific avatar
      const hasServerAvatar = member?.avatar !== null && member?.avatar !== undefined;
      const avatarType = hasServerAvatar ? 'Server Avatar' : 'Global Avatar';

      const embed = createBaseEmbed(config.colors.primary)
        .setTitle(`🖼️ ${targetUser.username}'s ${avatarType}`)
        .setImage(avatarUrl)
        .setDescription(`[PNG](${avatarUrlPng}) | [JPG](${avatarUrlJpg}) | [WEBP](${avatarUrlWebp})`);

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error('Serveravatar command error:', err);
      const errEmbed = errorEmbed('Error', 'An error occurred while fetching the server avatar.');
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ embeds: [errEmbed], ephemeral: true });
      }
      return interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  },
};

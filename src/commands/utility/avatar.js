'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { config } = require('../../../config');
const { errorEmbed } = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Display a user\'s avatar in full size')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('The user whose avatar to display').setRequired(false),
    ),

  async execute(interaction) {
    try {
      const target = interaction.options.getUser('user') ?? interaction.user;

      const avatarUrl = target.displayAvatarURL({ extension: 'gif', forceStatic: false, size: 1024 });
      const avatarUrlPng = target.displayAvatarURL({ extension: 'png', size: 1024 });
      const avatarUrlJpg = target.displayAvatarURL({ extension: 'jpg', size: 1024 });
      const avatarUrlWebp = target.displayAvatarURL({ extension: 'webp', size: 1024 });

      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(`🖼️ ${target.tag}'s Avatar`)
        .setImage(avatarUrl)
        .setDescription(`[PNG](${avatarUrlPng}) | [JPG](${avatarUrlJpg}) | [WEBP](${avatarUrlWebp})`)
        .setTimestamp()
        .setFooter({ text: 'Angel Bot' });

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      const errEmbed = errorEmbed('Error', 'An unexpected error occurred. Please try again later.');
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [errEmbed] });
      } else {
        await interaction.reply({ embeds: [errEmbed], ephemeral: true });
      }
    }
  },
};

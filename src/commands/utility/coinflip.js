'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { createBaseEmbed, errorEmbed } = require('../../utils/embed');
const { config } = require('../../../config');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('coinflip')
    .setDescription('Flip a coin and see the result')
    .setDMPermission(false)
    .addStringOption((opt) =>
      opt
        .setName('bet')
        .setDescription('What are you betting? (just for fun)')
        .setRequired(false),
    ),

  async execute(interaction) {
    try {
      const bet = interaction.options.getString('bet');
      const isHeads = Math.random() < 0.5;
      const result = isHeads ? 'Heads!' : 'Tails!';
      const emoji = isHeads ? '🪙' : '🌀';

      let description = `${emoji} The coin landed on **${result}**`;
      if (bet) {
        description += `\n\nYou bet: *${bet}*`;
        description += isHeads
          ? '\n\nLooks like fortune favours you today! 🎉'
          : '\n\nBetter luck next time! 😅';
      }

      const embed = createBaseEmbed(config.colors.primary)
        .setTitle('🪙 Coin Flip')
        .setDescription(description);

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error('Coinflip command error:', err);
      const errEmbed = errorEmbed('Error', 'An error occurred while flipping the coin.');
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ embeds: [errEmbed], ephemeral: true });
      }
      return interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  },
};

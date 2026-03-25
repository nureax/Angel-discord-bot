'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { infoEmbed, errorEmbed } = require('../../utils/embed');
const { getBalance } = require('../../utils/coinStore');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your coin balance or another user\'s balance')
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('The user whose balance to view (default: yourself)')
        .setRequired(false),
    )
    .setDMPermission(false),

  async execute(interaction) {
    try {
      const target = interaction.options.getUser('user') ?? interaction.user;
      const { guildId } = interaction;

      if (target.bot) {
        const embed = errorEmbed('Invalid User', 'Bots do not have coin balances.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      const { wallet, bank } = getBalance(guildId, target.id);
      const total = wallet + bank;

      const embed = infoEmbed(
        `${target.username}'s Balance`,
        [
          `**Wallet:** ${wallet.toLocaleString()} coins`,
          `**Bank:** ${bank.toLocaleString()} coins`,
          `**Total:** ${total.toLocaleString()} coins`,
        ].join('\n'),
      ).setThumbnail(target.displayAvatarURL({ extension: 'gif', forceStatic: false }));

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error('Balance command error:', err);
      const embed = errorEmbed('Error', 'An unexpected error occurred. Please try again later.');
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ embeds: [embed], ephemeral: true });
      }
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

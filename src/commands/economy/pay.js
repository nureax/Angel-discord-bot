'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { getBalance, addToWallet } = require('../../utils/coinStore');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Pay another user coins from your wallet')
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('The user to pay')
        .setRequired(true),
    )
    .addIntegerOption((opt) =>
      opt
        .setName('amount')
        .setDescription('Amount to pay (min 1)')
        .setMinValue(1)
        .setRequired(true),
    )
    .setDMPermission(false),

  async execute(interaction) {
    try {
      const { guildId, user: sender } = interaction;
      const recipient = interaction.options.getUser('user');
      const amount = interaction.options.getInteger('amount');

      if (recipient.id === sender.id) {
        const embed = errorEmbed('Invalid Target', 'You cannot pay yourself.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (recipient.bot) {
        const embed = errorEmbed('Invalid Target', 'You cannot pay a bot.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      const { wallet: senderWallet } = getBalance(guildId, sender.id);

      if (senderWallet < amount) {
        const embed = errorEmbed(
          'Insufficient Funds',
          `You only have **${senderWallet.toLocaleString()} coins** in your wallet. You need **${amount.toLocaleString()}**.`,
        );
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      addToWallet(guildId, sender.id, -amount);
      addToWallet(guildId, recipient.id, amount);

      const embed = successEmbed(
        'Payment Sent',
        `<@${sender.id}> paid <@${recipient.id}> **${amount.toLocaleString()} coins**.`,
      );

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error('Pay command error:', err);
      const embed = errorEmbed('Error', 'An error occurred while processing the payment.');
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ embeds: [embed], ephemeral: true });
      }
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

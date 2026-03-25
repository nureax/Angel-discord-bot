'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { getBalance, withdraw } = require('../../utils/coinStore');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('withdraw')
    .setDescription('Withdraw coins from your bank into your wallet')
    .addIntegerOption((opt) =>
      opt
        .setName('amount')
        .setDescription('Amount to withdraw (min 1)')
        .setMinValue(1)
        .setRequired(false),
    )
    .addBooleanOption((opt) =>
      opt
        .setName('all')
        .setDescription('Withdraw your entire bank balance')
        .setRequired(false),
    )
    .setDMPermission(false),

  async execute(interaction) {
    try {
      const { guildId, user } = interaction;
      const withdrawAll = interaction.options.getBoolean('all') ?? false;
      const amountOpt = interaction.options.getInteger('amount');

      const { wallet: walletBefore, bank: bankBefore } = getBalance(guildId, user.id);

      if (bankBefore <= 0) {
        const embed = errorEmbed('Empty Bank', 'You have no coins in your bank to withdraw.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      let requestedAmount;
      if (withdrawAll) {
        requestedAmount = bankBefore;
      } else if (amountOpt !== null) {
        requestedAmount = amountOpt;
      } else {
        const embed = errorEmbed('Missing Amount', 'Please specify an `amount` or set `all` to `true`.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (requestedAmount <= 0) {
        const embed = errorEmbed('Invalid Amount', 'Amount must be at least 1 coin.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      const actual = withdraw(guildId, user.id, requestedAmount);

      if (actual === 0) {
        const embed = errorEmbed('Insufficient Funds', `You only have **${bankBefore.toLocaleString()} coins** in your bank.`);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      const { wallet: walletAfter, bank: bankAfter } = getBalance(guildId, user.id);

      const embed = successEmbed(
        'Withdrawal Successful',
        [
          `Withdrew **${actual.toLocaleString()} coins** from your bank.`,
          '',
          `**Wallet:** ${walletBefore.toLocaleString()} → ${walletAfter.toLocaleString()}`,
          `**Bank:** ${bankBefore.toLocaleString()} → ${bankAfter.toLocaleString()}`,
        ].join('\n'),
      );

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error('Withdraw command error:', err);
      const embed = errorEmbed('Error', 'An unexpected error occurred. Please try again later.');
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ embeds: [embed], ephemeral: true });
      }
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

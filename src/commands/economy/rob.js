'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed, warningEmbed } = require('../../utils/embed');
const { getBalance, addToWallet } = require('../../utils/coinStore');
const logger = require('../../utils/logger');

/** @type {Map<string, Map<string, number>>} robCooldowns[guildId][userId] = timestamp */
const robCooldowns = new Map();

const ROB_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 hours
const MIN_TARGET_WALLET = 100;
const SUCCESS_CHANCE = 0.4; // 40%
const FINE_AMOUNT = 100;

/**
 * Checks if a robber can attempt a rob in this guild.
 *
 * @param {string} guildId
 * @param {string} userId
 * @returns {boolean}
 */
function canRob(guildId, userId) {
  if (!robCooldowns.has(guildId)) return true;
  const guild = robCooldowns.get(guildId);
  if (!guild.has(userId)) return true;
  return Date.now() - guild.get(userId) >= ROB_COOLDOWN_MS;
}

/**
 * Returns ms remaining on the rob cooldown (0 if ready).
 *
 * @param {string} guildId
 * @param {string} userId
 * @returns {number}
 */
function robTimeRemaining(guildId, userId) {
  if (!robCooldowns.has(guildId)) return 0;
  const guild = robCooldowns.get(guildId);
  if (!guild.has(userId)) return 0;
  const elapsed = Date.now() - guild.get(userId);
  return Math.max(0, ROB_COOLDOWN_MS - elapsed);
}

/**
 * Records a rob attempt timestamp.
 *
 * @param {string} guildId
 * @param {string} userId
 */
function recordRob(guildId, userId) {
  if (!robCooldowns.has(guildId)) robCooldowns.set(guildId, new Map());
  robCooldowns.get(guildId).set(userId, Date.now());
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rob')
    .setDescription('Attempt to rob another user\'s wallet (3-hour cooldown)')
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('The user to rob')
        .setRequired(true),
    )
    .setDMPermission(false),

  async execute(interaction) {
    try {
      const { guildId, user: robber } = interaction;
      const target = interaction.options.getUser('user');

      if (target.id === robber.id) {
        const embed = errorEmbed('Nice Try', 'You cannot rob yourself.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (target.bot) {
        const embed = errorEmbed('Invalid Target', 'You cannot rob a bot.');
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (!canRob(guildId, robber.id)) {
        const remaining = robTimeRemaining(guildId, robber.id);
        const readyUnix = Math.floor((Date.now() + remaining) / 1000);
        const embed = errorEmbed(
          'Laying Low',
          `You need to lay low after your last heist. You can rob again <t:${readyUnix}:R>.`,
        );
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      const { wallet: targetWallet } = getBalance(guildId, target.id);

      if (targetWallet < MIN_TARGET_WALLET) {
        const embed = warningEmbed(
          'Not Worth It',
          `<@${target.id}> only has **${targetWallet.toLocaleString()} coins** in their wallet. Not worth the risk (minimum ${MIN_TARGET_WALLET}).`,
        );
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      recordRob(guildId, robber.id);

      const success = Math.random() < SUCCESS_CHANCE;

      if (success) {
        const stealPercent = Math.random() * 0.2 + 0.2; // 20–40%
        const stolen = Math.max(1, Math.floor(targetWallet * stealPercent));

        addToWallet(guildId, target.id, -stolen);
        addToWallet(guildId, robber.id, stolen);

        const embed = successEmbed(
          'Heist Successful!',
          [
            `You snuck into <@${target.id}>'s wallet and made off with **${stolen.toLocaleString()} coins**!`,
            `That's ${Math.round(stealPercent * 100)}% of their wallet. Slick work.`,
          ].join('\n'),
        );
        return interaction.reply({ embeds: [embed] });
      } else {
        // Fine the robber
        const { wallet: robberWallet } = getBalance(guildId, robber.id);
        const actualFine = Math.min(FINE_AMOUNT, robberWallet);
        addToWallet(guildId, robber.id, -actualFine);

        const embed = errorEmbed(
          'Caught Red-Handed!',
          [
            `You tried to rob <@${target.id}> but got caught by the authorities!`,
            `You were fined **${actualFine.toLocaleString()} coins** for attempted robbery.`,
          ].join('\n'),
        );
        return interaction.reply({ embeds: [embed] });
      }
    } catch (err) {
      logger.error('Rob command error:', err);
      const embed = errorEmbed('Error', 'An unexpected error occurred. Please try again later.');
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ embeds: [embed], ephemeral: true });
      }
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

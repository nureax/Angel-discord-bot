'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { addToWallet, getBalance } = require('../../utils/coinStore');
const logger = require('../../utils/logger');

/** @type {Map<string, Map<string, number>>} crimeCooldowns[guildId][userId] = timestamp */
const crimeCooldowns = new Map();

const CRIME_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const SUCCESS_CHANCE = 0.45; // 45%

const SUCCESS_TEXTS = [
  'You hacked into a corporate server and extracted some untraceable funds.',
  'You forged some paperwork and collected a lucrative fraudulent refund.',
  'You ran an underground card game and raked in the profits.',
  'You sold a "rare" antique that turned out to be very much fake.',
  'You staged an elaborate con and the mark never knew what hit them.',
  'You cracked a safe in a dusty warehouse and walked away rich.',
];

const FAIL_TEXTS = [
  'You tried to pickpocket someone — turns out they were an off-duty cop.',
  'Your inside man squealed and the whole operation fell apart.',
  'The getaway driver got lost and you were caught at the scene.',
  'Security footage caught your face and you had to pay off someone to stay quiet.',
  'You slipped on a wet floor mid-heist and your cover was blown.',
  'The mark turned out to be armed. You escaped, but emptier-pocketed.',
];

/**
 * Checks if a user can commit a crime in this guild.
 *
 * @param {string} guildId
 * @param {string} userId
 * @returns {boolean}
 */
function canCommitCrime(guildId, userId) {
  if (!crimeCooldowns.has(guildId)) return true;
  const guild = crimeCooldowns.get(guildId);
  if (!guild.has(userId)) return true;
  return Date.now() - guild.get(userId) >= CRIME_COOLDOWN_MS;
}

/**
 * Returns ms remaining on the crime cooldown (0 if ready).
 *
 * @param {string} guildId
 * @param {string} userId
 * @returns {number}
 */
function crimeTimeRemaining(guildId, userId) {
  if (!crimeCooldowns.has(guildId)) return 0;
  const guild = crimeCooldowns.get(guildId);
  if (!guild.has(userId)) return 0;
  const elapsed = Date.now() - guild.get(userId);
  return Math.max(0, CRIME_COOLDOWN_MS - elapsed);
}

/**
 * Records a crime attempt timestamp.
 *
 * @param {string} guildId
 * @param {string} userId
 */
function recordCrime(guildId, userId) {
  if (!crimeCooldowns.has(guildId)) crimeCooldowns.set(guildId, new Map());
  crimeCooldowns.get(guildId).set(userId, Date.now());
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('crime')
    .setDescription('Commit a crime for a chance at big rewards (1-hour cooldown)')
    .setDMPermission(false),

  async execute(interaction) {
    try {
      const { guildId, user } = interaction;

      if (!canCommitCrime(guildId, user.id)) {
        const remaining = crimeTimeRemaining(guildId, user.id);
        const readyUnix = Math.floor((Date.now() + remaining) / 1000);
        const embed = errorEmbed(
          'Too Hot Right Now',
          `You need to wait before committing another crime. You can try again <t:${readyUnix}:R>.`,
        );
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      recordCrime(guildId, user.id);

      const success = Math.random() < SUCCESS_CHANCE;

      if (success) {
        const earned = Math.floor(Math.random() * (600 - 200 + 1)) + 200; // 200–600
        const flavor = SUCCESS_TEXTS[Math.floor(Math.random() * SUCCESS_TEXTS.length)];

        addToWallet(guildId, user.id, earned);

        const embed = successEmbed(
          'Crime Pays (This Time)',
          [
            flavor,
            '',
            `You pocketed **${earned.toLocaleString()} coins**.`,
          ].join('\n'),
        );
        return interaction.reply({ embeds: [embed] });
      } else {
        const penalty = Math.floor(Math.random() * (300 - 100 + 1)) + 100; // 100–300
        const flavor = FAIL_TEXTS[Math.floor(Math.random() * FAIL_TEXTS.length)];

        const { wallet } = getBalance(guildId, user.id);
        const actualLoss = Math.min(penalty, wallet);
        addToWallet(guildId, user.id, -actualLoss);

        const embed = errorEmbed(
          'Crime Doesn\'t Pay',
          [
            flavor,
            '',
            `You lost **${actualLoss.toLocaleString()} coins**.`,
          ].join('\n'),
        );
        return interaction.reply({ embeds: [embed] });
      }
    } catch (err) {
      logger.error('Crime command error:', err);
      const embed = errorEmbed('Error', 'An unexpected error occurred. Please try again later.');
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ embeds: [embed], ephemeral: true });
      }
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

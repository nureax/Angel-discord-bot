'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { canClaim, recordClaim, getStreak, getLastClaim } = require('../../utils/dailyStore');
const { addToWallet } = require('../../utils/coinStore');
const logger = require('../../utils/logger');

const BASE_REWARD = 200;

/**
 * Returns the streak multiplier and label for a given streak count.
 *
 * @param {number} streak
 * @returns {{ multiplier: number, label: string }}
 */
function getStreakMultiplier(streak) {
  if (streak >= 30) return { multiplier: 5, label: '5x (max!)' };
  if (streak >= 14) return { multiplier: 3, label: '3x' };
  if (streak >= 7)  return { multiplier: 2, label: '2x' };
  if (streak >= 3)  return { multiplier: 1.5, label: '1.5x' };
  return { multiplier: 1, label: '1x' };
}

/**
 * Returns the next streak milestone above the current streak.
 *
 * @param {number} streak
 * @returns {string}
 */
function getNextMilestone(streak) {
  if (streak < 3)  return `Day 3 → 1.5x multiplier`;
  if (streak < 7)  return `Day 7 → 2x multiplier`;
  if (streak < 14) return `Day 14 → 3x multiplier`;
  if (streak < 30) return `Day 30 → 5x multiplier`;
  return 'Max multiplier reached!';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily coin reward')
    .setDMPermission(false),

  async execute(interaction) {
    try {
      const { guildId, user } = interaction;

      if (!canClaim(guildId, user.id)) {
        const lastClaim = getLastClaim(guildId, user.id);
        const nextClaimMs = lastClaim.getTime() + (20 * 60 * 60 * 1000);
        const nextClaimUnix = Math.floor(nextClaimMs / 1000);

        const embed = errorEmbed(
          'Already Claimed',
          `You already claimed your daily reward today!\nYou can claim again ${`<t:${nextClaimUnix}:R>`}.`,
        );
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Record the claim first so streak is updated before we read it
      recordClaim(guildId, user.id);
      const streak = getStreak(guildId, user.id);
      const { multiplier, label } = getStreakMultiplier(streak);
      const earned = Math.floor(BASE_REWARD * multiplier);

      addToWallet(guildId, user.id, earned);

      const nextMilestone = getNextMilestone(streak);

      const embed = successEmbed(
        'Daily Reward Claimed!',
        [
          `You received **${earned.toLocaleString()} coins** (${label} multiplier)!`,
          '',
          `**Streak:** ${streak} day${streak === 1 ? '' : 's'} 🔥`,
          `**Next milestone:** ${nextMilestone}`,
        ].join('\n'),
      );

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error('Daily command error:', err);
      const embed = errorEmbed('Error', 'An error occurred while claiming your daily reward.');
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ embeds: [embed], ephemeral: true });
      }
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

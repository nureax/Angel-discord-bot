'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { createBaseEmbed, errorEmbed } = require('../../utils/embed');
const { config } = require('../../../config');
const logger = require('../../utils/logger');

/**
 * Seeded pseudo-random number generator (mulberry32).
 * Produces a consistent float in [0, 1) for the same seed.
 * @param {number} seed
 * @returns {number}
 */
function seededRandom(seed) {
  let t = seed + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Derive a numeric seed from two user ID strings.
 * We combine both IDs to make the score symmetric for the same pair.
 * @param {string} id1
 * @param {string} id2
 * @returns {number}
 */
function pairSeed(id1, id2) {
  // Sort so "A+B" == "B+A" (symmetric score)
  const combined = [id1, id2].sort().join('');
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (Math.imul(31, hash) + combined.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Build a heart-meter bar.
 * @param {number} score 0-100
 * @returns {string}
 */
function heartBar(score) {
  const filled = Math.round(score / 10);
  const empty = 10 - filled;
  return '💗'.repeat(filled) + '🤍'.repeat(empty) + ` ${score}%`;
}

/**
 * Get the compatibility label for a score.
 * @param {number} score
 * @returns {string}
 */
function getLabel(score) {
  if (score <= 20) return 'Just Friends 😐';
  if (score <= 40) return 'Maybe? 🤔';
  if (score <= 60) return 'There\'s Something There 💕';
  if (score <= 80) return 'Strong Connection 💓';
  return 'Perfect Match 💞';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ship')
    .setDescription('Calculate the love compatibility between two users')
    .setDMPermission(false)
    .addUserOption((opt) =>
      opt.setName('user1').setDescription('First user').setRequired(true),
    )
    .addUserOption((opt) =>
      opt.setName('user2').setDescription('Second user').setRequired(true),
    ),

  async execute(interaction) {
    try {
      const user1 = interaction.options.getUser('user1');
      const user2 = interaction.options.getUser('user2');

      if (user1.id === user2.id) {
        return interaction.reply({
          embeds: [errorEmbed('Invalid Pair', 'You cannot ship someone with themselves!')],
          ephemeral: true,
        });
      }

      const seed = pairSeed(user1.id, user2.id);
      const score = Math.floor(seededRandom(seed) * 101); // 0-100

      const bar = heartBar(score);
      const label = getLabel(score);

      const embed = createBaseEmbed(config.colors.primary)
        .setTitle('💘 Ship Calculator')
        .setDescription(
          `**${user1.username}** 💕 **${user2.username}**\n\n` +
          `${bar}\n\n` +
          `**${label}**`,
        );

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error('Ship command error:', err);
      const errEmbed = errorEmbed('Error', 'An error occurred while calculating compatibility.');
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ embeds: [errEmbed], ephemeral: true });
      }
      return interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  },
};

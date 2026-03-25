'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { createBaseEmbed, errorEmbed } = require('../../utils/embed');
const { getUser, levelToXp } = require('../../utils/xpStore');
const { config } = require('../../../config');
const logger = require('../../utils/logger');

/**
 * Builds a text-based progress bar.
 *
 * @param {number} current - Current value
 * @param {number} total   - Max value for this bar
 * @param {number} [length=10] - Total bar segments
 * @returns {string}  e.g. "[████████░░] 80%"
 */
function progressBar(current, total, length = 10) {
  const pct = total <= 0 ? 1 : Math.min(current / total, 1);
  const filled = Math.round(pct * length);
  const empty = length - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${Math.round(pct * 100)}%`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('View your XP rank or another user\'s rank')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('The user to check (defaults to yourself)').setRequired(false),
    )
    .setDMPermission(false),

  async execute(interaction) {
    try {
      const targetUser = interaction.options.getUser('user') ?? interaction.user;

      const { xp, level } = getUser(interaction.guildId, targetUser.id);

      const currentLevelXp = levelToXp(level);       // XP at the start of current level
      const nextLevelXp = levelToXp(level + 1);       // XP needed to reach next level
      const xpIntoLevel = xp - currentLevelXp;        // XP earned within current level
      const xpNeeded = nextLevelXp - currentLevelXp;  // Total XP span for this level

      const bar = progressBar(xpIntoLevel, xpNeeded);

      const embed = createBaseEmbed(config.colors.info)
        .setTitle(`📊 Rank — ${targetUser.username}`)
        .setThumbnail(targetUser.displayAvatarURL({ extension: 'gif', forceStatic: false }))
        .addFields(
          { name: 'Level', value: `**${level}**`, inline: true },
          { name: 'Total XP', value: `**${xp.toLocaleString()}**`, inline: true },
          { name: 'Progress to Next Level', value: `${bar}\n${xpIntoLevel.toLocaleString()} / ${xpNeeded.toLocaleString()} XP` },
        );

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error('Rank command error:', err);
      const errEmbed = errorEmbed('Error', 'An error occurred while fetching rank data.');
      if (interaction.replied || interaction.deferred) {
        return interaction.editReply({ embeds: [errEmbed] });
      }
      return interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  },
};

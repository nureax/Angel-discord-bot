'use strict';

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const { createBaseEmbed, errorEmbed } = require('../../utils/embed');
const { getLeaderboard: getXpLeaderboard } = require('../../utils/xpStore');
const { getLeaderboard: getCoinLeaderboard } = require('../../utils/coinStore');
const { config } = require('../../../config');
const logger = require('../../utils/logger');

const PAGE_SIZE = 10;

/**
 * Builds the XP leaderboard embed for a specific page.
 *
 * @param {import('discord.js').Guild} guild
 * @param {Array<{ userId: string, xp: number, level: number }>} allEntries
 * @param {number} page - 0-indexed page number
 * @returns {import('discord.js').EmbedBuilder}
 */
async function buildXpEmbed(guild, allEntries, page) {
  const start = page * PAGE_SIZE;
  const pageEntries = allEntries.slice(start, start + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(allEntries.length / PAGE_SIZE));

  const lines = await Promise.all(
    pageEntries.map(async (entry, i) => {
      const rank = start + i + 1;
      let displayName = entry.userId;
      try {
        const member = guild.members.cache.get(entry.userId) ?? await guild.members.fetch(entry.userId).catch(() => null);
        displayName = member ? member.user.username : `<@${entry.userId}>`;
      } catch {
        // keep userId as fallback
      }

      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**${rank}.**`;
      return `${medal} **${displayName}** — Level ${entry.level} · ${entry.xp.toLocaleString()} XP`;
    }),
  );

  const description = lines.length > 0 ? lines.join('\n') : '*No one has earned XP yet.*';

  return createBaseEmbed(config.colors.primary)
    .setTitle(`🏆 XP Leaderboard — ${guild.name}`)
    .setDescription(description)
    .setFooter({ text: `Page ${page + 1} of ${totalPages} · Angel Bot` });
}

/**
 * Builds the coin leaderboard embed for a specific page.
 *
 * @param {import('discord.js').Guild} guild
 * @param {Array<{ userId: string, wallet: number, bank: number, total: number }>} allEntries
 * @param {number} page - 0-indexed page number
 * @returns {import('discord.js').EmbedBuilder}
 */
async function buildCoinEmbed(guild, allEntries, page) {
  const start = page * PAGE_SIZE;
  const pageEntries = allEntries.slice(start, start + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(allEntries.length / PAGE_SIZE));

  const lines = await Promise.all(
    pageEntries.map(async (entry, i) => {
      const rank = start + i + 1;
      let displayName = entry.userId;
      try {
        const member = guild.members.cache.get(entry.userId) ?? await guild.members.fetch(entry.userId).catch(() => null);
        displayName = member ? member.user.username : `<@${entry.userId}>`;
      } catch {
        // keep userId as fallback
      }

      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `**${rank}.**`;
      return `${medal} **${displayName}** — ${entry.total.toLocaleString()} total · ${entry.wallet.toLocaleString()} wallet · ${entry.bank.toLocaleString()} bank`;
    }),
  );

  const description = lines.length > 0 ? lines.join('\n') : '*No one has any coins yet.*';

  return createBaseEmbed(config.colors.primary)
    .setTitle(`💰 Coin Leaderboard — ${guild.name}`)
    .setDescription(description)
    .setFooter({ text: `Page ${page + 1} of ${totalPages} · Angel Bot` });
}

/**
 * Builds the previous/next button row.
 *
 * @param {number} page - 0-indexed current page
 * @param {number} totalPages
 * @returns {ActionRowBuilder}
 */
function buildButtons(page, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('lb_prev')
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('lb_next')
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the leaderboard for this server')
    .addStringOption((opt) =>
      opt
        .setName('type')
        .setDescription('Leaderboard type (default: xp)')
        .setRequired(false)
        .addChoices(
          { name: 'XP', value: 'xp' },
          { name: 'Coins', value: 'coins' },
        ),
    )
    .addIntegerOption((opt) =>
      opt
        .setName('page')
        .setDescription('Page number to view (default: 1)')
        .setMinValue(1)
        .setRequired(false),
    )
    .setDMPermission(false),

  async execute(interaction) {
    try {
      const { guildId } = interaction;
      const lbType = interaction.options.getString('type') ?? 'xp';
      const isCoins = lbType === 'coins';

      const allEntries = isCoins
        ? getCoinLeaderboard(guildId, Infinity)
        : getXpLeaderboard(guildId, Infinity);

      const totalPages = Math.max(1, Math.ceil(allEntries.length / PAGE_SIZE));

      const requestedPage = (interaction.options.getInteger('page') ?? 1) - 1;
      let currentPage = Math.min(Math.max(requestedPage, 0), totalPages - 1);

      const embed = isCoins
        ? await buildCoinEmbed(interaction.guild, allEntries, currentPage)
        : await buildXpEmbed(interaction.guild, allEntries, currentPage);

      const row = buildButtons(currentPage, totalPages);

      const reply = await interaction.reply({
        embeds: [embed],
        components: totalPages > 1 ? [row] : [],
        fetchReply: true,
      });

      if (totalPages <= 1) return;

      // Collect button interactions for 30 seconds
      const collector = reply.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 30_000,
      });

      collector.on('collect', async (btn) => {
        // Only let the original invoker navigate
        if (btn.user.id !== interaction.user.id) {
          await btn.reply({ content: 'Only the person who ran this command can navigate pages.', ephemeral: true });
          return;
        }

        if (btn.customId === 'lb_prev') currentPage = Math.max(0, currentPage - 1);
        if (btn.customId === 'lb_next') currentPage = Math.min(totalPages - 1, currentPage + 1);

        const newEmbed = isCoins
          ? await buildCoinEmbed(interaction.guild, allEntries, currentPage)
          : await buildXpEmbed(interaction.guild, allEntries, currentPage);

        const newRow = buildButtons(currentPage, totalPages);

        await btn.update({ embeds: [newEmbed], components: [newRow] });
      });

      collector.on('end', async () => {
        // Disable buttons after timeout
        const disabledRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('lb_prev')
            .setLabel('◀ Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('lb_next')
            .setLabel('Next ▶')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        );
        await interaction.editReply({ components: [disabledRow] }).catch(() => null);
      });
    } catch (err) {
      logger.error('Leaderboard command error:', err);
      const errEmbed = errorEmbed('Error', 'An error occurred while fetching the leaderboard.');
      if (interaction.replied || interaction.deferred) {
        return interaction.editReply({ embeds: [errEmbed] });
      }
      return interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  },
};

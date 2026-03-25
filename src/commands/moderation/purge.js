'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { checkBotPermissions, checkMemberPermissions } = require('../../utils/permissions');
const { sendModLog } = require('../../utils/modLog');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk-delete messages from this channel')
    .addIntegerOption((opt) =>
      opt
        .setName('amount')
        .setDescription('Number of messages to delete (1–100)')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true),
    )
    .addUserOption((opt) =>
      opt.setName('user').setDescription('Only delete messages from this user').setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName('contains')
        .setDescription('Only delete messages containing this text (case-insensitive)')
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    try {
      if (!await checkBotPermissions(interaction, [PermissionFlagsBits.ManageMessages])) return;
      if (!await checkMemberPermissions(interaction, [PermissionFlagsBits.Administrator])) return;

      const amount = interaction.options.getInteger('amount');
      const filterUser = interaction.options.getUser('user');
      const filterText = interaction.options.getString('contains');

      // Defer ephemerally to avoid the interaction expiring during fetch
      await interaction.deferReply({ ephemeral: true });

      // If no filters are active, fetch exactly the amount needed; otherwise over-fetch so
      // there are enough messages to find `amount` matches after filtering is applied.
      const fetchLimit = filterUser || filterText ? 100 : amount;
      let messages = await interaction.channel.messages.fetch({ limit: fetchLimit });

      // Apply filters
      if (filterUser) {
        messages = messages.filter((m) => m.author.id === filterUser.id);
      }
      if (filterText) {
        const lower = filterText.toLowerCase();
        messages = messages.filter((m) => m.content.toLowerCase().includes(lower));
      }

      // Trim to the requested amount
      const toDelete = messages.first(amount);

      if (toDelete.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('No Messages Found', 'No messages matched the given filters.')],
        });
      }

      // bulkDelete with true filters out messages older than 14 days (Discord API limit)
      const deleted = await interaction.channel.bulkDelete(toDelete, true);

      logger.info(
        `${interaction.user.tag} purged ${deleted.size} message(s) in #${interaction.channel.name} (${interaction.guild.name})`,
      );

      // Build extra details for mod-log
      const extras = [];
      if (filterUser) extras.push(`User filter: ${filterUser.tag}`);
      if (filterText) extras.push(`Text filter: "${filterText}"`);
      extras.push(`Channel: <#${interaction.channel.id}>`);

      await sendModLog(interaction.guild, 'PURGE', {
        moderator: interaction.user,
        reason: `Purged ${deleted.size} message(s) in #${interaction.channel.name}`,
        extra: extras.join('\n'),
      });

      return interaction.editReply({
        embeds: [
          successEmbed(
            'Messages Purged',
            `Successfully deleted **${deleted.size}** message(s) from <#${interaction.channel.id}>.${
              deleted.size < toDelete.length
                ? `\n⚠️ ${toDelete.length - deleted.size} message(s) were too old to delete (>14 days).`
                : ''
            }`,
          ),
        ],
      });
    } catch (err) {
      logger.error('Purge command error:', err);
      const errEmbed = errorEmbed('Purge Failed', 'An error occurred while trying to delete messages.');
      if (interaction.replied || interaction.deferred) {
        return interaction.editReply({ embeds: [errEmbed] });
      }
      return interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  },
};

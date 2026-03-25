'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { checkBotPermissions, checkMemberPermissions } = require('../../utils/permissions');
const { sendModLog } = require('../../utils/modLog');
const logger = require('../../utils/logger');

/**
 * Validates that a string is a valid Discord snowflake (17–20 digit numeric string).
 *
 * @param {string} id
 * @returns {boolean}
 */
function isValidSnowflake(id) {
  return /^\d{17,20}$/.test(id);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by their Discord user ID')
    .addStringOption((opt) =>
      opt
        .setName('user_id')
        .setDescription('The Discord user ID of the banned user (17–20 digits)')
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for the unban').setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    try {
      if (!await checkBotPermissions(interaction, [PermissionFlagsBits.BanMembers])) return;
      if (!await checkMemberPermissions(interaction, [PermissionFlagsBits.Administrator])) return;

      const userId = interaction.options.getString('user_id').trim();
      const reason = interaction.options.getString('reason') ?? 'No reason provided';

      // Validate snowflake format
      if (!isValidSnowflake(userId)) {
        return interaction.reply({
          embeds: [errorEmbed('Invalid User ID', 'Please provide a valid Discord user ID (17–20 digit numeric string).')],
          ephemeral: true,
        });
      }

      // Verify the user is actually banned
      let banEntry;
      try {
        banEntry = await interaction.guild.bans.fetch(userId);
      } catch {
        return interaction.reply({
          embeds: [errorEmbed('Not Banned', `User \`${userId}\` is not currently banned from this server.`)],
          ephemeral: true,
        });
      }

      // Perform the unban
      await interaction.guild.members.unban(userId, `${reason} | Unbanned by ${interaction.user.tag}`);

      const bannedUser = banEntry.user;
      logger.info(`${interaction.user.tag} unbanned ${bannedUser.tag} (${userId}) from ${interaction.guild.name}: ${reason}`);

      await sendModLog(interaction.guild, 'UNBAN', {
        moderator: interaction.user,
        target: bannedUser,
        reason,
      });

      return interaction.reply({
        embeds: [
          successEmbed(
            'User Unbanned',
            `**${bannedUser.tag}** (\`${userId}\`) has been unbanned.\n**Reason:** ${reason}`,
          ),
        ],
      });
    } catch (err) {
      logger.error('Unban command error:', err);
      const errEmbed = errorEmbed('Unban Failed', 'An error occurred while trying to unban the user.');
      if (interaction.replied || interaction.deferred) {
        return interaction.editReply({ embeds: [errEmbed] });
      }
      return interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  },
};

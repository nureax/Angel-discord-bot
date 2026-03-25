'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { checkBotPermissions, checkMemberPermissions } = require('../../utils/permissions');
const { sendModLog } = require('../../utils/modLog');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server')
    .addUserOption((opt) =>
      opt.setName('member').setDescription('The member to ban').setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for the ban').setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt
        .setName('delete_days')
        .setDescription('Number of days of messages to delete (0–7)')
        .setMinValue(0)
        .setMaxValue(7)
        .setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    if (!await checkBotPermissions(interaction, [PermissionFlagsBits.BanMembers])) return;
    if (!await checkMemberPermissions(interaction, [PermissionFlagsBits.Administrator])) return;

    const targetUser = interaction.options.getUser('member');
    const targetMember = interaction.options.getMember('member'); // null if not in guild
    const reason = interaction.options.getString('reason') ?? 'No reason provided';
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;

    if (!targetUser) {
      return interaction.reply({ embeds: [errorEmbed('User Not Found', 'Could not find that user.')], ephemeral: true });
    }

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Invalid Target', 'You cannot ban yourself.')], ephemeral: true });
    }

    if (targetUser.id === interaction.client.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Invalid Target', 'I cannot ban myself.')], ephemeral: true });
    }

    // Role hierarchy check (only applicable if the user is in the guild)
    if (targetMember) {
      if (!targetMember.bannable) {
        return interaction.reply({
          embeds: [errorEmbed('Cannot Ban', 'I cannot ban this member. They may have a higher or equal role than me.')],
          ephemeral: true,
        });
      }

      if (
        interaction.member.roles.highest.position <= targetMember.roles.highest.position &&
        interaction.guild.ownerId !== interaction.user.id
      ) {
        return interaction.reply({
          embeds: [errorEmbed('Cannot Ban', 'You cannot ban someone with a higher or equal role than yours.')],
          ephemeral: true,
        });
      }

      // DM before banning
      await targetUser
        .send({ embeds: [errorEmbed('Banned', `You have been banned from **${interaction.guild.name}**.\n**Reason:** ${reason}`)] })
        .catch(() => null);
    }

    try {
      await interaction.guild.members.ban(targetUser.id, {
        deleteMessageSeconds: deleteDays * 86400,
        reason: `${reason} | Banned by ${interaction.user.tag}`,
      });

      logger.info(`${interaction.user.tag} banned ${targetUser.tag} from ${interaction.guild.name}: ${reason}`);

      await sendModLog(interaction.guild, 'BAN', {
        moderator: interaction.user,
        target: targetUser,
        reason,
        extra: deleteDays > 0 ? `Messages deleted: ${deleteDays} day(s)` : undefined,
      });

      return interaction.reply({
        embeds: [successEmbed('Member Banned', `**${targetUser.tag}** has been banned.\n**Reason:** ${reason}${deleteDays > 0 ? `\n**Messages deleted:** ${deleteDays} day(s)` : ''}`)],
      });
    } catch (err) {
      logger.error('Ban command error:', err);
      const errEmbed = errorEmbed('Ban Failed', 'An error occurred while trying to ban the user.');
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
      } else {
        await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
      }
    }
  },
};

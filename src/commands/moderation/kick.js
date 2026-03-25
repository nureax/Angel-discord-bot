'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { checkBotPermissions, checkMemberPermissions } = require('../../utils/permissions');
const { sendModLog } = require('../../utils/modLog');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server')
    .addUserOption((opt) =>
      opt.setName('member').setDescription('The member to kick').setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for the kick').setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    // Verify bot & invoker permissions
    if (!await checkBotPermissions(interaction, [PermissionFlagsBits.KickMembers])) return;
    if (!await checkMemberPermissions(interaction, [PermissionFlagsBits.Administrator])) return;

    const target = interaction.options.getMember('member');
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    if (!target) {
      return interaction.reply({ embeds: [errorEmbed('User Not Found', 'That user is not in this server.')], ephemeral: true });
    }

    // Prevent kicking yourself
    if (target.id === interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Invalid Target', 'You cannot kick yourself.')], ephemeral: true });
    }

    // Prevent kicking the bot
    if (target.id === interaction.client.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Invalid Target', 'I cannot kick myself.')], ephemeral: true });
    }

    // Role hierarchy check
    if (!target.kickable) {
      return interaction.reply({
        embeds: [errorEmbed('Cannot Kick', 'I cannot kick this member. They may have a higher or equal role than me.')],
        ephemeral: true,
      });
    }

    if (
      interaction.member.roles.highest.position <= target.roles.highest.position &&
      interaction.guild.ownerId !== interaction.user.id
    ) {
      return interaction.reply({
        embeds: [errorEmbed('Cannot Kick', 'You cannot kick someone with a higher or equal role than yours.')],
        ephemeral: true,
      });
    }

    try {
      // Attempt to DM the target before kicking
      await target.user
        .send({ embeds: [errorEmbed('Kicked', `You have been kicked from **${interaction.guild.name}**.\n**Reason:** ${reason}`)] })
        .catch(() => null);

      await target.kick(`${reason} | Kicked by ${interaction.user.tag}`);

      logger.info(`${interaction.user.tag} kicked ${target.user.tag} from ${interaction.guild.name}: ${reason}`);

      await sendModLog(interaction.guild, 'KICK', {
        moderator: interaction.user,
        target: target.user,
        reason,
      });

      return interaction.reply({
        embeds: [successEmbed('Member Kicked', `**${target.user.tag}** has been kicked.\n**Reason:** ${reason}`)],
      });
    } catch (err) {
      logger.error('Kick command error:', err);
      const errEmbed = errorEmbed('Kick Failed', 'An error occurred while trying to kick the member.');
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
      } else {
        await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
      }
    }
  },
};

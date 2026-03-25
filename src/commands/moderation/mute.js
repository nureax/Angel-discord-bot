'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { checkBotPermissions, checkMemberPermissions } = require('../../utils/permissions');
const { sendModLog } = require('../../utils/modLog');
const { config } = require('../../../config');
const logger = require('../../utils/logger');

// Max timeout duration Discord allows: 28 days in milliseconds
const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout (mute) a member for a specified duration')
    .addUserOption((opt) =>
      opt.setName('member').setDescription('The member to mute').setRequired(true),
    )
    .addIntegerOption((opt) =>
      opt
        .setName('duration')
        .setDescription(`Duration in minutes (1–40320). Defaults to ${config.moderation.defaultMuteDuration}.`)
        .setMinValue(1)
        .setMaxValue(40320)
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for the mute').setRequired(false),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    if (!await checkBotPermissions(interaction, [PermissionFlagsBits.ModerateMembers])) return;
    if (!await checkMemberPermissions(interaction, [PermissionFlagsBits.Administrator])) return;

    const target = interaction.options.getMember('member');
    const durationMinutes = interaction.options.getInteger('duration') ?? config.moderation.defaultMuteDuration;
    const reason = interaction.options.getString('reason') ?? 'No reason provided';

    if (!target) {
      return interaction.reply({ embeds: [errorEmbed('User Not Found', 'That user is not in this server.')], ephemeral: true });
    }

    if (target.id === interaction.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Invalid Target', 'You cannot mute yourself.')], ephemeral: true });
    }

    if (target.id === interaction.client.user.id) {
      return interaction.reply({ embeds: [errorEmbed('Invalid Target', 'I cannot mute myself.')], ephemeral: true });
    }

    if (!target.moderatable) {
      return interaction.reply({
        embeds: [errorEmbed('Cannot Mute', 'I cannot timeout this member. They may have a higher or equal role than me.')],
        ephemeral: true,
      });
    }

    if (
      interaction.member.roles.highest.position <= target.roles.highest.position &&
      interaction.guild.ownerId !== interaction.user.id
    ) {
      return interaction.reply({
        embeds: [errorEmbed('Cannot Mute', 'You cannot mute someone with a higher or equal role than yours.')],
        ephemeral: true,
      });
    }

    const durationMs = Math.min(durationMinutes * 60 * 1000, MAX_TIMEOUT_MS);
    const expiresAt = Math.floor((Date.now() + durationMs) / 1000);

    try {
      await target.timeout(durationMs, `${reason} | Muted by ${interaction.user.tag}`);

      logger.info(`${interaction.user.tag} muted ${target.user.tag} for ${durationMinutes}m in ${interaction.guild.name}: ${reason}`);

      await sendModLog(interaction.guild, 'MUTE', {
        moderator: interaction.user,
        target: target.user,
        reason,
        extra: `Duration: ${durationMinutes} minute(s)`,
      });

      return interaction.reply({
        embeds: [
          successEmbed(
            'Member Muted',
            `**${target.user.tag}** has been timed out.\n**Duration:** ${durationMinutes} minute(s) (expires <t:${expiresAt}:R>)\n**Reason:** ${reason}`,
          ),
        ],
      });
    } catch (err) {
      logger.error('Mute command error:', err);
      const errEmbed = errorEmbed('Mute Failed', 'An error occurred while trying to mute the member.');
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
      } else {
        await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
      }
    }
  },
};

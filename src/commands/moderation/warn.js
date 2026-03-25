'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, warningEmbed, infoEmbed } = require('../../utils/embed');
const { checkMemberPermissions } = require('../../utils/permissions');
const { addWarn, getWarns, clearWarns } = require('../../utils/warnStore');
const { sendModLog } = require('../../utils/modLog');
const { config } = require('../../../config');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn, view, or clear warnings for a member')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Issue a warning to a member')
        .addUserOption((opt) =>
          opt.setName('member').setDescription('The member to warn').setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName('reason').setDescription('Reason for the warning').setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('View all warnings for a member')
        .addUserOption((opt) =>
          opt.setName('member').setDescription('The member to check').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('clear')
        .setDescription('Clear all warnings for a member')
        .addUserOption((opt) =>
          opt.setName('member').setDescription('The member whose warnings to clear').setRequired(true),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    if (!await checkMemberPermissions(interaction, [PermissionFlagsBits.Administrator])) return;

    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      return handleWarnAdd(interaction);
    } else if (sub === 'list') {
      return handleWarnList(interaction);
    } else if (sub === 'clear') {
      return handleWarnClear(interaction);
    }
  },
};

async function handleWarnAdd(interaction) {
  const target = interaction.options.getMember('member');
  const reason = interaction.options.getString('reason') ?? 'No reason provided';

  if (!target) {
    return interaction.reply({ embeds: [errorEmbed('User Not Found', 'That user is not in this server.')], ephemeral: true });
  }

  if (target.id === interaction.user.id) {
    return interaction.reply({ embeds: [errorEmbed('Invalid Target', 'You cannot warn yourself.')], ephemeral: true });
  }

  if (target.user.bot) {
    return interaction.reply({ embeds: [errorEmbed('Invalid Target', 'You cannot warn bots.')], ephemeral: true });
  }

  const warns = addWarn(interaction.guildId, target.id, {
    reason,
    moderatorId: interaction.user.id,
    moderatorTag: interaction.user.tag,
  });

  logger.info(
    `${interaction.user.tag} warned ${target.user.tag} in ${interaction.guild.name} (${warns.length} total): ${reason}`,
  );

  await sendModLog(interaction.guild, 'WARN', {
    moderator: interaction.user,
    target: target.user,
    reason,
    extra: `Total warnings: ${warns.length}`,
  });

  // Notify the warned user
  await target.user
    .send({
      embeds: [
        warningEmbed(
          'You Have Been Warned',
          `You received a warning in **${interaction.guild.name}**.\n**Reason:** ${reason}\n**Total warnings:** ${warns.length}`,
        ),
      ],
    })
    .catch(() => null);

  const embed = successEmbed(
    'Warning Issued',
    `**${target.user.tag}** has been warned.\n**Reason:** ${reason}\n**Total warnings:** ${warns.length}`,
  );

  if (warns.length >= config.moderation.maxWarns) {
    embed.addFields({
      name: '⚠️ Threshold Reached',
      value: `This member has reached ${config.moderation.maxWarns} warnings. Consider taking further action.`,
    });
  }

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleWarnList(interaction) {
  const targetUser = interaction.options.getUser('member');
  const warns = getWarns(interaction.guildId, targetUser.id);

  if (warns.length === 0) {
    return interaction.reply({
      embeds: [infoEmbed('No Warnings', `**${targetUser.tag}** has no warnings on record.`)],
      ephemeral: true,
    });
  }

  const warnLines = warns.map((w, i) => {
    const ts = Math.floor(w.timestamp / 1000);
    return `**${i + 1}.** ${w.reason}\n   *By ${w.moderatorTag} — <t:${ts}:R>*`;
  });

  const embed = warningEmbed(
    `Warnings for ${targetUser.tag}`,
    warnLines.join('\n\n'),
  ).addFields({ name: 'Total', value: `${warns.length}`, inline: true });

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleWarnClear(interaction) {
  const targetUser = interaction.options.getUser('member');
  const target = interaction.options.getMember('member');

  if (target && target.roles && interaction.member.roles.highest.position <= target.roles.highest.position && interaction.guild.ownerId !== interaction.user.id) {
    return interaction.reply({
      embeds: [errorEmbed('Cannot Clear Warns', 'You cannot clear warns for someone with a higher or equal role.')],
      ephemeral: true,
    });
  }

  const count = clearWarns(interaction.guildId, targetUser.id);

  logger.info(
    `${interaction.user.tag} cleared ${count} warning(s) for ${targetUser.tag} in ${interaction.guild.name}`,
  );

  return interaction.reply({
    embeds: [successEmbed('Warnings Cleared', `Cleared **${count}** warning(s) for **${targetUser.tag}**.`)],
    ephemeral: true,
  });
}

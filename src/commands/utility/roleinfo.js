'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createBaseEmbed, errorEmbed } = require('../../utils/embed');
const logger = require('../../utils/logger');

/** Permissions displayed in the role info embed (if enabled). */
const KEY_PERMISSIONS = [
  { flag: PermissionFlagsBits.Administrator, label: 'Administrator' },
  { flag: PermissionFlagsBits.ManageGuild, label: 'Manage Server' },
  { flag: PermissionFlagsBits.ManageChannels, label: 'Manage Channels' },
  { flag: PermissionFlagsBits.ManageRoles, label: 'Manage Roles' },
  { flag: PermissionFlagsBits.ManageMessages, label: 'Manage Messages' },
  { flag: PermissionFlagsBits.KickMembers, label: 'Kick Members' },
  { flag: PermissionFlagsBits.BanMembers, label: 'Ban Members' },
  { flag: PermissionFlagsBits.MuteMembers, label: 'Mute Members' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roleinfo')
    .setDescription('Display detailed information about a role')
    .addRoleOption((opt) =>
      opt.setName('role').setDescription('The role to inspect').setRequired(true),
    )
    .setDMPermission(false),

  async execute(interaction) {
    try {
      const role = interaction.options.getRole('role');

      // Resolve to a full Role object (option may return an APIRole)
      const fullRole = interaction.guild.roles.cache.get(role.id) ?? role;

      // Hex color string (e.g. "#7c3aed") or "#000000" if no colour is set
      const hexColor = fullRole.hexColor ?? '#000000';

      // Key permissions this role holds
      const enabledPerms = KEY_PERMISSIONS
        .filter(({ flag }) => fullRole.permissions.has(flag))
        .map(({ label }) => label);

      const permValue = enabledPerms.length > 0
        ? enabledPerms.map((p) => `\`${p}\``).join(', ')
        : '*None of the listed permissions*';

      const createdTimestamp = Math.floor(fullRole.createdTimestamp / 1000);

      // Use the role's color as the embed color; fall back to 0x000001 (near-black)
      // when the role has no color (0 is treated as "default" by Discord.js)
      const embedColor = fullRole.color !== 0 ? fullRole.color : 0x36393f;

      const embed = createBaseEmbed(embedColor)
        .setTitle(`🏷️ Role Info — ${fullRole.name}`)
        .addFields(
          { name: '🆔 Role ID', value: fullRole.id, inline: true },
          { name: '🎨 Color', value: hexColor, inline: true },
          { name: '👥 Members', value: `${fullRole.members.size}`, inline: true },
          { name: '📅 Created', value: `<t:${createdTimestamp}:D>`, inline: true },
          { name: '📊 Position', value: `${fullRole.position}`, inline: true },
          { name: '💬 Mentionable', value: fullRole.mentionable ? 'Yes' : 'No', inline: true },
          { name: '📌 Hoisted', value: fullRole.hoist ? 'Yes' : 'No', inline: true },
          { name: '🔐 Key Permissions', value: permValue },
        );

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error('roleinfo command error:', err);
      const errEmbed = errorEmbed('Error', 'An unexpected error occurred while fetching role information.');
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [errEmbed] }).catch(() => null);
      } else {
        await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
      }
    }
  },
};

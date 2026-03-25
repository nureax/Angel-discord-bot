'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { createBaseEmbed, errorEmbed } = require('../../utils/embed');
const { checkBotPermissions, checkMemberPermissions } = require('../../utils/permissions');
const { setRoleMessage } = require('../../utils/reactionRoleStore');
const { config } = require('../../../config');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Create a button-based reaction role message')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Post a reaction role embed with up to 5 role buttons')
        .addStringOption((opt) =>
          opt.setName('title').setDescription('Embed title').setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName('description').setDescription('Embed description').setRequired(true),
        )
        .addRoleOption((opt) =>
          opt.setName('role1').setDescription('First role').setRequired(true),
        )
        .addRoleOption((opt) =>
          opt.setName('role2').setDescription('Second role (optional)').setRequired(false),
        )
        .addRoleOption((opt) =>
          opt.setName('role3').setDescription('Third role (optional)').setRequired(false),
        )
        .addRoleOption((opt) =>
          opt.setName('role4').setDescription('Fourth role (optional)').setRequired(false),
        )
        .addRoleOption((opt) =>
          opt.setName('role5').setDescription('Fifth role (optional)').setRequired(false),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .setDMPermission(false),

  async execute(interaction) {
    try {
      if (!await checkBotPermissions(interaction, [PermissionFlagsBits.ManageRoles])) return;
      if (!await checkMemberPermissions(interaction, [PermissionFlagsBits.ManageRoles])) return;

      const sub = interaction.options.getSubcommand();
      if (sub !== 'create') return;

      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');

      // Collect up to 5 roles
      const roles = [];
      for (let i = 1; i <= 5; i++) {
        const role = interaction.options.getRole(`role${i}`);
        if (role) roles.push(role);
      }

      if (roles.length === 0) {
        return interaction.reply({
          embeds: [errorEmbed('No Roles', 'You must provide at least one role.')],
          ephemeral: true,
        });
      }

      // Check the bot can actually assign these roles (hierarchy check)
      const botMember = interaction.guild.members.me;
      const unassignable = roles.filter((r) => r.position >= botMember.roles.highest.position);
      if (unassignable.length > 0) {
        const names = unassignable.map((r) => r.name).join(', ');
        return interaction.reply({
          embeds: [errorEmbed('Role Hierarchy Error', `I cannot assign the following roles (they are equal to or higher than my highest role): **${names}**`)],
          ephemeral: true,
        });
      }

      const embed = createBaseEmbed(config.colors.primary)
        .setTitle(title)
        .setDescription(description)
        .addFields({
          name: 'Available Roles',
          value: roles.map((r) => `• ${r}`).join('\n'),
        });

      // Build buttons — one per role
      const buttons = roles.map((role, i) =>
        new ButtonBuilder()
          .setCustomId(`rr_${i}_${role.id}`)
          .setLabel(role.name)
          .setStyle(ButtonStyle.Secondary),
      );

      const row = new ActionRowBuilder().addComponents(buttons);

      // Send the embed and register the message
      const message = await interaction.channel.send({ embeds: [embed], components: [row] });

      // Build a customId → roleId map and store it
      const buttonRoleMap = {};
      roles.forEach((role, i) => {
        buttonRoleMap[`rr_${i}_${role.id}`] = role.id;
      });
      setRoleMessage(message.id, buttonRoleMap);

      logger.info(`Reaction role message created by ${interaction.user.tag} in #${interaction.channel.name} (${interaction.guild.name})`);

      return interaction.reply({
        content: `✅ Reaction role message posted! Message ID: \`${message.id}\``,
        ephemeral: true,
      });
    } catch (err) {
      logger.error('Reactionrole command error:', err);
      const errEmbed = errorEmbed('Error', 'An error occurred while creating the reaction role message.');
      if (interaction.replied || interaction.deferred) {
        return interaction.editReply({ embeds: [errEmbed] });
      }
      return interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  },
};

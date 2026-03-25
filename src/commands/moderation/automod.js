'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createBaseEmbed, successEmbed, errorEmbed } = require('../../utils/embed');
const { checkMemberPermissions } = require('../../utils/permissions');
const { getSettings, updateSetting } = require('../../utils/automodStore');
const { config } = require('../../../config');
const logger = require('../../utils/logger');

const VALID_RULES = ['spam', 'caps', 'invites', 'mentions'];

const RULE_DESCRIPTIONS = {
  spam: 'Deletes and warns if a user sends 5+ messages in 5 seconds',
  caps: 'Deletes and warns if a message is >70% uppercase and >10 chars',
  invites: 'Deletes messages containing Discord invite links',
  mentions: 'Deletes and warns if a message mentions 5 or more users',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configure auto-moderation rules')
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('enable')
        .setDescription('Enable an auto-moderation rule')
        .addStringOption((opt) =>
          opt
            .setName('rule')
            .setDescription('The rule to enable')
            .setRequired(true)
            .addChoices(
              { name: 'spam — 5+ messages in 5 seconds', value: 'spam' },
              { name: 'caps — >70% uppercase messages', value: 'caps' },
              { name: 'invites — Discord invite links', value: 'invites' },
              { name: 'mentions — 5+ user mentions', value: 'mentions' },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('disable')
        .setDescription('Disable an auto-moderation rule')
        .addStringOption((opt) =>
          opt
            .setName('rule')
            .setDescription('The rule to disable')
            .setRequired(true)
            .addChoices(
              { name: 'spam — 5+ messages in 5 seconds', value: 'spam' },
              { name: 'caps — >70% uppercase messages', value: 'caps' },
              { name: 'invites — Discord invite links', value: 'invites' },
              { name: 'mentions — 5+ user mentions', value: 'mentions' },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('status').setDescription('Show the current auto-moderation rule statuses'),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    try {
      if (!await checkMemberPermissions(interaction, [PermissionFlagsBits.Administrator])) return;

      const sub = interaction.options.getSubcommand();

      if (sub === 'enable' || sub === 'disable') {
        const rule = interaction.options.getString('rule');

        if (!VALID_RULES.includes(rule)) {
          return interaction.reply({
            embeds: [errorEmbed('Invalid Rule', `Valid rules are: ${VALID_RULES.join(', ')}`)],
            ephemeral: true,
          });
        }

        const enabled = sub === 'enable';
        updateSetting(interaction.guild.id, rule, enabled);

        logger.info(
          `Automod rule "${rule}" ${enabled ? 'enabled' : 'disabled'} by ${interaction.user.tag} in ${interaction.guild.name}`,
        );

        return interaction.reply({
          embeds: [
            successEmbed(
              `Automod Rule ${enabled ? 'Enabled' : 'Disabled'}`,
              `The **${rule}** rule has been **${enabled ? 'enabled' : 'disabled'}**.\n\n*${RULE_DESCRIPTIONS[rule]}*`,
            ),
          ],
        });
      }

      if (sub === 'status') {
        const settings = getSettings(interaction.guild.id);

        const lines = VALID_RULES.map((rule) => {
          const statusEmoji = settings[rule] ? '✅' : '❌';
          return `${statusEmoji} **${rule}** — ${RULE_DESCRIPTIONS[rule]}`;
        });

        const embed = createBaseEmbed(config.colors.info)
          .setTitle('🤖 Auto-Moderation Status')
          .setDescription(lines.join('\n\n'));

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }
    } catch (err) {
      logger.error('Automod command error:', err);
      const errEmbed = errorEmbed('Error', 'An error occurred while updating automod settings.');
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ embeds: [errEmbed], ephemeral: true });
      }
      return interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  },
};

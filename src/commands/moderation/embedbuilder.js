'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { errorEmbed } = require('../../utils/embed');
const { checkBotPermissions, checkMemberPermissions } = require('../../utils/permissions');
const logger = require('../../utils/logger');

/** Named color aliases → hex integers */
const COLOR_NAMES = {
  purple: 0x7c3aed,
  green: 0x22c55e,
  red: 0xef4444,
  blue: 0x3b82f6,
  orange: 0xf97316,
  yellow: 0xeab308,
  white: 0xffffff,
  black: 0x000001, // Discord treats pure 0x000000 as "no colour"
};

/**
 * Parses a color string (hex like "#7c3aed" or a named alias) to an integer.
 * Returns null if the string cannot be parsed.
 * @param {string} raw
 * @returns {number|null}
 */
function parseColor(raw) {
  const cleaned = raw.trim().toLowerCase();

  if (COLOR_NAMES[cleaned] !== undefined) return COLOR_NAMES[cleaned];

  // Accept "#rrggbb" or "rrggbb"
  const hex = cleaned.replace(/^#/, '');
  if (/^[0-9a-f]{6}$/.test(hex)) {
    return parseInt(hex, 16);
  }

  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Admin embed builder tools')
    .addSubcommand((sub) =>
      sub
        .setName('send')
        .setDescription('Send a custom embed to a channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Target channel to send the embed to')
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName('title')
            .setDescription('Embed title (max 256 characters)')
            .setRequired(true)
            .setMaxLength(256),
        )
        .addStringOption((opt) =>
          opt
            .setName('description')
            .setDescription('Embed description (max 2000 characters, use \\n for line breaks)')
            .setRequired(true)
            .setMaxLength(2000),
        )
        .addStringOption((opt) =>
          opt
            .setName('color')
            .setDescription('Hex color (#7c3aed) or name: purple, green, red, blue, orange, yellow, white, black')
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt.setName('footer').setDescription('Footer text').setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName('thumbnail_url')
            .setDescription('Thumbnail image URL (must start with https://)')
            .setRequired(false),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    try {
      const memberOk = await checkMemberPermissions(interaction, [PermissionFlagsBits.Administrator]);
      if (!memberOk) return;

      const sub = interaction.options.getSubcommand();

      if (sub === 'send') {
        const targetChannel = interaction.options.getChannel('channel');
        const title = interaction.options.getString('title');
        const rawDescription = interaction.options.getString('description');
        const colorRaw = interaction.options.getString('color');
        const footer = interaction.options.getString('footer');
        const thumbnailUrl = interaction.options.getString('thumbnail_url');

        // Replace literal \n sequences with real newlines
        const description = rawDescription.replace(/\\n/g, '\n');

        // Validate thumbnail URL
        if (thumbnailUrl) {
          try {
            const parsed = new URL(thumbnailUrl);
            if (parsed.protocol !== 'https:') throw new Error('Not HTTPS');
          } catch {
            return interaction.reply({
              embeds: [errorEmbed('Invalid URL', 'Thumbnail URL must be a valid HTTPS URL.')],
              ephemeral: true,
            });
          }
        }

        // Parse color
        let color = 0x7c3aed; // default purple
        if (colorRaw) {
          const parsed = parseColor(colorRaw);
          if (parsed === null) {
            return interaction.reply({
              embeds: [errorEmbed('Invalid Color', `Could not parse \`${colorRaw}\` as a color. Use a hex value like \`#7c3aed\` or a name like \`purple\`.`)],
              ephemeral: true,
            });
          }
          color = parsed;
        }

        // Verify the target channel is text-based
        if (!targetChannel.isTextBased()) {
          return interaction.reply({
            embeds: [errorEmbed('Invalid Channel', 'The target channel must be a text-based channel.')],
            ephemeral: true,
          });
        }

        // Check bot permissions in the target channel
        const botMember = interaction.guild.members.me;
        if (botMember) {
          const permsInTarget = targetChannel.permissionsFor(botMember);
          const missingInTarget = [];
          if (!permsInTarget?.has(PermissionFlagsBits.SendMessages)) missingInTarget.push('Send Messages');
          if (!permsInTarget?.has(PermissionFlagsBits.EmbedLinks)) missingInTarget.push('Embed Links');

          if (missingInTarget.length > 0) {
            return interaction.reply({
              embeds: [
                errorEmbed(
                  'Missing Channel Permissions',
                  `I need the following permissions in ${targetChannel}:\n${missingInTarget.map((p) => `• \`${p}\``).join('\n')}`,
                ),
              ],
              ephemeral: true,
            });
          }
        }

        // Build the embed
        const embed = new EmbedBuilder()
          .setColor(color)
          .setTitle(title)
          .setDescription(description)
          .setTimestamp()
          .setFooter({ text: 'Angel Bot' });

        if (footer) embed.setFooter({ text: footer });
        if (thumbnailUrl) embed.setThumbnail(thumbnailUrl);

        // Send to target channel
        try {
          await targetChannel.send({ embeds: [embed] });
        } catch (sendErr) {
          logger.error('embedbuilder: failed to send to channel:', sendErr);
          return interaction.reply({
            embeds: [errorEmbed('Send Failed', `Could not send the embed to ${targetChannel}. Please verify my permissions.`)],
            ephemeral: true,
          });
        }

        logger.info(
          `Embed sent to #${targetChannel.name} in ${interaction.guild.name} by ${interaction.user.tag}`,
        );

        return interaction.reply({
          content: `✅ Embed sent to ${targetChannel}`,
          ephemeral: true,
        });
      }
    } catch (err) {
      logger.error('embedbuilder command error:', err);
      const errEmbed = errorEmbed('Error', 'An unexpected error occurred while building the embed.');
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [errEmbed] }).catch(() => null);
      } else {
        await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
      }
    }
  },
};

'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require('discord.js');
const { createBaseEmbed, successEmbed, errorEmbed } = require('../../utils/embed');
const { checkBotPermissions, checkMemberPermissions } = require('../../utils/permissions');
const { setSetup, isTicketChannel, getTicket, closeTicket } = require('../../utils/ticketStore');
const { sendModLog } = require('../../utils/modLog');
const { config } = require('../../../config');
const logger = require('../../utils/logger');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket system management')
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Post the ticket creation button in a channel')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel to post the ticket creation embed in')
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName('category')
            .setDescription('Category to create ticket channels under')
            .addChannelTypes(ChannelType.GuildCategory)
            .setRequired(false),
        )
        .addRoleOption((opt) =>
          opt
            .setName('support_role')
            .setDescription('Role that gets access to all tickets (optional)')
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('close')
        .setDescription('Close the current ticket channel')
        .addStringOption((opt) =>
          opt
            .setName('reason')
            .setDescription('Reason for closing the ticket')
            .setRequired(false),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      try {
        if (!await checkBotPermissions(interaction, [PermissionFlagsBits.ManageChannels])) return;
        if (!await checkMemberPermissions(interaction, [PermissionFlagsBits.Administrator])) return;

        const channel = interaction.options.getChannel('channel');
        const categoryId = interaction.options.getChannel('category')?.id ?? null;
        const supportRole = interaction.options.getRole('support_role') ?? null;

        // Persist the setup config
        setSetup(interaction.guild.id, {
          channelId: channel.id,
          categoryId,
          supportRoleId: supportRole?.id ?? null,
        });

        // Build the ticket creation embed + button
        const embed = createBaseEmbed(config.colors.primary)
          .setTitle('🎫 Support Tickets')
          .setDescription(
            'Need help? Click the button below to open a private support ticket.\n\n' +
            'A staff member will assist you as soon as possible.',
          );

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('ticket_create')
            .setLabel('Create Ticket')
            .setEmoji('🎫')
            .setStyle(ButtonStyle.Primary),
        );

        await channel.send({ embeds: [embed], components: [row] });

        logger.info(
          `Ticket setup configured by ${interaction.user.tag} in guild ${interaction.guild.name} — panel in #${channel.name}`,
        );

        return interaction.reply({
          embeds: [
            successEmbed(
              'Ticket System Setup',
              `Ticket creation panel posted in ${channel}.\n` +
              `${categoryId ? `Category: \`${categoryId}\`\n` : ''}` +
              `${supportRole ? `Support role: ${supportRole}` : ''}`,
            ),
          ],
          ephemeral: true,
        });
      } catch (err) {
        logger.error('Ticket setup error:', err);
        const errEmbed = errorEmbed('Setup Failed', 'An error occurred while setting up the ticket system.');
        if (interaction.replied || interaction.deferred) {
          return interaction.followUp({ embeds: [errEmbed], ephemeral: true });
        }
        return interaction.reply({ embeds: [errEmbed], ephemeral: true });
      }
    }

    if (sub === 'close') {
      try {
        const channelId = interaction.channel.id;

        if (!isTicketChannel(channelId)) {
          return interaction.reply({
            embeds: [errorEmbed('Not a Ticket', 'This command can only be used inside a ticket channel.')],
            ephemeral: true,
          });
        }

        const ticket = getTicket(channelId);
        const isOpener = ticket && ticket.userId === interaction.user.id;
        const hasAdminPerm = interaction.member?.permissions.has(PermissionFlagsBits.Administrator);
        if (!isOpener && !hasAdminPerm) {
          return interaction.reply({
            embeds: [errorEmbed('No Permission', 'Only the ticket opener or a moderator can close this ticket.')],
            ephemeral: true,
          });
        }

        const reason = interaction.options.getString('reason') ?? 'No reason provided';

        const closingEmbed = createBaseEmbed(config.colors.warning)
          .setTitle('🔒 Ticket Closing')
          .setDescription(
            `This ticket is being closed by ${interaction.user}.\n**Reason:** ${reason}\n\nThis channel will be deleted in 5 seconds.`,
          );

        await interaction.reply({ embeds: [closingEmbed] });

        // Log to mod-log
        await sendModLog(interaction.guild, 'TICKET_CLOSE', {
          moderator: interaction.user,
          target: ticket?.userId ? `<@${ticket.userId}>` : 'Unknown',
          reason,
          extra: `Channel: ${interaction.channel.name}`,
        });

        // Remove from store before channel deletion
        closeTicket(channelId);

        // Wait 5 seconds then delete the channel
        setTimeout(async () => {
          try {
            await interaction.channel.delete(`Ticket closed by ${interaction.user.tag}: ${reason}`);
          } catch (delErr) {
            logger.warn('Could not delete ticket channel:', delErr);
          }
        }, 5000);
      } catch (err) {
        logger.error('Ticket close error:', err);
        const errEmbed = errorEmbed('Close Failed', 'An error occurred while closing this ticket.');
        if (interaction.replied || interaction.deferred) {
          return interaction.followUp({ embeds: [errEmbed], ephemeral: true });
        }
        return interaction.reply({ embeds: [errEmbed], ephemeral: true });
      }
    }
  },
};

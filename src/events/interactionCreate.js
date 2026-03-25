'use strict';

const { InteractionType, PermissionFlagsBits, ChannelType } = require('discord.js');
const logger = require('../utils/logger');
const { createBaseEmbed, errorEmbed } = require('../utils/embed');
const { getRoleForButton, isRoleMessage } = require('../utils/reactionRoleStore');
const { enterGiveaway, getGiveaway } = require('../utils/giveawayStore');
const { getSetup, openTicket, closeTicket, getUserTicket } = require('../utils/ticketStore');
const { config } = require('../../config');

module.exports = {
  name: 'interactionCreate',

  async execute(interaction, client) {
    // ── Slash (chat input) commands ─────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        logger.warn(`Received unknown command: /${interaction.commandName}`);
        await interaction.reply({
          embeds: [errorEmbed('Unknown Command', 'This command does not exist or has not been loaded.')],
          ephemeral: true,
        });
        return;
      }

      try {
        logger.info(
          `Command /${interaction.commandName} used by ${interaction.user.tag} (${interaction.user.id}) in guild ${interaction.guildId ?? 'DM'}`,
        );
        await command.execute(interaction, client);
      } catch (err) {
        logger.error(`Error executing /${interaction.commandName}:`, err);

        const errEmbed = errorEmbed(
          'Command Error',
          'An unexpected error occurred while executing this command. Please try again later.',
        );

        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [errEmbed], ephemeral: true });
          } else {
            await interaction.reply({ embeds: [errEmbed], ephemeral: true });
          }
        } catch (replyErr) {
          logger.error('Failed to send error reply to interaction:', replyErr);
        }
      }
      return;
    }

    // ── Autocomplete ────────────────────────────────────────────────────────
    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (command?.autocomplete) {
        try {
          await command.autocomplete(interaction, client);
        } catch (err) {
          logger.error(`Autocomplete error for /${interaction.commandName}:`, err);
        }
      }
      return;
    }

    // ── Button interactions ─────────────────────────────────────────────────
    if (interaction.isButton()) {
      if (!interaction.guild) return;
      const { customId, message } = interaction;

      // ── Giveaway enter button ─────────────────────────────────────────────
      if (customId.startsWith('giveaway_enter_')) {
        try {
          const giveaway = getGiveaway(message.id);

          if (!giveaway) {
            return interaction.reply({
              content: '❌ This giveaway no longer exists in memory (the bot may have restarted).',
              ephemeral: true,
            });
          }

          if (giveaway.ended) {
            return interaction.reply({
              content: '❌ This giveaway has already ended.',
              ephemeral: true,
            });
          }

          const { success, alreadyEntered } = enterGiveaway(message.id, interaction.user.id);

          if (alreadyEntered) {
            return interaction.reply({
              content: '⚠️ You\'re already entered in this giveaway!',
              ephemeral: true,
            });
          }

          if (!success) {
            return interaction.reply({
              content: '❌ Could not enter the giveaway at this time.',
              ephemeral: true,
            });
          }

          return interaction.reply({
            content: '✅ You\'ve entered the giveaway! Good luck! 🎉',
            ephemeral: true,
          });
        } catch (err) {
          logger.error('Error handling giveaway enter button:', err);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An error occurred while entering the giveaway.', ephemeral: true }).catch(() => null);
          }
          return;
        }
      }

      // ── Ticket create button ──────────────────────────────────────────────
      if (customId === 'ticket_create') {
        try {
          const setup = getSetup(interaction.guild.id);

          if (!setup) {
            return interaction.reply({
              content: '❌ The ticket system has not been configured for this server.',
              ephemeral: true,
            });
          }

          const { categoryId, supportRoleId } = setup;
          const safeName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'user';
          const ticketName = `ticket-${safeName}-${interaction.user.id.slice(-4)}`;

          // Check if this user already has an open ticket using the persistent store
          const existingChannelId = getUserTicket(interaction.guild.id, interaction.user.id);

          if (existingChannelId) {
            const existingChannel = interaction.guild.channels.cache.get(existingChannelId);
            if (existingChannel) {
              return interaction.reply({
                content: `You already have an open ticket: ${existingChannel}`,
                ephemeral: true,
              });
            }
            // Channel was manually deleted — clean up the stale store entry
            closeTicket(existingChannelId);
          }

          // Build permission overwrites
          const permissionOverwrites = [
            {
              // Deny @everyone view access
              id: interaction.guild.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              // Allow the ticket opener
              id: interaction.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },
          ];

          // Allow the support role if configured
          if (supportRoleId) {
            permissionOverwrites.push({
              id: supportRoleId,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages,
              ],
            });
          }

          // Allow the bot itself
          permissionOverwrites.push({
            id: interaction.client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels,
            ],
          });

          const channelOptions = {
            name: ticketName,
            type: ChannelType.GuildText,
            permissionOverwrites,
          };

          if (categoryId) {
            channelOptions.parent = categoryId;
          }

          const ticketChannel = await interaction.guild.channels.create(channelOptions);

          // Register in the ticket store
          openTicket(ticketChannel.id, {
            guildId: interaction.guild.id,
            userId: interaction.user.id,
          });

          // Send the welcome embed inside the ticket channel
          const welcomeEmbed = createBaseEmbed(config.colors.primary)
            .setTitle('🎫 Ticket Opened')
            .setDescription(
              `Ticket opened by ${interaction.user}.\n\n` +
              'Support will be with you shortly.\n\n' +
              'Use `/ticket close` to close this ticket when your issue is resolved.',
            );

          await ticketChannel.send({ embeds: [welcomeEmbed] });

          logger.info(
            `Ticket channel ${ticketName} created for ${interaction.user.tag} in ${interaction.guild.name}`,
          );

          return interaction.reply({
            content: `✅ Ticket created: ${ticketChannel}`,
            ephemeral: true,
          });
        } catch (err) {
          logger.error('Error handling ticket_create button:', err);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: '❌ An error occurred while creating your ticket.',
              ephemeral: true,
            }).catch(() => null);
          }
          return;
        }
      }

      // ── Reaction role button ──────────────────────────────────────────────
      if (isRoleMessage(message.id)) {
        try {
          const roleId = getRoleForButton(message.id, customId);

          if (!roleId) {
            return interaction.reply({
              content: '❌ Could not find the role for this button.',
              ephemeral: true,
            });
          }

          const member = interaction.member;
          if (!member) {
            return interaction.reply({
              content: '❌ Could not resolve your guild membership.',
              ephemeral: true,
            });
          }

          const role = interaction.guild.roles.cache.get(roleId);
          if (!role) {
            return interaction.reply({
              content: '❌ The role for this button no longer exists.',
              ephemeral: true,
            });
          }

          if (member.roles.cache.has(roleId)) {
            // User has the role — remove it
            await member.roles.remove(roleId, 'Reaction role toggle');
            return interaction.reply({
              content: `✅ Removed role **${role.name}**`,
              ephemeral: true,
            });
          } else {
            // User doesn't have the role — add it
            await member.roles.add(roleId, 'Reaction role toggle');
            return interaction.reply({
              content: `✅ Added role **${role.name}**`,
              ephemeral: true,
            });
          }
        } catch (err) {
          logger.error('Error handling reaction role button:', err);
          const msg = err.code === 50013
            ? '❌ I don\'t have permission to manage that role.'
            : '❌ An error occurred while toggling your role.';

          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: msg, ephemeral: true }).catch(() => null);
          }
          return;
        }
      }
    }
  },
};

'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { createBaseEmbed, errorEmbed, successEmbed } = require('../../utils/embed');
const { checkBotPermissions, checkMemberPermissions } = require('../../utils/permissions');
const { setStats, getStats, clearStats, updateStatChannels } = require('../../utils/statsStore');
const logger = require('../../utils/logger');

/**
 * Handles `/statschannel setup`.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleSetup(interaction) {
  const showMembers = interaction.options.getBoolean('members') ?? true;
  const showBots = interaction.options.getBoolean('bots') ?? false;
  const showTotal = interaction.options.getBoolean('total') ?? false;

  if (!showMembers && !showBots && !showTotal) {
    return interaction.reply({
      embeds: [errorEmbed('Nothing to Create', 'Please enable at least one counter (members, bots, or total).')],
      ephemeral: true,
    });
  }

  const guild = interaction.guild;

  // Create the stats category
  let category;
  try {
    category = await guild.channels.create({
      name: '📊 Server Stats',
      type: ChannelType.GuildCategory,
    });
  } catch (err) {
    logger.error('statschannel: failed to create category:', err);
    return interaction.editReply({
      embeds: [errorEmbed('Channel Error', 'Failed to create the stats category. Please check my permissions.')],
    });
  }

  // Compute initial counts
  const totalCount = guild.memberCount;
  let botCount = 0;
  let humanCount = 0;
  guild.members.cache.forEach((m) => {
    if (m.user.bot) botCount++;
    else humanCount++;
  });
  if (guild.members.cache.size === 0) humanCount = totalCount;

  const channelOptions = (name) => ({
    name,
    type: ChannelType.GuildVoice,
    parent: category.id,
    permissionOverwrites: [
      {
        id: guild.id,
        deny: [PermissionFlagsBits.Connect],
      },
    ],
  });

  let memberChannelId;
  let botChannelId;
  let totalChannelId;

  try {
    if (showMembers) {
      const ch = await guild.channels.create(channelOptions(`Members: ${humanCount}`));
      memberChannelId = ch.id;
    }
    if (showBots) {
      const ch = await guild.channels.create(channelOptions(`Bots: ${botCount}`));
      botChannelId = ch.id;
    }
    if (showTotal) {
      const ch = await guild.channels.create(channelOptions(`Total: ${totalCount}`));
      totalChannelId = ch.id;
    }
  } catch (err) {
    logger.error('statschannel: failed to create voice channel:', err);
    // Attempt to clean up the category
    await category.delete().catch(() => null);
    return interaction.editReply({
      embeds: [errorEmbed('Channel Error', 'Failed to create one or more stat channels. Please check my permissions.')],
    });
  }

  setStats(guild.id, { categoryId: category.id, memberChannelId, botChannelId, totalChannelId });

  logger.info(
    `Stats channels created in ${guild.name} by ${interaction.user.tag}`,
  );

  const created = [];
  if (memberChannelId) created.push('Members counter');
  if (botChannelId) created.push('Bots counter');
  if (totalChannelId) created.push('Total counter');

  return interaction.editReply({
    embeds: [
      successEmbed(
        'Stats Channels Created',
        `Successfully created the **📊 Server Stats** category with:\n${created.map((c) => `• ${c}`).join('\n')}`,
      ),
    ],
  });
}

/**
 * Handles `/statschannel remove`.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleRemove(interaction) {
  const guild = interaction.guild;
  const data = getStats(guild.id);

  if (!data) {
    return interaction.editReply({
      embeds: [errorEmbed('Not Set Up', 'No stats channels are configured for this server.')],
    });
  }

  const idsToDelete = [
    data.memberChannelId,
    data.botChannelId,
    data.totalChannelId,
    data.categoryId,
  ].filter(Boolean);

  let deleted = 0;
  for (const id of idsToDelete) {
    try {
      const ch = guild.channels.cache.get(id);
      if (ch) {
        await ch.delete();
        deleted++;
      }
    } catch (err) {
      logger.warn(`statschannel: could not delete channel ${id}: ${err.message}`);
    }
  }

  clearStats(guild.id);

  logger.info(
    `Stats channels removed in ${guild.name} by ${interaction.user.tag} (${deleted} channels deleted)`,
  );

  return interaction.editReply({
    embeds: [successEmbed('Stats Channels Removed', `Removed ${deleted} channel(s) and cleared the configuration.`)],
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('statschannel')
    .setDescription('Manage member-count stat channels')
    .addSubcommand((sub) =>
      sub
        .setName('setup')
        .setDescription('Create stat voice channels showing member counts')
        .addBooleanOption((opt) =>
          opt
            .setName('members')
            .setDescription('Create a "Members: X" counter (default: true)')
            .setRequired(false),
        )
        .addBooleanOption((opt) =>
          opt.setName('bots').setDescription('Create a "Bots: X" counter').setRequired(false),
        )
        .addBooleanOption((opt) =>
          opt.setName('total').setDescription('Create a "Total: X" counter').setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('remove').setDescription('Delete all stat channels and the stats category'),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    try {
      const memberOk = await checkMemberPermissions(interaction, [PermissionFlagsBits.Administrator]);
      if (!memberOk) return;

      const botOk = await checkBotPermissions(interaction, [PermissionFlagsBits.ManageChannels]);
      if (!botOk) return;

      await interaction.deferReply({ ephemeral: true });

      const sub = interaction.options.getSubcommand();
      if (sub === 'setup') return handleSetup(interaction);
      if (sub === 'remove') return handleRemove(interaction);
    } catch (err) {
      logger.error('statschannel command error:', err);
      const errEmbed = errorEmbed('Error', 'An unexpected error occurred.');
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [errEmbed] }).catch(() => null);
      } else {
        await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
      }
    }
  },
};

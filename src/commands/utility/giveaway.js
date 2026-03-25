'use strict';

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { createBaseEmbed, errorEmbed, successEmbed } = require('../../utils/embed');
const { checkMemberPermissions } = require('../../utils/permissions');
const {
  createGiveaway,
  endGiveaway,
  rerollGiveaway,
  getGiveaway,
} = require('../../utils/giveawayStore');
const { config } = require('../../../config');
const logger = require('../../utils/logger');

/**
 * Posts the initial giveaway embed with an enter button.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleStart(interaction) {
  const prize = interaction.options.getString('prize');
  const durationMinutes = interaction.options.getInteger('duration');
  const winnersCount = interaction.options.getInteger('winners') ?? 1;

  const delayMs = durationMinutes * 60 * 1000;
  const endTime = Date.now() + delayMs;
  const endTimestamp = Math.floor(endTime / 1000);

  const embed = createBaseEmbed(config.colors.primary)
    .setTitle('🎉 Giveaway!')
    .setDescription(`**Prize:** ${prize}`)
    .addFields(
      { name: '🏆 Winners', value: `${winnersCount}`, inline: true },
      { name: '⏰ Ends', value: `<t:${endTimestamp}:R> (<t:${endTimestamp}:f>)`, inline: true },
      { name: '🎫 How to Enter', value: 'Click the **🎉 Enter** button below!' },
    );

  await interaction.deferReply({ ephemeral: true });

  // Send the message first so we have message.id for the button's customId
  const message = await interaction.channel.send({ embeds: [embed] });

  // Build the enter button using message.id so it matches concludeGiveaway's lookup key
  const enterButton = new ButtonBuilder()
    .setCustomId(`giveaway_enter_${message.id}`)
    .setLabel('🎉 Enter')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(enterButton);

  await message.edit({ components: [row] });

  // Register the giveaway in the store
  try {
    createGiveaway(message.id, { prize, endTime, winnersCount, guildId: interaction.guildId });
  } catch (limitErr) {
    await message.delete().catch(() => null);
    return interaction.editReply({
      embeds: [errorEmbed('Giveaway Limit Reached', limitErr.message)],
    });
  }

  logger.info(
    `Giveaway started by ${interaction.user.tag} in #${interaction.channel.name} (${interaction.guild.name}): "${prize}" — ${durationMinutes}m, ${winnersCount} winner(s)`,
  );

  await interaction.editReply({
    embeds: [successEmbed('Giveaway Started', `Giveaway posted! Message ID: \`${message.id}\``)],
  });

  // Schedule the automatic end
  setTimeout(async () => {
    try {
      await concludeGiveaway(message, prize, interaction.guild);
    } catch (err) {
      logger.error('Error auto-ending giveaway:', err);
    }
  }, delayMs);
}

/**
 * Concludes a giveaway: selects winners, edits the embed, DMs winners.
 *
 * @param {import('discord.js').Message} message
 * @param {string} prize
 * @param {import('discord.js').Guild} guild
 */
async function concludeGiveaway(message, prize, guild) {
  const result = endGiveaway(message.id);
  if (!result) return; // Already ended or not found

  let description;
  if (result.winners.length === 0) {
    description = `**Prize:** ${prize}\n\n*No one entered the giveaway.*`;
  } else {
    const winnerMentions = result.winners.map((id) => `<@${id}>`).join(', ');
    description = `**Prize:** ${prize}\n\n🏆 **Winner(s):** ${winnerMentions}\n\n*Giveaway has ended.*`;

    // DM each winner
    for (const userId of result.winners) {
      try {
        const user = await guild.client.users.fetch(userId).catch(() => null);
        if (user) {
          await user.send({
            embeds: [
              successEmbed(
                '🎉 You Won!',
                `You won **${prize}** in **${guild.name}**!\nCongratulations!`,
              ),
            ],
          }).catch(() => null);
        }
      } catch {
        // Silently skip if DM fails
      }
    }
  }

  const endedEmbed = createBaseEmbed(config.colors.success)
    .setTitle('🎉 Giveaway Ended!')
    .setDescription(description)
    .addFields({
      name: '📊 Total Entries',
      value: `${result.entrants.size}`,
      inline: true,
    });

  // Disable the enter button
  const disabledButton = new ButtonBuilder()
    .setCustomId(`giveaway_enter_${message.id}_ended`)
    .setLabel('🎉 Giveaway Ended')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  const row = new ActionRowBuilder().addComponents(disabledButton);

  await message.edit({ embeds: [endedEmbed], components: [row] }).catch((err) => {
    logger.warn('Could not edit giveaway message:', err);
  });
}

/**
 * Ends a giveaway early by message ID.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleEnd(interaction) {
  const messageId = interaction.options.getString('message_id');

  const giveawayData = getGiveaway(messageId);
  if (!giveawayData) {
    return interaction.reply({
      embeds: [errorEmbed('Not Found', `No active giveaway found with message ID \`${messageId}\`.`)],
      ephemeral: true,
    });
  }

  if (giveawayData.ended) {
    return interaction.reply({
      embeds: [errorEmbed('Already Ended', 'This giveaway has already ended.')],
      ephemeral: true,
    });
  }

  try {
    const message = await interaction.channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      return interaction.reply({
        embeds: [errorEmbed('Message Not Found', 'Could not fetch the giveaway message. Make sure you run this in the same channel.')],
        ephemeral: true,
      });
    }

    await concludeGiveaway(message, giveawayData.prize, interaction.guild);

    return interaction.reply({
      embeds: [successEmbed('Giveaway Ended', `The giveaway for **${giveawayData.prize}** has been ended early.`)],
      ephemeral: true,
    });
  } catch (err) {
    logger.error('Giveaway end error:', err);
    const errEmbed = errorEmbed('Error', 'An error occurred while ending the giveaway.');
    if (interaction.replied || interaction.deferred) {
      return interaction.editReply({ embeds: [errEmbed] });
    }
    return interaction.reply({ embeds: [errEmbed], ephemeral: true });
  }
}

/**
 * Rerolls the winners of an ended giveaway.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleReroll(interaction) {
  const messageId = interaction.options.getString('message_id');

  const giveawayData = getGiveaway(messageId);
  if (!giveawayData) {
    return interaction.reply({
      embeds: [errorEmbed('Not Found', `No giveaway found with message ID \`${messageId}\`.`)],
      ephemeral: true,
    });
  }

  if (!giveawayData.ended) {
    return interaction.reply({
      embeds: [errorEmbed('Still Active', 'This giveaway has not ended yet. Use `/giveaway end` first.')],
      ephemeral: true,
    });
  }

  if (giveawayData.entrants.size === 0) {
    return interaction.reply({
      embeds: [errorEmbed('No Entrants', 'There are no entrants to reroll from.')],
      ephemeral: true,
    });
  }

  try {
    const result = rerollGiveaway(messageId);
    if (!result || result.winners.length === 0) {
      return interaction.reply({
        embeds: [errorEmbed('Reroll Failed', 'Could not select new winners.')],
        ephemeral: true,
      });
    }

    const winnerMentions = result.winners.map((id) => `<@${id}>`).join(', ');

    // DM new winners
    for (const userId of result.winners) {
      try {
        const user = await interaction.guild.client.users.fetch(userId).catch(() => null);
        if (user) {
          await user.send({
            embeds: [
              successEmbed(
                '🎉 You Won (Reroll)!',
                `You won **${giveawayData.prize}** in **${interaction.guild.name}**!\nCongratulations!`,
              ),
            ],
          }).catch(() => null);
        }
      } catch {
        // Silently skip DM failures
      }
    }

    return interaction.reply({
      embeds: [
        successEmbed(
          '🎲 Giveaway Rerolled',
          `New winner(s) for **${giveawayData.prize}**: ${winnerMentions}`,
        ),
      ],
    });
  } catch (err) {
    logger.error('Giveaway reroll error:', err);
    const errEmbed = errorEmbed('Error', 'An error occurred during the reroll.');
    if (interaction.replied || interaction.deferred) {
      return interaction.editReply({ embeds: [errEmbed] });
    }
    return interaction.reply({ embeds: [errEmbed], ephemeral: true });
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .addSubcommand((sub) =>
      sub
        .setName('start')
        .setDescription('Start a new giveaway')
        .addStringOption((opt) =>
          opt.setName('prize').setDescription('What are you giving away?').setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName('duration')
            .setDescription('Duration in minutes (1–10080)')
            .setMinValue(1)
            .setMaxValue(10080)
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName('winners')
            .setDescription('Number of winners (1–10, default 1)')
            .setMinValue(1)
            .setMaxValue(10)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('end')
        .setDescription('End a giveaway early')
        .addStringOption((opt) =>
          opt.setName('message_id').setDescription('The message ID of the giveaway').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('reroll')
        .setDescription('Reroll the winner(s) of an ended giveaway')
        .addStringOption((opt) =>
          opt.setName('message_id').setDescription('The message ID of the giveaway').setRequired(true),
        ),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    try {
      const hasManageGuild = interaction.member?.permissions.has(PermissionFlagsBits.ManageGuild);

      if (!hasManageGuild) {
        return interaction.reply({
          embeds: [
            errorEmbed(
              'Insufficient Permissions',
              'You need the **Manage Guild** permission to use this command.',
            ),
          ],
          ephemeral: true,
        });
      }

      const sub = interaction.options.getSubcommand();
      if (sub === 'start') return handleStart(interaction);
      if (sub === 'end') return handleEnd(interaction);
      if (sub === 'reroll') return handleReroll(interaction);
    } catch (err) {
      logger.error('Giveaway command error:', err);
      const errEmbed = errorEmbed('Error', 'An unexpected error occurred.');
      if (interaction.replied || interaction.deferred) {
        return interaction.editReply({ embeds: [errEmbed] });
      }
      return interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  },
};

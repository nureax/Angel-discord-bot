'use strict';

/**
 * ──────────────────────────────────────────────────────────────────────────
 * PERSISTENCE NOTE
 * ──────────────────────────────────────────────────────────────────────────
 * The current implementation uses a plain setTimeout which means all pending
 * reminders are lost if the bot restarts before they fire.
 *
 * For full persistence you would need:
 *   1. A SQLite database (e.g., via `better-sqlite3`) with a table such as:
 *        CREATE TABLE reminders (
 *          id        INTEGER PRIMARY KEY AUTOINCREMENT,
 *          userId    TEXT    NOT NULL,
 *          channelId TEXT    NOT NULL,
 *          guildId   TEXT,
 *          remindAt  INTEGER NOT NULL,   -- Unix ms timestamp
 *          message   TEXT    NOT NULL
 *        );
 *   2. On startup, query all rows where remindAt > NOW() and re-schedule
 *      them with new setTimeouts (or use a job queue like BullMQ).
 *   3. On fire, delete the row from the database.
 *
 * The `activeReminders` export below is a minimal in-process index that
 * could be extended toward this goal.
 * ──────────────────────────────────────────────────────────────────────────
 */

const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { config } = require('../../../config');
const logger = require('../../utils/logger');

/**
 * Tracks all scheduled reminders so they can be inspected or cancelled.
 * Each entry: { userId, channelId, guildId, remindAt (ms), message, timer }
 *
 * @type {Array<{ userId: string, channelId: string, guildId: string|null, remindAt: number, message: string, timer: NodeJS.Timeout }>}
 */
const activeReminders = [];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set a reminder that the bot will DM you after the given time')
    .addStringOption((opt) =>
      opt.setName('message').setDescription('What to remind you about').setRequired(true),
    )
    .addIntegerOption((opt) =>
      opt
        .setName('minutes')
        .setDescription('Minutes until the reminder fires (1–10080)')
        .setMinValue(1)
        .setMaxValue(config.reminder.maxDurationMinutes)
        .setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt
        .setName('hours')
        .setDescription('Hours until the reminder fires (1–168)')
        .setMinValue(1)
        .setMaxValue(168)
        .setRequired(false),
    ),

  // Export activeReminders so it can be inspected or managed externally
  activeReminders,

  async execute(interaction) {
    try {
      const reminderMessage = interaction.options.getString('message');
      const minutes = interaction.options.getInteger('minutes') ?? 0;
      const hours = interaction.options.getInteger('hours') ?? 0;

      const totalMinutes = minutes + hours * 60;

      if (totalMinutes <= 0) {
        return interaction.reply({
          embeds: [errorEmbed('Invalid Duration', 'Please specify at least 1 minute or 1 hour for the reminder.')],
          ephemeral: true,
        });
      }

      if (totalMinutes > config.reminder.maxDurationMinutes) {
        return interaction.reply({
          embeds: [errorEmbed('Duration Too Long', `The maximum reminder duration is ${config.reminder.maxDurationMinutes} minutes (7 days).`)],
          ephemeral: true,
        });
      }

      const userId = interaction.user.id;
      const userReminders = activeReminders.filter(r => r.userId === userId);
      if (userReminders.length >= 5) {
        return interaction.reply({
          embeds: [errorEmbed('Too Many Reminders', 'You already have 5 active reminders. Please wait for some to expire before setting new ones.')],
          ephemeral: true,
        });
      }

      const delay = totalMinutes * 60 * 1000;
      const remindAt = Date.now() + delay;
      const fireAt = Math.floor(remindAt / 1000);
      const setAt = Math.floor(Date.now() / 1000);

      // Capture context before the async gap
      const client = interaction.client;
      const channelId = interaction.channelId;
      const guildId = interaction.guildId ?? null;

      await interaction.reply({
        embeds: [
          successEmbed(
            'Reminder Set',
            `I will remind you about: **${reminderMessage}**\n\n⏰ Fires <t:${fireAt}:R> (<t:${fireAt}:f>)`,
          ),
        ],
        ephemeral: true,
      });

      const reminderEmbed = successEmbed(
        '⏰ Reminder!',
        `You asked me to remind you:\n\n> ${reminderMessage}\n\nSet <t:${setAt}:R>`,
      );

      const timer = setTimeout(async () => {
        // Remove from active reminders list
        const idx = activeReminders.findIndex((r) => r.timer === timer);
        if (idx !== -1) activeReminders.splice(idx, 1);

        // First attempt: DM the user
        try {
          const user = await client.users.fetch(userId).catch(() => null);
          if (user) {
            await user.send({ embeds: [reminderEmbed] });
            return; // DM succeeded — done
          }
        } catch (dmErr) {
          logger.warn(`Could not DM reminder to user ${userId}: ${dmErr.message}`);
        }

        // Fallback: post in the original channel
        try {
          const channel = await client.channels.fetch(channelId).catch(() => null);
          if (channel && channel.isTextBased()) {
            await channel.send({
              content: `<@${userId}> — I couldn't DM you, so here's your reminder:`,
              embeds: [reminderEmbed],
            });
          }
        } catch (chanErr) {
          logger.warn(`Could not send fallback reminder to channel ${channelId}: ${chanErr.message}`);
        }
      }, delay);

      // Track the active reminder
      activeReminders.push({
        userId,
        channelId,
        guildId,
        remindAt,
        message: reminderMessage,
        timer,
      });
    } catch (err) {
      logger.error('Remind command error:', err);
      const errEmbed = errorEmbed('Error', 'An error occurred while setting your reminder.');
      if (interaction.replied || interaction.deferred) {
        return interaction.editReply({ embeds: [errEmbed] });
      }
      return interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  },
};

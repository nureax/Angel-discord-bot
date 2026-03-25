'use strict';

const { PermissionFlagsBits } = require('discord.js');
const logger = require('../utils/logger');
const { addXp } = require('../utils/xpStore');
const { createBaseEmbed, warningEmbed } = require('../utils/embed');
const { config } = require('../../config');
const { getSettings, trackMessage, resetSpamCounter } = require('../utils/automodStore');

// Regex to detect Discord invite links
const INVITE_REGEX = /discord(?:\.gg|(?:app)?\.com\/invite)\/[a-zA-Z0-9-]+/i;

module.exports = {
  name: 'messageCreate',

  async execute(message, client) {
    // Ignore bots and DMs (slash commands are the primary interface)
    if (message.author.bot || !message.guild) return;

    // Log messages only at debug level to avoid noisy output
    logger.debug(
      `Message from ${message.author.tag} in #${message.channel?.name ?? 'unknown'} (${message.guild.name}): ${(message.content ?? '').slice(0, 80)}`,
    );

    // ── XP / Leveling ──────────────────────────────────────────────────────
    try {
      const result = addXp(message.guild.id, message.author.id);

      if (result.leveledUp) {
        const embed = createBaseEmbed(config.colors.success)
          .setTitle('🎉 Level Up!')
          .setDescription(`${message.author} reached **Level ${result.newLevel}**!`)
          .setThumbnail(message.author.displayAvatarURL({ extension: 'gif', forceStatic: false }));

        await message.channel.send({ embeds: [embed] }).catch((err) => {
          logger.warn(`Could not send level-up message in #${message.channel?.name}:`, err);
        });
      }
    } catch (err) {
      logger.error('XP processing error:', err);
    }

    // ── Auto-Moderation ─────────────────────────────────────────────────────
    try {
      const settings = getSettings(message.guild.id);

      // Admins are immune to automod
      const member = message.member;
      const isMod = member && member.permissions.has(PermissionFlagsBits.Administrator);
      if (isMod) return;

      const content = message.content ?? '';

      /**
       * Helper: delete the message and send a temporary warning reply.
       * @param {string} reason
       */
      const warnAndDelete = async (reason) => {
        await message.delete().catch(() => null);

        const embed = warningEmbed('Auto-Moderation', `${message.author}, your message was removed.\n**Reason:** ${reason}`);
        const reply = await message.channel.send({ embeds: [embed] }).catch(() => null);

        if (reply) {
          setTimeout(() => reply.delete().catch(() => null), 5000);
        }
      };

      // ── Spam ──────────────────────────────────────────────────────────────
      if (settings.spam) {
        const { isSpam } = trackMessage(message.guild.id, message.author.id);
        if (isSpam) {
          resetSpamCounter(message.guild.id, message.author.id);

          // Delete all recent messages from this user in the channel (up to 100)
          const recent = await message.channel.messages.fetch({ limit: 100 }).catch(() => null);
          if (recent) {
            const userMessages = recent.filter((m) => m.author.id === message.author.id);
            for (const [, msg] of userMessages) {
              await msg.delete().catch(() => null);
            }
          }

          const embed = warningEmbed(
            'Auto-Moderation — Spam',
            `${message.author}, you are sending messages too fast. Slow down!`,
          );
          const reply = await message.channel.send({ embeds: [embed] }).catch(() => null);
          if (reply) setTimeout(() => reply.delete().catch(() => null), 5000);
          return;
        }
      }

      // ── Caps ──────────────────────────────────────────────────────────────
      if (settings.caps && content.length > 10) {
        const letters = content.replace(/[^a-zA-Z]/g, '');
        if (letters.length > 0) {
          const upperCount = letters.split('').filter((c) => c === c.toUpperCase()).length;
          const capsRatio = upperCount / letters.length;
          if (capsRatio > 0.7) {
            await warnAndDelete('Excessive caps are not allowed.');
            return;
          }
        }
      }

      // ── Invites ───────────────────────────────────────────────────────────
      if (settings.invites && INVITE_REGEX.test(content)) {
        await warnAndDelete('Discord invite links are not allowed here.');
        return;
      }

      // ── Mentions ──────────────────────────────────────────────────────────
      if (settings.mentions) {
        const mentionCount = message.mentions.users.size;
        if (mentionCount >= 5) {
          await warnAndDelete(`Mass mentions (${mentionCount} users) are not allowed.`);
          return;
        }
      }
    } catch (err) {
      logger.error('Automod processing error:', err);
    }
  },
};

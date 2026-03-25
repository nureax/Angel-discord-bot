'use strict';

const { EmbedBuilder } = require('discord.js');
const { config } = require('../../config');
const logger = require('./logger');

/**
 * Colors keyed by action severity.
 * @type {Record<string, number>}
 */
const ACTION_COLORS = {
  BAN: config.colors.error,
  UNBAN: config.colors.success,
  KICK: config.colors.warning,
  MUTE: config.colors.warning,
  WARN: config.colors.warning,
  PURGE: config.colors.info,
  TICKET_CLOSE: config.colors.neutral,
};

/**
 * Attempts to find the mod-log channel in a guild.
 * Checks (in order): 'mod-log', 'modlog', 'audit-log'
 *
 * @param {import('discord.js').Guild} guild
 * @returns {import('discord.js').TextChannel | null}
 */
function findModLogChannel(guild) {
  const candidates = ['mod-log', 'modlog', 'audit-log'];
  for (const name of candidates) {
    const channel = guild.channels.cache.find(
      (c) => c.name === name && c.isTextBased(),
    );
    if (channel) return channel;
  }
  return null;
}

/**
 * Sends a structured embed to the configured mod-log channel.
 * Silently returns if no suitable channel is found.
 *
 * @param {import('discord.js').Guild} guild
 * @param {'BAN'|'KICK'|'MUTE'|'WARN'|'UNBAN'|'PURGE'} action
 * @param {{ moderator: import('discord.js').User, target?: import('discord.js').User|string, reason?: string, extra?: string }} details
 */
async function sendModLog(guild, action, { moderator, target, reason, extra } = {}) {
  const channel = findModLogChannel(guild);
  if (!channel) return;

  const color = ACTION_COLORS[action] ?? config.colors.neutral;

  const safeReason = (reason || 'No reason provided')
    .replace(/@everyone/gi, '@\u200beveryone')
    .replace(/@here/gi, '@\u200bhere');

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`🔨 Moderation Action — ${action}`)
    .addFields(
      {
        name: 'Moderator',
        value: moderator ? `${moderator.tag} (<@${moderator.id}>)` : 'Unknown',
        inline: true,
      },
    )
    .setTimestamp()
    .setFooter({ text: 'Angel Bot • Mod Log' });

  if (target) {
    const targetStr =
      typeof target === 'string'
        ? target
        : `${target.tag} (<@${target.id}>)`;
    embed.addFields({ name: 'Target', value: targetStr, inline: true });
  }

  if (reason) {
    embed.addFields({ name: 'Reason', value: safeReason });
  }

  if (extra) {
    embed.addFields({ name: 'Details', value: extra });
  }

  try {
    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.warn(`Failed to send mod-log message to #${channel.name}:`, err);
  }
}

module.exports = { sendModLog };

'use strict';

const logger = require('./logger');

/**
 * In-memory store for stat channel configuration.
 * Map<guildId, { categoryId, memberChannelId?, botChannelId?, totalChannelId? }>
 * @type {Map<string, { categoryId: string, memberChannelId?: string, botChannelId?: string, totalChannelId?: string }>}
 */
const store = new Map();

/**
 * Saves stat channel config for a guild.
 * @param {string} guildId
 * @param {{ categoryId: string, memberChannelId?: string, botChannelId?: string, totalChannelId?: string }} data
 */
function setStats(guildId, data) {
  store.set(guildId, { ...data });
}

/**
 * Retrieves stat channel config for a guild, or undefined if not set.
 * @param {string} guildId
 * @returns {{ categoryId: string, memberChannelId?: string, botChannelId?: string, totalChannelId?: string } | undefined}
 */
function getStats(guildId) {
  return store.get(guildId);
}

/**
 * Removes stat channel config for a guild.
 * @param {string} guildId
 */
function clearStats(guildId) {
  store.delete(guildId);
}

/**
 * Updates the names of configured stat channels to reflect current member counts.
 * Wraps each rename in its own try/catch to tolerate rate-limit errors.
 *
 * Discord allows channel renames at a maximum of 2 per 10 minutes per channel,
 * so we use guild.memberCount (accurate) rather than guild.members.cache.size
 * (may be stale) and accept that some updates may be silently skipped.
 *
 * @param {import('discord.js').Guild} guild
 */
async function updateStatChannels(guild) {
  const data = getStats(guild.id);
  if (!data) return;

  const totalCount = guild.memberCount;

  // Count bots vs humans using the cache (best-effort; may be partial for large guilds)
  let botCount = 0;
  let humanCount = 0;
  guild.members.cache.forEach((m) => {
    if (m.user.bot) botCount++;
    else humanCount++;
  });

  // If cache is empty/stale fall back to rough estimate
  if (guild.members.cache.size === 0) {
    botCount = 0;
    humanCount = totalCount;
  }

  const updates = [];
  if (data.memberChannelId) updates.push({ id: data.memberChannelId, name: `Members: ${humanCount}` });
  if (data.botChannelId) updates.push({ id: data.botChannelId, name: `Bots: ${botCount}` });
  if (data.totalChannelId) updates.push({ id: data.totalChannelId, name: `Total: ${totalCount}` });

  for (const { id, name } of updates) {
    try {
      const channel = guild.channels.cache.get(id);
      if (channel) {
        await channel.setName(name);
      }
    } catch (err) {
      // Silently swallow rate-limit errors; the channel will update on the next event
      logger.warn(`Stats channel update failed for ${id} in ${guild.name}: ${err.message}`);
    }
  }
}

module.exports = { setStats, getStats, clearStats, updateStatChannels };

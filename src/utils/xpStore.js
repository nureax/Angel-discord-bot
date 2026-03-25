'use strict';

/**
 * In-memory XP store.
 * Structure: Map<guildId, Map<userId, { xp, level, lastMessage }>>
 *
 * NOTE: XP data is lost on bot restart. For production use, replace this
 * with a persistent database (e.g., SQLite via better-sqlite3, or MongoDB).
 * Store schema: { userId, guildId, xp, level, lastMessage (unix ms timestamp) }
 */

const { config } = require('../../config');

/** @type {Map<string, Map<string, { xp: number, level: number, lastMessage: number }>>} */
const store = new Map();

/**
 * Calculates the level for a given XP value.
 * Formula: level = Math.floor(0.1 * Math.sqrt(xp))  (MEE6-style curve)
 *
 * @param {number} xp
 * @returns {number}
 */
function xpToLevel(xp) {
  return Math.floor(0.1 * Math.sqrt(xp));
}

/**
 * Calculates the minimum XP required to reach a given level.
 * Inverse of xpToLevel: xp = (level / 0.1)^2
 *
 * @param {number} level
 * @returns {number}
 */
function levelToXp(level) {
  return Math.pow(level / 0.1, 2);
}

/**
 * Ensures the guild and user entries exist in the store.
 *
 * @param {string} guildId
 * @param {string} userId
 * @returns {{ xp: number, level: number, lastMessage: number }}
 */
function getOrCreate(guildId, userId) {
  if (!store.has(guildId)) store.set(guildId, new Map());
  const guild = store.get(guildId);
  if (!guild.has(userId)) guild.set(userId, { xp: 0, level: 0, lastMessage: 0 });
  return guild.get(userId);
}

/**
 * Awards XP to a user in a guild, respecting the cooldown.
 * Returns data about the update including whether the user leveled up.
 *
 * @param {string} guildId
 * @param {string} userId
 * @param {number} [amount] - XP to add; if omitted, uses a random value from config
 * @returns {{ xp: number, level: number, leveledUp: boolean, newLevel: number }}
 */
function addXp(guildId, userId, amount) {
  const xpConfig = config.xp;
  const now = Date.now();
  const cooldownMs = xpConfig.cooldownSeconds * 1000;

  const userData = getOrCreate(guildId, userId);

  // Enforce cooldown
  if (now - userData.lastMessage < cooldownMs) {
    return { xp: userData.xp, level: userData.level, leveledUp: false, newLevel: userData.level };
  }

  // Determine how much XP to award
  const awarded =
    amount !== undefined
      ? amount
      : Math.floor(Math.random() * (xpConfig.maxPerMessage - xpConfig.minPerMessage + 1)) +
        xpConfig.minPerMessage;

  const oldLevel = userData.level;
  userData.xp += awarded;
  userData.lastMessage = now;
  userData.level = xpToLevel(userData.xp);

  const leveledUp = userData.level > oldLevel;

  return {
    xp: userData.xp,
    level: userData.level,
    leveledUp,
    newLevel: userData.level,
  };
}

/**
 * Retrieves a user's XP and level.
 *
 * @param {string} guildId
 * @param {string} userId
 * @returns {{ xp: number, level: number }}
 */
function getUser(guildId, userId) {
  const userData = getOrCreate(guildId, userId);
  return { xp: userData.xp, level: userData.level };
}

/**
 * Returns a sorted leaderboard for a guild.
 *
 * @param {string} guildId
 * @param {number} [limit=10]
 * @returns {Array<{ userId: string, xp: number, level: number }>}
 */
function getLeaderboard(guildId, limit = 10) {
  const guild = store.get(guildId);
  if (!guild) return [];

  return Array.from(guild.entries())
    .map(([userId, data]) => ({ userId, xp: data.xp, level: data.level }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);
}

module.exports = { addXp, getUser, getLeaderboard, xpToLevel, levelToXp };

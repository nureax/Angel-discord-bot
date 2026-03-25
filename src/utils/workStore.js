'use strict';

/**
 * In-memory work cooldown store.
 * Structure: Map<guildId, Map<userId, lastWorkTime (ms timestamp)>>
 *
 * Cooldown: 1 hour per user per guild.
 */

/** @type {Map<string, Map<string, number>>} */
const workData = new Map();

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

/**
 * Ensures the guild map exists in the store.
 *
 * @param {string} guildId
 * @returns {Map<string, number>}
 */
function getGuild(guildId) {
  if (!workData.has(guildId)) workData.set(guildId, new Map());
  return workData.get(guildId);
}

/**
 * Returns true if more than 1 hour has passed since the user last worked.
 *
 * @param {string} guildId
 * @param {string} userId
 * @returns {boolean}
 */
function canWork(guildId, userId) {
  const guild = getGuild(guildId);
  if (!guild.has(userId)) return true;
  return Date.now() - guild.get(userId) >= COOLDOWN_MS;
}

/**
 * Records the current time as the user's last work time.
 *
 * @param {string} guildId
 * @param {string} userId
 */
function recordWork(guildId, userId) {
  const guild = getGuild(guildId);
  guild.set(userId, Date.now());
}

/**
 * Returns milliseconds remaining until the user can work again.
 * Returns 0 if ready.
 *
 * @param {string} guildId
 * @param {string} userId
 * @returns {number}
 */
function getTimeRemaining(guildId, userId) {
  const guild = getGuild(guildId);
  if (!guild.has(userId)) return 0;
  const elapsed = Date.now() - guild.get(userId);
  return Math.max(0, COOLDOWN_MS - elapsed);
}

module.exports = { canWork, recordWork, getTimeRemaining };

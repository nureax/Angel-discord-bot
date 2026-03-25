'use strict';

/**
 * In-memory daily claim store.
 * Structure: Map<guildId, Map<userId, { lastClaim: Date|null, streak: number }>>
 *
 * NOTE: Data is lost on bot restart. For production use, replace with a persistent store.
 */

/** @type {Map<string, Map<string, { lastClaim: Date|null, streak: number }>>} */
const dailyData = new Map();

const COOLDOWN_MS = 20 * 60 * 60 * 1000;   // 20 hours
const STREAK_RESET_MS = 48 * 60 * 60 * 1000; // 48 hours — gap that resets streak

/**
 * Ensures the guild and user entries exist in the store.
 *
 * @param {string} guildId
 * @param {string} userId
 * @returns {{ lastClaim: Date|null, streak: number }}
 */
function getOrCreate(guildId, userId) {
  if (!dailyData.has(guildId)) dailyData.set(guildId, new Map());
  const guild = dailyData.get(guildId);
  if (!guild.has(userId)) guild.set(userId, { lastClaim: null, streak: 0 });
  return guild.get(userId);
}

/**
 * Returns true if more than 20 hours have passed since the last claim.
 *
 * @param {string} guildId
 * @param {string} userId
 * @returns {boolean}
 */
function canClaim(guildId, userId) {
  const data = getOrCreate(guildId, userId);
  if (!data.lastClaim) return true;
  return Date.now() - data.lastClaim.getTime() >= COOLDOWN_MS;
}

/**
 * Records a daily claim. Increments streak if within 48 hours of last claim,
 * otherwise resets streak to 1.
 *
 * @param {string} guildId
 * @param {string} userId
 */
function recordClaim(guildId, userId) {
  const data = getOrCreate(guildId, userId);
  const now = new Date();

  if (!data.lastClaim || (now.getTime() - data.lastClaim.getTime()) > STREAK_RESET_MS) {
    data.streak = 1;
  } else {
    data.streak += 1;
  }

  data.lastClaim = now;
}

/**
 * Returns the current streak for a user.
 *
 * @param {string} guildId
 * @param {string} userId
 * @returns {number}
 */
function getStreak(guildId, userId) {
  const data = getOrCreate(guildId, userId);
  return data.streak;
}

/**
 * Returns the Date of the last claim, or null if never claimed.
 *
 * @param {string} guildId
 * @param {string} userId
 * @returns {Date|null}
 */
function getLastClaim(guildId, userId) {
  const data = getOrCreate(guildId, userId);
  return data.lastClaim;
}

module.exports = { canClaim, recordClaim, getStreak, getLastClaim };

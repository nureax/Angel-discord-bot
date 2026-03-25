'use strict';

/**
 * In-memory warn store.
 * Structure: Map<guildId, Map<userId, WarnEntry[]>>
 *
 * NOTE: Warnings are lost on bot restart. For production use,
 * replace this with a persistent database (e.g., SQLite, MongoDB).
 */

/** @type {Map<string, Map<string, WarnEntry[]>>} */
const store = new Map();

/**
 * @typedef {Object} WarnEntry
 * @property {string} reason
 * @property {string} moderatorId
 * @property {string} moderatorTag
 * @property {number} timestamp
 */

/**
 * Adds a warning for a user in a guild.
 *
 * @param {string} guildId
 * @param {string} userId
 * @param {WarnEntry} entry
 * @returns {WarnEntry[]} All warnings for the user after adding
 */
function addWarn(guildId, userId, entry) {
  if (!store.has(guildId)) store.set(guildId, new Map());
  const guildWarns = store.get(guildId);
  if (!guildWarns.has(userId)) guildWarns.set(userId, []);
  const warns = guildWarns.get(userId);
  warns.push({ ...entry, timestamp: Date.now() });
  return warns;
}

/**
 * Retrieves all warnings for a user in a guild.
 *
 * @param {string} guildId
 * @param {string} userId
 * @returns {WarnEntry[]}
 */
function getWarns(guildId, userId) {
  return store.get(guildId)?.get(userId) ?? [];
}

/**
 * Clears all warnings for a user in a guild.
 *
 * @param {string} guildId
 * @param {string} userId
 * @returns {number} Number of warnings cleared
 */
function clearWarns(guildId, userId) {
  const guildWarns = store.get(guildId);
  if (!guildWarns) return 0;
  const count = guildWarns.get(userId)?.length ?? 0;
  guildWarns.delete(userId);
  return count;
}

module.exports = { addWarn, getWarns, clearWarns };

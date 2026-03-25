'use strict';

/**
 * In-memory giveaway store.
 * Structure: Map<messageId, GiveawayData>
 *
 * NOTE: Giveaway data is lost on bot restart. For production use, persist
 * this in a database so active giveaways survive process restarts.
 *
 * @typedef {Object} GiveawayData
 * @property {string}   prize
 * @property {number}   endTime     - Unix ms timestamp when the giveaway ends
 * @property {number}   winnersCount
 * @property {Set<string>} entrants - Set of user IDs who entered
 * @property {boolean}  ended
 * @property {string[]} winners     - Array of winner user IDs (populated after end)
 */

/** @type {Map<string, GiveawayData>} */
const store = new Map();

/**
 * Registers a new giveaway.
 *
 * @param {string} messageId
 * @param {{ prize: string, endTime: number, winnersCount: number, guildId: string }} data
 */
function createGiveaway(messageId, data) {
  const activeCount = Array.from(store.values()).filter(g => !g.ended && g.guildId === data.guildId).length;
  if (activeCount >= 5) throw new Error('Maximum of 5 active giveaways per guild reached.');

  store.set(messageId, {
    prize: data.prize,
    endTime: data.endTime,
    winnersCount: data.winnersCount,
    guildId: data.guildId,
    entrants: new Set(),
    ended: false,
    winners: [],
  });
}

/**
 * Adds a user to a giveaway's entrants.
 *
 * @param {string} messageId
 * @param {string} userId
 * @returns {{ success: boolean, alreadyEntered: boolean }}
 */
function enterGiveaway(messageId, userId) {
  const giveaway = store.get(messageId);
  if (!giveaway || giveaway.ended) return { success: false, alreadyEntered: false };

  if (giveaway.entrants.has(userId)) {
    return { success: false, alreadyEntered: true };
  }

  giveaway.entrants.add(userId);
  return { success: true, alreadyEntered: false };
}

/**
 * Ends a giveaway and selects winners randomly.
 *
 * @param {string} messageId
 * @returns {{ winners: string[], entrants: Set<string> } | null}
 */
function endGiveaway(messageId) {
  const giveaway = store.get(messageId);
  if (!giveaway) return null;

  giveaway.ended = true;

  const pool = Array.from(giveaway.entrants);
  const count = Math.min(giveaway.winnersCount, pool.length);

  // Fisher-Yates shuffle to pick winners without repeats
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  giveaway.winners = shuffled.slice(0, count);
  return { winners: giveaway.winners, entrants: giveaway.entrants };
}

/**
 * Rerolls winners for a completed giveaway, picking new random entrants.
 *
 * @param {string} messageId
 * @returns {{ winners: string[], entrants: Set<string> } | null}
 */
function rerollGiveaway(messageId) {
  const giveaway = store.get(messageId);
  if (!giveaway) return null;

  const pool = Array.from(giveaway.entrants);
  const count = Math.min(giveaway.winnersCount, pool.length);

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  giveaway.winners = shuffled.slice(0, count);
  return { winners: giveaway.winners, entrants: giveaway.entrants };
}

/**
 * Returns the giveaway data for a message, or null if not found.
 *
 * @param {string} messageId
 * @returns {GiveawayData | null}
 */
function getGiveaway(messageId) {
  return store.get(messageId) ?? null;
}

module.exports = { createGiveaway, enterGiveaway, endGiveaway, rerollGiveaway, getGiveaway };

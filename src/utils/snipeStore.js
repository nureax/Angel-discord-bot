'use strict';

/**
 * snipeStore.js
 * In-memory store for the snipe and edit-snipe commands.
 *
 * Deleted messages: Map<guildId, Map<channelId, { content, author, authorAvatar, deletedAt, storedAt }>>
 * Edited messages:  Map<guildId, Map<channelId, { before, after, author, authorAvatar, editedAt, storedAt }>>
 */

const TTL_MS = 3_600_000; // 1 hour

/** @type {Map<string, Map<string, { content: string, author: string, authorAvatar: string, deletedAt: Date, storedAt: number }>>} */
const snipeData = new Map();

/** @type {Map<string, Map<string, { before: string, after: string, author: string, authorAvatar: string, editedAt: Date, storedAt: number }>>} */
const editSnipeData = new Map();

/**
 * Store data for the last deleted message in a channel.
 * @param {string} guildId
 * @param {string} channelId
 * @param {{ content: string, author: string, authorAvatar: string }} data
 */
function setSnipe(guildId, channelId, data) {
  if (!snipeData.has(guildId)) snipeData.set(guildId, new Map());
  snipeData.get(guildId).set(channelId, { ...data, deletedAt: new Date(), storedAt: Date.now() });
}

/**
 * Retrieve the last deleted message for a channel.
 * Returns null if not found or older than 1 hour.
 * @param {string} guildId
 * @param {string} channelId
 * @returns {{ content: string, author: string, authorAvatar: string, deletedAt: Date } | null}
 */
function getSnipe(guildId, channelId) {
  const entry = snipeData.get(guildId)?.get(channelId);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > TTL_MS) return null;
  return entry;
}

/**
 * Store data for the last edited message in a channel.
 * @param {string} guildId
 * @param {string} channelId
 * @param {{ before: string, after: string, author: string, authorAvatar: string }} data
 */
function setEditSnipe(guildId, channelId, data) {
  if (!editSnipeData.has(guildId)) editSnipeData.set(guildId, new Map());
  editSnipeData.get(guildId).set(channelId, { ...data, editedAt: new Date(), storedAt: Date.now() });
}

/**
 * Retrieve the last edited message for a channel.
 * Returns null if not found or older than 1 hour.
 * @param {string} guildId
 * @param {string} channelId
 * @returns {{ before: string, after: string, author: string, authorAvatar: string, editedAt: Date } | null}
 */
function getEditSnipe(guildId, channelId) {
  const entry = editSnipeData.get(guildId)?.get(channelId);
  if (!entry) return null;
  if (Date.now() - entry.storedAt > TTL_MS) return null;
  return entry;
}

module.exports = { setSnipe, getSnipe, setEditSnipe, getEditSnipe };

'use strict';

/**
 * automodStore.js
 * In-memory store for Auto-Moderation settings and spam tracking.
 *
 * Settings:      Map<guildId, { spam: bool, caps: bool, invites: bool, mentions: bool }>
 * Spam tracking: Map<guildId, Map<userId, { count: number, firstMessage: number }>>
 */

const { config } = require('../../config');

const SPAM_WINDOW_MS = config.moderation.automod.spamWindowMs;
const SPAM_THRESHOLD = config.moderation.automod.spamThreshold;

/** @type {Map<string, { spam: boolean, caps: boolean, invites: boolean, mentions: boolean }>} */
const settingsStore = new Map();

/** @type {Map<string, Map<string, { count: number, firstMessage: number }>>} */
const spamTracker = new Map();

/**
 * Get automod settings for a guild. Defaults all rules to disabled.
 * @param {string} guildId
 * @returns {{ spam: boolean, caps: boolean, invites: boolean, mentions: boolean }}
 */
function getSettings(guildId) {
  if (!settingsStore.has(guildId)) {
    settingsStore.set(guildId, { spam: false, caps: false, invites: false, mentions: false });
  }
  return settingsStore.get(guildId);
}

/**
 * Enable or disable a specific automod rule for a guild.
 * @param {string} guildId
 * @param {'spam'|'caps'|'invites'|'mentions'} rule
 * @param {boolean} enabled
 */
function updateSetting(guildId, rule, enabled) {
  const current = getSettings(guildId);
  current[rule] = enabled;
  settingsStore.set(guildId, current);
}

/**
 * Track a message from a user and determine if the spam threshold is exceeded.
 * Resets the window when the cooldown expires.
 * @param {string} guildId
 * @param {string} userId
 * @returns {{ count: number, isSpam: boolean }}
 */
function trackMessage(guildId, userId) {
  if (!spamTracker.has(guildId)) {
    spamTracker.set(guildId, new Map());
  }

  const guildMap = spamTracker.get(guildId);
  const now = Date.now();
  const entry = guildMap.get(userId);

  if (!entry || now - entry.firstMessage > SPAM_WINDOW_MS) {
    // Start a fresh window
    guildMap.set(userId, { count: 1, firstMessage: now });
    return { count: 1, isSpam: false };
  }

  entry.count += 1;
  const isSpam = entry.count >= SPAM_THRESHOLD;
  return { count: entry.count, isSpam };
}

/**
 * Reset the spam counter for a user in a guild (call after taking action).
 * @param {string} guildId
 * @param {string} userId
 */
function resetSpamCounter(guildId, userId) {
  spamTracker.get(guildId)?.delete(userId);
}

// Run every 10 minutes, evict stale spam entries
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [guildId, guildMap] of spamTracker) {
    for (const [userId, entry] of guildMap) {
      if (now - entry.firstMessage > SPAM_WINDOW_MS) {
        guildMap.delete(userId);
      }
    }
    if (guildMap.size === 0) spamTracker.delete(guildId);
  }
}, 10 * 60 * 1000);
cleanupInterval.unref();

module.exports = { getSettings, updateSetting, trackMessage, resetSpamCounter };

'use strict';

/**
 * ticketStore.js
 * In-memory store for the ticket system.
 *
 * Setup config: Map<guildId, { channelId, categoryId, supportRoleId }>
 *   channelId     - The channel where the "Create Ticket" button is posted
 *   categoryId    - Optional category to place new ticket channels under
 *   supportRoleId - Optional role that receives view access to every ticket
 *
 * Open tickets:  Map<channelId, { guildId, userId, createdAt }>
 */

/** @type {Map<string, { channelId: string, categoryId: string|null, supportRoleId: string|null }>} */
const setupStore = new Map();

/** @type {Map<string, { guildId: string, userId: string, createdAt: Date }>} */
const openTickets = new Map();

/**
 * Persist guild-level ticket setup configuration.
 * @param {string} guildId
 * @param {{ channelId: string, categoryId?: string|null, supportRoleId?: string|null }} config
 */
function setSetup(guildId, { channelId, categoryId = null, supportRoleId = null }) {
  setupStore.set(guildId, { channelId, categoryId, supportRoleId });
}

/**
 * Retrieve guild-level ticket setup configuration.
 * @param {string} guildId
 * @returns {{ channelId: string, categoryId: string|null, supportRoleId: string|null } | undefined}
 */
function getSetup(guildId) {
  return setupStore.get(guildId);
}

/**
 * Register a new open ticket channel.
 * @param {string} channelId
 * @param {{ guildId: string, userId: string }} data
 */
function openTicket(channelId, { guildId, userId }) {
  openTickets.set(channelId, { guildId, userId, createdAt: new Date() });
}

/**
 * Remove a ticket from the open-tickets store.
 * @param {string} channelId
 */
function closeTicket(channelId) {
  openTickets.delete(channelId);
}

/**
 * Check whether a channel ID corresponds to an open ticket.
 * @param {string} channelId
 * @returns {boolean}
 */
function isTicketChannel(channelId) {
  return openTickets.has(channelId);
}

/**
 * Retrieve the ticket metadata for a channel.
 * @param {string} channelId
 * @returns {{ guildId: string, userId: string, createdAt: Date } | undefined}
 */
function getTicket(channelId) {
  return openTickets.get(channelId);
}

/**
 * Find an open ticket channel for a specific user in a guild.
 * @param {string} guildId
 * @param {string} userId
 * @returns {string|null} The channelId if found, or null if no open ticket exists.
 */
function getUserTicket(guildId, userId) {
  for (const [channelId, ticket] of openTickets) {
    if (ticket.guildId === guildId && ticket.userId === userId) {
      return channelId;
    }
  }
  return null;
}

module.exports = { setSetup, getSetup, openTicket, closeTicket, isTicketChannel, getTicket, getUserTicket };

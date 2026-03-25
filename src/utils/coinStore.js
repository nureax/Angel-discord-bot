'use strict';

/**
 * In-memory economy/coin store.
 * Structure: Map<guildId, Map<userId, { wallet: number, bank: number }>>
 *
 * NOTE: Coin data is lost on bot restart. For production use, replace this
 * with a persistent database (e.g., SQLite via better-sqlite3, or MongoDB).
 */

/** @type {Map<string, Map<string, { wallet: number, bank: number }>>} */
const coinData = new Map();

/**
 * Ensures the guild and user entries exist in the store.
 *
 * @param {string} guildId
 * @param {string} userId
 * @returns {{ wallet: number, bank: number }}
 */
function getOrCreate(guildId, userId) {
  if (!coinData.has(guildId)) coinData.set(guildId, new Map());
  const guild = coinData.get(guildId);
  if (!guild.has(userId)) guild.set(userId, { wallet: 0, bank: 0 });
  return guild.get(userId);
}

/**
 * Returns a user's wallet and bank balances.
 *
 * @param {string} guildId
 * @param {string} userId
 * @returns {{ wallet: number, bank: number }}
 */
function getBalance(guildId, userId) {
  const data = getOrCreate(guildId, userId);
  return { wallet: data.wallet, bank: data.bank };
}

/**
 * Adds (or subtracts) an amount from a user's wallet. Clamps to 0 minimum.
 *
 * @param {string} guildId
 * @param {string} userId
 * @param {number} amount - can be negative
 * @returns {{ wallet: number, bank: number }}
 */
function addToWallet(guildId, userId, amount) {
  const data = getOrCreate(guildId, userId);
  data.wallet = Math.max(0, data.wallet + amount);
  return { wallet: data.wallet, bank: data.bank };
}

/**
 * Moves an amount from wallet to bank (clamped to available wallet balance).
 * Returns the actual amount deposited.
 *
 * @param {string} guildId
 * @param {string} userId
 * @param {number} amount
 * @returns {number} actual amount deposited
 */
function deposit(guildId, userId, amount) {
  const data = getOrCreate(guildId, userId);
  const actual = Math.min(amount, data.wallet);
  if (actual <= 0) return 0;
  data.wallet -= actual;
  data.bank += actual;
  return actual;
}

/**
 * Moves an amount from bank to wallet (clamped to available bank balance).
 * Returns the actual amount withdrawn.
 *
 * @param {string} guildId
 * @param {string} userId
 * @param {number} amount
 * @returns {number} actual amount withdrawn
 */
function withdraw(guildId, userId, amount) {
  const data = getOrCreate(guildId, userId);
  const actual = Math.min(amount, data.bank);
  if (actual <= 0) return 0;
  data.bank -= actual;
  data.wallet += actual;
  return actual;
}

/**
 * Sets a user's wallet directly.
 *
 * @param {string} guildId
 * @param {string} userId
 * @param {number} amount
 */
function setWallet(guildId, userId, amount) {
  const data = getOrCreate(guildId, userId);
  data.wallet = Math.max(0, amount);
}

/**
 * Sets a user's bank directly.
 *
 * @param {string} guildId
 * @param {string} userId
 * @param {number} amount
 */
function setBank(guildId, userId, amount) {
  const data = getOrCreate(guildId, userId);
  data.bank = Math.max(0, amount);
}

/**
 * Returns the top N users by total wealth (wallet + bank) for a guild.
 *
 * @param {string} guildId
 * @param {number} [topN=10]
 * @returns {Array<{ userId: string, wallet: number, bank: number, total: number }>}
 */
function getLeaderboard(guildId, topN = 10) {
  const guild = coinData.get(guildId);
  if (!guild) return [];

  return Array.from(guild.entries())
    .map(([userId, data]) => ({
      userId,
      wallet: data.wallet,
      bank: data.bank,
      total: data.wallet + data.bank,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, topN);
}

module.exports = { getBalance, addToWallet, deposit, withdraw, setWallet, setBank, getLeaderboard };

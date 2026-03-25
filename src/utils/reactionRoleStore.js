'use strict';

/**
 * In-memory reaction role store.
 * Structure: Map<messageId, Map<customButtonId, roleId>>
 *
 * NOTE: Role mappings are lost on bot restart. For production use, persist
 * this data in a database (e.g., SQLite) so role buttons survive restarts.
 */

/** @type {Map<string, Map<string, string>>} */
const store = new Map();

/**
 * Registers the button→role mapping for a posted reaction-role message.
 *
 * @param {string} messageId
 * @param {Record<string, string>} buttonRoleMap - { [customId]: roleId }
 */
function setRoleMessage(messageId, buttonRoleMap) {
  const map = new Map(Object.entries(buttonRoleMap));
  store.set(messageId, map);
}

/**
 * Returns the roleId associated with a button on a specific message,
 * or null if not found.
 *
 * @param {string} messageId
 * @param {string} customId
 * @returns {string | null}
 */
function getRoleForButton(messageId, customId) {
  const msgMap = store.get(messageId);
  if (!msgMap) return null;
  return msgMap.get(customId) ?? null;
}

/**
 * Checks whether a message is a managed reaction-role message.
 *
 * @param {string} messageId
 * @returns {boolean}
 */
function isRoleMessage(messageId) {
  return store.has(messageId);
}

module.exports = { setRoleMessage, getRoleForButton, isRoleMessage };

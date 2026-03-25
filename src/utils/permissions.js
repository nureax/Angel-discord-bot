'use strict';

const { PermissionFlagsBits } = require('discord.js');
const { errorEmbed } = require('./embed');

/**
 * Checks whether the bot has the required permissions in the interaction's channel.
 * Replies with an error embed if not. Returns true if all permissions are present.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {bigint[]} permissions - Array of PermissionFlagsBits values
 * @returns {Promise<boolean>}
 */
async function checkBotPermissions(interaction, permissions) {
  const me = interaction.guild?.members?.me;
  if (!me) return true; // DM context — skip guild permission checks

  const missing = permissions.filter((perm) => !me.permissions.has(perm));
  if (missing.length === 0) return true;

  const permNames = missing.map((p) => {
    // Convert BigInt flag to a readable name via the permissions object
    const entry = Object.entries(PermissionFlagsBits)
      .find(([, v]) => v === p);
    return entry ? entry[0] : String(p);
  });

  await interaction.reply({
    embeds: [errorEmbed('Missing Permissions', `I need the following permissions to run this command:\n${permNames.map((n) => `• \`${n}\``).join('\n')}`)],
    ephemeral: true,
  });
  return false;
}

/**
 * Checks whether the invoking member has the required permissions.
 * Replies with an error embed if not.
 *
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {bigint[]} permissions
 * @returns {Promise<boolean>}
 */
async function checkMemberPermissions(interaction, permissions) {
  const member = interaction.member;
  if (!member) return true;

  const missing = permissions.filter(
    (perm) => !member.permissions.has(perm),
  );
  if (missing.length === 0) return true;

  const permNames = missing.map((p) => {
    const entry = Object.entries(PermissionFlagsBits)
      .find(([, v]) => v === p);
    return entry ? entry[0] : String(p);
  });

  await interaction.reply({
    embeds: [errorEmbed('Insufficient Permissions', `You need the following permissions to use this command:\n${permNames.map((n) => `• \`${n}\``).join('\n')}`)],
    ephemeral: true,
  });
  return false;
}

module.exports = { checkBotPermissions, checkMemberPermissions };

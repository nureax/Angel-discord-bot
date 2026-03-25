'use strict';

const { EmbedBuilder } = require('discord.js');
const { config } = require('../../config');

/**
 * Creates a base embed with a consistent footer.
 */
function createBaseEmbed(color = config.colors.primary) {
  return new EmbedBuilder()
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: 'Angel Bot' });
}

/**
 * Creates a success embed.
 */
function successEmbed(title, description) {
  return createBaseEmbed(config.colors.success)
    .setTitle(`✅ ${title}`)
    .setDescription(description);
}

/**
 * Creates an error embed.
 */
function errorEmbed(title, description) {
  return createBaseEmbed(config.colors.error)
    .setTitle(`❌ ${title}`)
    .setDescription(description);
}

/**
 * Creates a warning embed.
 */
function warningEmbed(title, description) {
  return createBaseEmbed(config.colors.warning)
    .setTitle(`⚠️ ${title}`)
    .setDescription(description);
}

/**
 * Creates an info embed.
 */
function infoEmbed(title, description) {
  return createBaseEmbed(config.colors.info)
    .setTitle(`ℹ️ ${title}`)
    .setDescription(description);
}

module.exports = { createBaseEmbed, successEmbed, errorEmbed, warningEmbed, infoEmbed };

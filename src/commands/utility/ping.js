'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { createBaseEmbed, errorEmbed } = require('../../utils/embed');
const { config } = require('../../../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check the bot\'s latency and API response time'),

  async execute(interaction) {
    try {
      // Initial reply to measure round-trip latency
      const sent = await interaction.reply({ content: 'Pinging…', fetchReply: true });

      const roundTrip = sent.createdTimestamp - interaction.createdTimestamp;
      const wsHeartbeat = interaction.client.ws.ping;

      const embed = createBaseEmbed(config.colors.info)
        .setTitle('🏓 Pong!')
        .addFields(
          { name: 'Round-trip Latency', value: `${roundTrip}ms`, inline: true },
          { name: 'WebSocket Heartbeat', value: `${wsHeartbeat}ms`, inline: true },
        );

      await interaction.editReply({ content: null, embeds: [embed] });
    } catch (error) {
      const errEmbed = errorEmbed('Error', 'An unexpected error occurred. Please try again later.');
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [errEmbed] });
      } else {
        await interaction.reply({ embeds: [errEmbed], ephemeral: true });
      }
    }
  },
};

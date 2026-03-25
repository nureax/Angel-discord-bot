'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { createBaseEmbed, errorEmbed } = require('../../utils/embed');
const { config } = require('../../../config');
const logger = require('../../utils/logger');

const RESPONSES = [
  // Positive
  'It is certain.',
  'It is decidedly so.',
  'Without a doubt.',
  'Yes, definitely.',
  'You may rely on it.',
  'As I see it, yes.',
  'Most likely.',
  'Outlook good.',
  'Yes.',
  'Signs point to yes.',
  // Neutral
  'Reply hazy, try again.',
  'Ask again later.',
  'Better not tell you now.',
  'Cannot predict now.',
  'Concentrate and ask again.',
  // Negative
  "Don't count on it.",
  'My reply is no.',
  'My sources say no.',
  'Outlook not so good.',
  'Very doubtful.',
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Ask the Magic 8-Ball a question')
    .setDMPermission(false)
    .addStringOption((opt) =>
      opt
        .setName('question')
        .setDescription('The question you want to ask')
        .setRequired(true),
    ),

  async execute(interaction) {
    try {
      const question = interaction.options.getString('question');
      const answer = RESPONSES[Math.floor(Math.random() * RESPONSES.length)];

      const embed = createBaseEmbed(config.colors.primary)
        .setTitle('🎱 Magic 8-Ball')
        .addFields(
          { name: '❓ Question', value: question },
          { name: '🎱 Answer', value: answer },
        );

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error('8ball command error:', err);
      const errEmbed = errorEmbed('Error', 'An error occurred while consulting the Magic 8-Ball.');
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ embeds: [errEmbed], ephemeral: true });
      }
      return interaction.reply({ embeds: [errEmbed], ephemeral: true });
    }
  },
};

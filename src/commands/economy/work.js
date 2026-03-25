'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../../utils/embed');
const { canWork, recordWork, getTimeRemaining } = require('../../utils/workStore');
const { addToWallet } = require('../../utils/coinStore');
const logger = require('../../utils/logger');

const FLAVOR_TEXTS = [
  'You worked as a barista and served an impressive number of lattes.',
  'You drove for a rideshare app and navigated rush-hour traffic like a pro.',
  'You freelanced as a web developer and shipped a client project on time.',
  'You walked dogs in the park and made some furry new friends.',
  'You delivered packages across town and hit every deadline.',
  'You tutored a student in math and watched the lightbulb moment happen.',
  'You performed at a local open mic and earned some enthusiastic applause.',
  'You fixed someone\'s computer and became their personal tech hero.',
];

const MIN_PAYOUT = 50;
const MAX_PAYOUT = 150;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('work')
    .setDescription('Work a job to earn some coins (1-hour cooldown)')
    .setDMPermission(false),

  async execute(interaction) {
    try {
      const { guildId, user } = interaction;

      if (!canWork(guildId, user.id)) {
        const remaining = getTimeRemaining(guildId, user.id);
        const readyUnix = Math.floor((Date.now() + remaining) / 1000);

        const embed = errorEmbed(
          'Still Tired',
          `You already worked recently. You can work again <t:${readyUnix}:R>.`,
        );
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      const amount = Math.floor(Math.random() * (MAX_PAYOUT - MIN_PAYOUT + 1)) + MIN_PAYOUT;
      const flavor = FLAVOR_TEXTS[Math.floor(Math.random() * FLAVOR_TEXTS.length)];

      addToWallet(guildId, user.id, amount);
      recordWork(guildId, user.id);

      const embed = successEmbed(
        'Work Complete!',
        [
          flavor,
          '',
          `You earned **${amount.toLocaleString()} coins**!`,
        ].join('\n'),
      );

      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      logger.error('Work command error:', err);
      const embed = errorEmbed('Error', 'An error occurred while processing your work shift.');
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ embeds: [embed], ephemeral: true });
      }
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};

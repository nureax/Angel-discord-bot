'use strict';

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { config } = require('../../../config');
const { errorEmbed } = require('../../utils/embed');

const OPTION_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a poll with up to 10 options')
    .addStringOption((opt) =>
      opt.setName('question').setDescription('The poll question').setRequired(true),
    )
    .addStringOption((opt) =>
      opt.setName('options').setDescription('Comma-separated list of options (e.g. Yes, No, Maybe). Omit for a yes/no poll.').setRequired(false),
    )
    .addIntegerOption((opt) =>
      opt.setName('duration').setDescription('Poll duration in minutes (1–1440). Defaults to 60.').setMinValue(1).setMaxValue(1440).setRequired(false),
    )
    .setDMPermission(false),

  async execute(interaction) {
    try {
      const question = interaction.options.getString('question');
      const rawOptions = interaction.options.getString('options');
      const duration = interaction.options.getInteger('duration') ?? 60;

      let options;
      if (rawOptions) {
        options = rawOptions.split(',').map((o) => o.trim()).filter(Boolean);
        if (options.length < 2) {
          return interaction.reply({ content: 'Please provide at least 2 options separated by commas.', ephemeral: true });
        }
        if (options.length > 10) {
          return interaction.reply({ content: 'You can provide a maximum of 10 options.', ephemeral: true });
        }
      } else {
        options = ['Yes', 'No'];
      }

      // Check that the bot has permission to add reactions in this channel
      const me = interaction.guild?.members?.me;
      if (me && !interaction.channel.permissionsFor(me).has(PermissionFlagsBits.AddReactions)) {
        return interaction.reply({
          embeds: [errorEmbed('Missing Permission', 'I need the **Add Reactions** permission in this channel to run a poll.')],
          ephemeral: true,
        });
      }

      const endsAt = Math.floor((Date.now() + duration * 60 * 1000) / 1000);

      const description = options
        .map((opt, i) => `${OPTION_EMOJIS[i]} **${opt}**`)
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(`📊 ${question}`)
        .setDescription(description)
        .addFields(
          { name: '🕐 Ends', value: `<t:${endsAt}:R>`, inline: true },
          { name: '🗳️ Created by', value: interaction.user.toString(), inline: true },
        )
        .setTimestamp()
        .setFooter({ text: 'Angel Bot • React with the corresponding emoji to vote!' });

      const message = await interaction.reply({ embeds: [embed], fetchReply: true });

      // Add reaction buttons for voting
      for (let i = 0; i < options.length; i++) {
        await message.react(OPTION_EMOJIS[i]).catch(() => null);
      }
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

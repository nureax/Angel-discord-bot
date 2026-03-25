'use strict';

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { createBaseEmbed, errorEmbed } = require('../../utils/embed');
const { config } = require('../../../config');
const logger = require('../../utils/logger');

// Open Trivia DB category IDs
const CATEGORY_MAP = {
  general: 9,
  science: 17,
  history: 23,
  sports: 21,
  music: 12,
  gaming: 15,
};

const BUTTON_LABELS = ['A', 'B', 'C', 'D'];

/**
 * Fisher-Yates shuffle — returns a new shuffled array.
 * @param {any[]} arr
 * @returns {any[]}
 */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Builds the four answer buttons (all Primary by default).
 * @param {boolean} disabled
 * @param {string|null} correctId  customId of the correct button (used to colour after answer)
 * @param {string|null} chosenId   customId of the button the user clicked
 * @returns {ActionRowBuilder}
 */
function buildRow(disabled = false, correctId = null, chosenId = null) {
  const buttons = BUTTON_LABELS.map((label, i) => {
    const id = `trivia_${label.toLowerCase()}`;
    let style = ButtonStyle.Primary;

    if (disabled && correctId) {
      if (id === correctId) {
        style = ButtonStyle.Success;
      } else if (id === chosenId && id !== correctId) {
        style = ButtonStyle.Danger;
      } else {
        style = ButtonStyle.Secondary;
      }
    }

    return new ButtonBuilder()
      .setCustomId(id)
      .setLabel(label)
      .setStyle(style)
      .setDisabled(disabled);
  });

  return new ActionRowBuilder().addComponents(...buttons);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Answer a trivia question!')
    .addStringOption((opt) =>
      opt
        .setName('category')
        .setDescription('Question category')
        .setRequired(false)
        .addChoices(
          { name: 'General Knowledge', value: 'general' },
          { name: 'Science', value: 'science' },
          { name: 'History', value: 'history' },
          { name: 'Sports', value: 'sports' },
          { name: 'Music', value: 'music' },
          { name: 'Gaming', value: 'gaming' },
        ),
    )
    .addStringOption((opt) =>
      opt
        .setName('difficulty')
        .setDescription('Question difficulty')
        .setRequired(false)
        .addChoices(
          { name: 'Easy', value: 'easy' },
          { name: 'Medium', value: 'medium' },
          { name: 'Hard', value: 'hard' },
        ),
    )
    .setDMPermission(false),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const category = interaction.options.getString('category');
      const difficulty = interaction.options.getString('difficulty');

      // Build API URL
      let url = 'https://opentdb.com/api.php?amount=1&type=multiple&encode=url3986';
      if (category) url += `&category=${CATEGORY_MAP[category]}`;
      if (difficulty) url += `&difficulty=${difficulty}`;

      let data;
      try {
        const res = await fetch(url);
        data = await res.json();
      } catch (fetchErr) {
        logger.error('Trivia API fetch error:', fetchErr);
        return interaction.editReply({
          embeds: [errorEmbed('API Error', 'Could not reach the trivia API. Please try again later.')],
        });
      }

      if (!data || data.response_code !== 0 || !data.results?.length) {
        return interaction.editReply({
          embeds: [errorEmbed('No Question Found', 'The trivia API returned no results. Try a different category or difficulty.')],
        });
      }

      const raw = data.results[0];
      if (!raw || typeof raw.question !== 'string' || typeof raw.correct_answer !== 'string' || !Array.isArray(raw.incorrect_answers)) {
        return interaction.editReply({
          embeds: [errorEmbed('Trivia Error', 'Received an invalid response from the trivia API. Please try again.')],
        });
      }

      const question = decodeURIComponent(raw.question);
      const correctAnswer = decodeURIComponent(raw.correct_answer);
      const incorrectAnswers = raw.incorrect_answers.map(decodeURIComponent);
      const categoryName = decodeURIComponent(raw.category);
      const diff = decodeURIComponent(raw.difficulty);

      // Shuffle all 4 answers
      const answers = shuffle([correctAnswer, ...incorrectAnswers]);

      // Map label → answer
      const answerMap = {}; // { trivia_a: 'answer text', ... }
      answers.forEach((ans, i) => {
        answerMap[`trivia_${BUTTON_LABELS[i].toLowerCase()}`] = ans;
      });

      // Find which customId holds the correct answer
      const correctId = Object.keys(answerMap).find((k) => answerMap[k] === correctAnswer);

      const questionEmbed = createBaseEmbed(config.colors.primary)
        .setTitle('🧠 Trivia Time!')
        .setDescription(`**${question}**`)
        .addFields(
          { name: '📂 Category', value: categoryName, inline: true },
          { name: '⚡ Difficulty', value: diff.charAt(0).toUpperCase() + diff.slice(1), inline: true },
          {
            name: '🔤 Answers',
            value: BUTTON_LABELS.map((l, i) => `**${l}.** ${answers[i]}`).join('\n'),
          },
          { name: '⏱️ Time Limit', value: '20 seconds', inline: true },
        );

      const row = buildRow(false);
      const msg = await interaction.editReply({ embeds: [questionEmbed], components: [row] });

      // Collect single answer
      const filter = (i) =>
        i.user.id === interaction.user.id &&
        ['trivia_a', 'trivia_b', 'trivia_c', 'trivia_d'].includes(i.customId);

      let btnInteraction;
      try {
        btnInteraction = await interaction.channel.awaitMessageComponent({
          filter,
          time: 20_000,
        });
      } catch {
        // Timeout
        const timeoutEmbed = createBaseEmbed(config.colors.warning)
          .setTitle('⏰ Time\'s Up!')
          .setDescription(`You didn't answer in time!\n\n**Correct answer:** ${correctAnswer}`)
          .addFields({ name: '❓ Question', value: question });

        const disabledRow = buildRow(true, correctId, null);
        await interaction.editReply({ embeds: [timeoutEmbed], components: [disabledRow] }).catch(() => null);
        return;
      }

      const chosenId = btnInteraction.customId;
      const chosenAnswer = answerMap[chosenId];
      const isCorrect = chosenId === correctId;

      const resultEmbed = createBaseEmbed(isCorrect ? config.colors.success : config.colors.error)
        .setTitle(isCorrect ? '✅ Correct!' : '❌ Wrong!')
        .setDescription(
          isCorrect
            ? `**${chosenAnswer}** is correct! Well done!`
            : `You chose **${chosenAnswer}**.\nThe correct answer was **${correctAnswer}**.`,
        )
        .addFields(
          { name: '❓ Question', value: question },
          { name: '📂 Category', value: categoryName, inline: true },
          { name: '⚡ Difficulty', value: diff.charAt(0).toUpperCase() + diff.slice(1), inline: true },
        );

      const resultRow = buildRow(true, correctId, chosenId);

      await btnInteraction.update({ embeds: [resultEmbed], components: [resultRow] });
    } catch (err) {
      logger.error('Trivia command error:', err);
      const errEmbed = errorEmbed('Error', 'An unexpected error occurred while running the trivia game.');
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [errEmbed] }).catch(() => null);
      } else {
        await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
      }
    }
  },
};

'use strict';

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ComponentType,
} = require('discord.js');
const { config } = require('../../../config');
const { recordWin, recordLoss } = require('../../utils/gameStatsStore');
const { recordProgress } = require('../../utils/questStore');
const { addToWallet } = require('../../utils/coinStore');
const logger = require('../../utils/logger');

// In-memory store
const typeRaceStore = new Map();

// Bot WPM settings → ms per character (includes spaces)
// WPM = words/min. Average word ≈ 5 chars. Chars/min = WPM * 5. Chars/ms = WPM * 5 / 60000.
// Time for phrase = phraseLength / (WPM * 5 / 60000) = phraseLength * 60000 / (WPM * 5)
const BOT_WPM = { easy: 40, medium: 60, hard: 80 };

/** A pool of common-word phrases (5–10 words each). */
const PHRASES = [
  'the quick brown fox jumps over the lazy dog',
  'pack my box with five dozen liquor jugs',
  'how vexingly quick daft zebras jump',
  'bright stars shine on a clear night sky',
  'the cat sat on the warm sunny mat',
  'a gentle breeze blows through the tall green trees',
  'every cloud has a silver lining in the sky',
  'practice makes perfect if you keep trying hard',
  'time flies when you are having real fun',
  'the early bird catches the worm every morning',
  'never give up on your dreams and goals',
  'laughter is the best medicine for a sad heart',
  'actions speak louder than any words you say',
  'two heads are always better than just one',
  'all that glitters is not necessarily gold',
  'you only live once so make it count',
  'the pen is mightier than any sharp sword',
  'do not judge a book by its cover',
  'birds of a feather flock very well together',
  'a rolling stone gathers no moss at all',
  'slow and steady wins the race every time',
  'better late than never when you finally arrive',
  'an apple a day keeps the doctor away',
  'where there is a will there is always a way',
  'the best things in life are always free',
];

function pickPhrase() {
  return PHRASES[Math.floor(Math.random() * PHRASES.length)];
}

/** Calculate bot time in ms for a given phrase and difficulty. */
function calcBotTime(phrase, difficulty) {
  // WPM * 5 chars per word / 60 seconds → chars per second
  const charsPerSec = (BOT_WPM[difficulty] * 5) / 60;
  return Math.floor((phrase.length / charsPerSec) * 1000);
}

function buildEmbed(game, statusText = '') {
  const botTime = calcBotTime(game.phrase, game.difficulty);
  const opponentLabel = game.vsBot
    ? `Bot (${BOT_WPM[game.difficulty]} WPM — finishes in ${(botTime / 1000).toFixed(1)}s)`
    : (game.player2 ? game.player2.username : 'Waiting for opponent');

  return new EmbedBuilder()
    .setTitle('⌨️ Type Race')
    .setDescription(
      `**Difficulty:** ${game.difficulty.charAt(0).toUpperCase() + game.difficulty.slice(1)}\n` +
      `**Opponent:** ${opponentLabel}\n\n` +
      `**Type this phrase exactly (case-insensitive):**\n\`\`\`${game.phrase}\`\`\`` +
      (statusText ? `\n${statusText}` : ''),
    )
    .setColor(game.over ? config.colors.success : config.colors.primary)
    .setFooter({ text: 'Angel Bot • Type Race' })
    .setTimestamp();
}

function buildTypeButton(gameId, disabled = false) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`tr_${gameId}_submit`)
      .setLabel('⌨️ Type!')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
  )];
}

function buildRematchRow(gameId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rematch_typerace_${gameId}`)
      .setLabel('🔁 Rematch')
      .setStyle(ButtonStyle.Primary),
  );
}

/**
 * Core game logic. Called on fresh start and on rematch.
 *
 * @param {import('discord.js').ChatInputCommandInteraction | import('discord.js').MessageComponentInteraction} interaction
 * @param {import('discord.js').User} player1
 * @param {import('discord.js').User | null} opponentUser
 * @param {string} difficulty
 * @param {boolean} isRematch
 */
async function startGame(interaction, player1, opponentUser, difficulty, isRematch = false) {
  const vsBot = !opponentUser;
  const gameId = interaction.id;
  const phrase = pickPhrase();
  const botTime = calcBotTime(phrase, difficulty);

  const game = {
    id: gameId,
    vsBot,
    player1,
    player2: vsBot ? null : opponentUser,
    difficulty,
    phrase,
    over: false,
    submitted: new Set(), // track who has submitted (for PvP dupe-submit guard)
  };
  typeRaceStore.set(gameId, game);

  const startText = vsBot
    ? `Race the bot! Bot finishes in **${(botTime / 1000).toFixed(1)}s**. Click **Type!** to open the input.`
    : `First correct submission wins! Both players click **Type!** to open the input.`;

  const replyFn = isRematch
    ? (opts) => interaction.followUp({ ...opts, fetchReply: true })
    : (opts) => interaction.reply({ ...opts, fetchReply: true });

  const reply = await replyFn({
    embeds: [buildEmbed(game, startText)],
    components: buildTypeButton(gameId),
  });

  // Bot timer for solo mode
  let botTimeout = null;
  if (vsBot) {
    botTimeout = setTimeout(async () => {
      const g = typeRaceStore.get(gameId);
      if (!g || g.over) return;
      g.over = true;
      typeRaceStore.delete(gameId);
      recordLoss(interaction.guildId, g.player1.id, 'typerace');
      const rematchRow = buildRematchRow(gameId);
      await reply.edit({
        embeds: [buildEmbed(g, `🤖 **The bot finished first! Better luck next time.**`)],
        components: [...buildTypeButton(gameId, true), rematchRow],
      }).catch(() => null);
    }, botTime);
  }

  const filter = (i) => {
    const g = typeRaceStore.get(gameId);
    if (!g || g.over) return false;
    if (i.customId !== `tr_${gameId}_submit`) return false;
    if (g.vsBot) return i.user.id === g.player1.id;
    return i.user.id === g.player1.id || (g.player2 && i.user.id === g.player2.id);
  };

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter,
    time: 120000,
  });

  collector.on('collect', async (i) => {
    const g = typeRaceStore.get(gameId);
    if (!g || g.over) return;

    if (g.submitted.has(i.user.id)) {
      return i.reply({ content: "You've already submitted!", ephemeral: true });
    }

    // Show modal
    const modal = new ModalBuilder()
      .setCustomId(`tr_modal_${gameId}_${i.user.id}`)
      .setTitle('Type Race — Enter the phrase');

    const input = new TextInputBuilder()
      .setCustomId('phrase_input')
      .setLabel('Type the phrase exactly')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder(g.phrase)
      .setRequired(true)
      .setMaxLength(500);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await i.showModal(modal);

    try {
      const submission = await i.awaitModalSubmit({
        filter: (mi) => mi.customId === `tr_modal_${gameId}_${i.user.id}`,
        time: 60000,
      });

      const gNow = typeRaceStore.get(gameId);
      if (!gNow || gNow.over) {
        return submission.reply({ content: 'The race has already ended.', ephemeral: true });
      }

      const typed = submission.fields.getTextInputValue('phrase_input').trim();
      const correct = typed.toLowerCase() === gNow.phrase.toLowerCase();

      if (correct) {
        if (botTimeout) clearTimeout(botTimeout);
        gNow.over = true;
        typeRaceStore.delete(gameId);
        collector.stop('gameover');

        const coinReward = gNow.vsBot ? 50 : 150;

        recordWin(interaction.guildId, i.user.id, 'typerace');
        if (!gNow.vsBot && gNow.player2) {
          const loserId = i.user.id === gNow.player1.id ? gNow.player2.id : gNow.player1.id;
          recordLoss(interaction.guildId, loserId, 'typerace');
        }
        addToWallet(interaction.guildId, i.user.id, coinReward).catch(() => null);

        const resultText = gNow.vsBot
          ? `🎉 **${i.user.username} beat the bot! +${coinReward} 🪙**`
          : `🎉 **${i.user.username} wins the race! +${coinReward} 🪙**`;

        const rematchRow = buildRematchRow(gameId);
        await submission.reply({ content: '✅ Correct! Great typing!', ephemeral: true });
        await reply.edit({
          embeds: [buildEmbed(gNow, resultText)],
          components: [...buildTypeButton(gameId, true), rematchRow],
        }).catch(() => null);
      } else {
        gNow.submitted.add(i.user.id);
        await submission.reply({
          content: '❌ That doesn\'t match the phrase exactly. Keep trying!',
          ephemeral: true,
        });

        // PvP: if both submitted wrongly — game continues until timeout
        if (!gNow.vsBot && gNow.player2 && gNow.submitted.size >= 2) {
          gNow.over = true;
          typeRaceStore.delete(gameId);
          collector.stop('gameover');
          const rematchRow = buildRematchRow(gameId);
          await reply.edit({
            embeds: [buildEmbed(gNow, '❌ Neither player typed the phrase correctly. No winner!')],
            components: [...buildTypeButton(gameId, true), rematchRow],
          }).catch(() => null);
        }
      }
    } catch {
      // Modal timed out — do nothing, game continues
    }
  });

  collector.on('end', (_, reason) => {
    if (reason === 'gameover') return;
    if (botTimeout) clearTimeout(botTimeout);
    const g = typeRaceStore.get(gameId);
    if (g && !g.over) {
      g.over = true;
      typeRaceStore.delete(gameId);
      reply.edit({
        embeds: [buildEmbed(g, '⏱️ **Timed out! No one submitted in time.**')],
        components: buildTypeButton(gameId, true),
      }).catch(() => null);
    }
  });

  // Rematch collector (60s window after game ends)
  const rematchFilter = (i) =>
    i.customId === `rematch_typerace_${gameId}` &&
    (i.user.id === player1.id || (!vsBot && opponentUser && i.user.id === opponentUser.id));

  const rematchCollector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: rematchFilter,
    time: 360000,
    max: 1,
  });

  rematchCollector.on('collect', async (i) => {
    try {
      await i.deferUpdate();
      await startGame(
        i,
        i.user,
        vsBot ? null : (i.user.id === player1.id ? opponentUser : player1),
        difficulty,
        true,
      );
    } catch {
      // Rematch failed silently
    }
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('typerace')
    .setDescription('Race to type a phrase faster than the bot or an opponent!')
    .addUserOption((opt) =>
      opt.setName('opponent').setDescription('Challenge a user (omit to race the bot)').setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName('difficulty')
        .setDescription('Bot speed — only affects solo mode (default: medium)')
        .setRequired(false)
        .addChoices(
          { name: 'Easy (bot: 40 WPM)', value: 'easy' },
          { name: 'Medium (bot: 60 WPM)', value: 'medium' },
          { name: 'Hard (bot: 80 WPM)', value: 'hard' },
        ),
    )
    .setDMPermission(false),

  async execute(interaction) {
    const opponent = interaction.options.getUser('opponent');
    const vsBot = !opponent;
    const difficulty = interaction.options.getString('difficulty') || 'medium';

    if (!vsBot && opponent.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot race against yourself!', ephemeral: true });
    }
    if (!vsBot && opponent.bot) {
      return interaction.reply({ content: 'You cannot challenge a bot user!', ephemeral: true });
    }

    try {
      recordProgress(interaction.guildId, interaction.user.id, 'play_game');
      recordProgress(interaction.guildId, interaction.user.id, 'play_games_3');
      await startGame(interaction, interaction.user, vsBot ? null : opponent, difficulty, false);
    } catch (error) {
      logger.error(error);
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ content: 'An unexpected error occurred. Please try again later.', ephemeral: true });
      }
      return interaction.reply({ content: 'An unexpected error occurred. Please try again later.', ephemeral: true });
    }
  },
};

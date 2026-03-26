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
const scrambleStore = new Map();

const ROUND_TIME_MS = 30000;
const HINT_COIN_PENALTY = 10;

/** Word pool — common English words, varied length for fun. */
const WORD_POOL = [
  'PLANET', 'BRIDGE', 'CASTLE', 'GARDEN', 'HAMMER',
  'ISLAND', 'KITTEN', 'MAGNET', 'NEEDLE', 'ORANGE',
  'PIRATE', 'RABBIT', 'SILVER', 'TICKET', 'VALLEY',
  'ANCHOR', 'BARREL', 'CANDLE', 'DONKEY', 'FRIDGE',
  'GOBLIN', 'HELMET', 'INSECT', 'JUNGLE', 'KENNEL',
  'LEMON', 'MUFFIN', 'NAPKIN', 'OYSTER', 'PILLOW',
  'ROCKET', 'SADDLE', 'THRONE', 'WALLET', 'ZIPPER',
  'CACTUS', 'DAGGER', 'FALCON', 'GRAVEL', 'HUNTER',
  'JESTER', 'KNIGHT', 'LANTERN', 'MORTAR', 'NOODLE',
  'PARROT', 'QUIVER', 'RIDDLE', 'SPIDER', 'TOMATO',
  'UTMOST', 'VENDOR', 'WOMBAT', 'YOGURT', 'ZIPPER',
  'BAMBOO', 'COBALT', 'DYNAMO', 'ESKIMO', 'FENNEL',
  'GIBBON', 'HOBBIT', 'IGUANA', 'JOCKEY', 'KIMONO',
  'LLAMA', 'MANGO', 'NINJA', 'OTTER', 'PANDA',
  'QUARTZ', 'RAVEN', 'SQUID', 'TAPIR', 'UMBRA',
];

/** Shuffle a string's characters. */
function shuffleWord(word) {
  const arr = word.split('');
  // Keep shuffling until scrambled version differs from original (avoids trivial puzzles)
  let attempts = 0;
  do {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    attempts++;
  } while (arr.join('') === word && attempts < 20);
  return arr.join('');
}

/** Build a hint: reveal one random unrevealed letter. */
function buildHint(word, revealedIndices) {
  const unrevealed = [];
  for (let i = 0; i < word.length; i++) {
    if (!revealedIndices.has(i)) unrevealed.push(i);
  }
  if (unrevealed.length === 0) return null;
  const idx = unrevealed[Math.floor(Math.random() * unrevealed.length)];
  revealedIndices.add(idx);
  return idx;
}

/** Build the hint display string: revealed letters shown, others as '_'. */
function buildHintDisplay(word, revealedIndices) {
  return word.split('').map((ch, i) => (revealedIndices.has(i) ? ch : '_')).join(' ');
}

function buildEmbed(game, statusText = '') {
  const modeLabel = game.vsBot ? 'Solo' : (game.player2 ? `vs ${game.player2.username}` : 'PvP');
  const hintDisplay = game.revealedIndices.size > 0
    ? `\n**Hint:** \`${buildHintDisplay(game.word, game.revealedIndices)}\``
    : '';

  return new EmbedBuilder()
    .setTitle('🔤 Word Scramble')
    .setDescription(
      `**Mode:** ${modeLabel}\n` +
      `**Scrambled word:** \`${game.scrambled}\`\n` +
      `**Letters:** ${game.word.length}${hintDisplay}\n` +
      `**Time limit:** ${ROUND_TIME_MS / 1000}s\n` +
      (statusText ? `\n${statusText}` : ''),
    )
    .setColor(
      game.over
        ? (game.won ? config.colors.success : config.colors.error)
        : config.colors.primary,
    )
    .setFooter({ text: 'Angel Bot • Word Scramble' })
    .setTimestamp();
}

function buildButtons(gameId, gameOver = false, hintUsed = false) {
  const row = new ActionRowBuilder();
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`scr_${gameId}_guess`)
      .setLabel('💬 Guess!')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(gameOver),
  );
  // Solo only: hint button (PvP disabling is handled at collect time)
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`scr_${gameId}_hint`)
      .setLabel(`💡 Hint (-${HINT_COIN_PENALTY} coins)`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(gameOver || hintUsed),
  );
  return [row];
}

function buildRematchRow(gameId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rematch_scramble_${gameId}`)
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
 * @param {boolean} isRematch
 */
async function startGame(interaction, player1, opponentUser, isRematch = false) {
  const vsBot = !opponentUser;
  const gameId = interaction.id;
  const word = WORD_POOL[Math.floor(Math.random() * WORD_POOL.length)];
  const scrambled = shuffleWord(word);

  const game = {
    id: gameId,
    vsBot,
    player1,
    player2: vsBot ? null : opponentUser,
    word,
    scrambled,
    over: false,
    won: false,
    revealedIndices: new Set(),
    hintPenalty: 0,   // accumulated coin penalty from hints (solo only)
    submitted: new Set(), // PvP dupe-submit guard
  };
  scrambleStore.set(gameId, game);

  const startText = vsBot
    ? `You have **${ROUND_TIME_MS / 1000}s** to unscramble the word! Use 💡 Hint for a letter clue (costs ${HINT_COIN_PENALTY} coins).`
    : `First correct answer wins! You have **${ROUND_TIME_MS / 1000}s**.`;

  const replyFn = isRematch
    ? (opts) => interaction.followUp({ ...opts, fetchReply: true })
    : (opts) => interaction.reply({ ...opts, fetchReply: true });

  const reply = await replyFn({
    embeds: [buildEmbed(game, startText)],
    components: buildButtons(gameId),
  });

  // Round timer
  const roundTimeout = setTimeout(async () => {
    const g = scrambleStore.get(gameId);
    if (!g || g.over) return;
    g.over = true;
    scrambleStore.delete(gameId);
    collector.stop('timeout');
    recordLoss(interaction.guildId, g.player1.id, 'scramble');
    if (!g.vsBot && g.player2) recordLoss(interaction.guildId, g.player2.id, 'scramble');
    await reply.edit({
      embeds: [buildEmbed(g, `⏱️ **Time's up! The word was \`${g.word}\`.**`)],
      components: [buildRematchRow(gameId)],
    }).catch(() => null);
  }, ROUND_TIME_MS);

  const filter = (i) => {
    const g = scrambleStore.get(gameId);
    if (!g || g.over) return false;
    if (!i.customId.startsWith(`scr_${gameId}_`)) return false;
    if (g.vsBot) return i.user.id === g.player1.id;
    return i.user.id === g.player1.id || (g.player2 && i.user.id === g.player2.id);
  };

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter,
    time: ROUND_TIME_MS + 5000, // slight buffer
  });

  collector.on('collect', async (i) => {
    const g = scrambleStore.get(gameId);
    if (!g || g.over) return;

    // ── Hint button (solo only) ──────────────────────────────────────────────
    if (i.customId === `scr_${gameId}_hint`) {
      if (!g.vsBot) {
        return i.reply({ content: 'Hints are only available in solo mode.', ephemeral: true });
      }
      const hintIdx = buildHint(g.word, g.revealedIndices);
      if (hintIdx === null) {
        return i.reply({ content: 'No more hints available!', ephemeral: true });
      }
      g.hintPenalty += HINT_COIN_PENALTY;
      const allRevealed = g.revealedIndices.size >= g.word.length - 1;
      return i.update({
        embeds: [buildEmbed(g, `💡 Hint revealed! (-${HINT_COIN_PENALTY} coins penalty)`)],
        components: buildButtons(gameId, false, allRevealed),
      });
    }

    // ── Guess button ─────────────────────────────────────────────────────────
    if (i.customId === `scr_${gameId}_guess`) {
      if (g.submitted.has(i.user.id)) {
        return i.reply({ content: "You've already submitted a guess!", ephemeral: true });
      }

      const modal = new ModalBuilder()
        .setCustomId(`scr_modal_${gameId}_${i.user.id}`)
        .setTitle('Word Scramble — Enter your answer');

      const input = new TextInputBuilder()
        .setCustomId('guess_input')
        .setLabel('Unscramble the word')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Type the word...')
        .setRequired(true)
        .setMaxLength(50);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await i.showModal(modal);

      try {
        const submission = await i.awaitModalSubmit({
          filter: (mi) => mi.customId === `scr_modal_${gameId}_${i.user.id}`,
          time: 60000,
        });

        const gNow = scrambleStore.get(gameId);
        if (!gNow || gNow.over) {
          return submission.reply({ content: 'The round has already ended.', ephemeral: true });
        }

        const guess = submission.fields.getTextInputValue('guess_input').trim().toUpperCase();
        const correct = guess === gNow.word;

        if (correct) {
          clearTimeout(roundTimeout);
          gNow.over = true;
          gNow.won = true;
          scrambleStore.delete(gameId);
          collector.stop('gameover');

          let coinReward = gNow.vsBot ? 30 : 75;
          if (gNow.vsBot) coinReward = Math.max(0, coinReward - gNow.hintPenalty);

          recordWin(interaction.guildId, i.user.id, 'scramble');
          if (!gNow.vsBot && gNow.player2) {
            const loserId = i.user.id === gNow.player1.id ? gNow.player2.id : gNow.player1.id;
            recordLoss(interaction.guildId, loserId, 'scramble');
          }
          recordProgress(interaction.guildId, i.user.id, 'win_game');
          addToWallet(interaction.guildId, i.user.id, coinReward).catch(() => null);

          const penaltyNote = gNow.vsBot && gNow.hintPenalty > 0
            ? ` (-${gNow.hintPenalty} hint penalty)`
            : '';
          const resultText = gNow.vsBot
            ? `🎉 **Correct! The word was \`${gNow.word}\`. +${coinReward} 🪙**${penaltyNote}`
            : `🎉 **${i.user.username} got it first! The word was \`${gNow.word}\`. +${coinReward} 🪙**`;

          const rematchRow = buildRematchRow(gameId);
          await submission.reply({ content: `✅ Correct! The word was **${gNow.word}**.`, ephemeral: true });
          await reply.edit({
            embeds: [buildEmbed(gNow, resultText)],
            components: [rematchRow],
          }).catch(() => null);
        } else {
          gNow.submitted.add(i.user.id);
          await submission.reply({
            content: `❌ \`${guess}\` is not correct. Keep trying!`,
            ephemeral: true,
          });

          // PvP: both wrong — game continues until timer
          if (!gNow.vsBot && gNow.player2 && gNow.submitted.size >= 2) {
            clearTimeout(roundTimeout);
            gNow.over = true;
            scrambleStore.delete(gameId);
            collector.stop('gameover');
            recordLoss(interaction.guildId, gNow.player1.id, 'scramble');
            recordLoss(interaction.guildId, gNow.player2.id, 'scramble');
            const rematchRow = buildRematchRow(gameId);
            await reply.edit({
              embeds: [buildEmbed(gNow, `❌ **Neither player got it! The word was \`${gNow.word}\`.**`)],
              components: [rematchRow],
            }).catch(() => null);
          }
        }
      } catch {
        // Modal timed out — do nothing, round timer still runs
      }
    }
  });

  collector.on('end', (_, reason) => {
    if (reason === 'gameover' || reason === 'timeout') return;
    clearTimeout(roundTimeout);
    const g = scrambleStore.get(gameId);
    if (g && !g.over) {
      g.over = true;
      scrambleStore.delete(gameId);
      reply.edit({
        embeds: [buildEmbed(g, `⏱️ **Timed out! The word was \`${g.word}\`.**`)],
        components: [buildRematchRow(gameId)],
      }).catch(() => null);
      recordLoss(interaction.guildId, g.player1.id, 'scramble');
      if (!g.vsBot && g.player2) recordLoss(interaction.guildId, g.player2.id, 'scramble');
    }
  });

  // Rematch collector
  const rematchFilter = (i) =>
    i.customId === `rematch_scramble_${gameId}` &&
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
        true,
      );
    } catch {
      // Rematch failed silently
    }
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scramble')
    .setDescription('Unscramble the word before time runs out! Solo or PvP.')
    .addUserOption((opt) =>
      opt.setName('opponent').setDescription('Challenge a user (omit to play solo)').setRequired(false),
    )
    .setDMPermission(false),

  async execute(interaction) {
    const opponent = interaction.options.getUser('opponent');
    const vsBot = !opponent;

    if (!vsBot && opponent.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot play against yourself!', ephemeral: true });
    }
    if (!vsBot && opponent.bot) {
      return interaction.reply({ content: 'You cannot challenge a bot user!', ephemeral: true });
    }

    try {
      recordProgress(interaction.guildId, interaction.user.id, 'play_game');
      recordProgress(interaction.guildId, interaction.user.id, 'play_games_3');
      await startGame(interaction, interaction.user, vsBot ? null : opponent, false);
    } catch (error) {
      logger.error(error);
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ content: 'An unexpected error occurred. Please try again later.', ephemeral: true });
      }
      return interaction.reply({ content: 'An unexpected error occurred. Please try again later.', ephemeral: true });
    }
  },
};

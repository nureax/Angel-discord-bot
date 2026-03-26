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
const { addToWallet, getBalance } = require('../../utils/coinStore');
const { logger } = require('../../utils/logger');

// In-memory store
const fastMathStore = new Map();

const BOT_TIMES = { easy: 10000, medium: 5000, hard: 2000 };

function generateProblem(difficulty) {
  let a, b, op;
  if (difficulty === 'easy') {
    a = 1 + Math.floor(Math.random() * 9);
    b = 1 + Math.floor(Math.random() * 9);
    op = ['+', '-', '*'][Math.floor(Math.random() * 3)];
  } else if (difficulty === 'medium') {
    a = 10 + Math.floor(Math.random() * 90);
    b = 10 + Math.floor(Math.random() * 90);
    op = ['+', '-', '*'][Math.floor(Math.random() * 3)];
  } else {
    a = 100 + Math.floor(Math.random() * 900);
    b = 2 + Math.floor(Math.random() * 18);
    op = ['+', '-', '*', '/'][Math.floor(Math.random() * 4)];
    if (op === '/') {
      // Ensure clean division
      b = 2 + Math.floor(Math.random() * 9);
      a = b * (1 + Math.floor(Math.random() * 99));
    }
  }

  let answer;
  let display;
  if (op === '+') { answer = a + b; display = `${a} + ${b}`; }
  else if (op === '-') { answer = a - b; display = `${a} − ${b}`; }
  else if (op === '*') { answer = a * b; display = `${a} × ${b}`; }
  else { answer = a / b; display = `${a} ÷ ${b}`; }

  return { display, answer };
}

function buildEmbed(game, statusText = '') {
  const botTimeLabel = game.vsBot ? `Bot answers in ${BOT_TIMES[game.difficulty] / 1000}s` : '';
  return new EmbedBuilder()
    .setTitle('⚡ Fast Math')
    .setDescription(
      `**Difficulty:** ${game.difficulty}\n` +
      (game.vsBot ? `**Opponent:** Bot (${botTimeLabel})\n` : `**Opponent:** ${game.player2 ? game.player2.username : 'Bot'}\n`) +
      `\n**Problem:** \`${game.problem.display} = ?\`\n` +
      (statusText ? `\n${statusText}` : ''),
    )
    .setColor(game.over ? config.colors.success : config.colors.primary)
    .setFooter({ text: 'Angel Bot • Fast Math' })
    .setTimestamp();
}

function buildButton(gameId, disabled = false) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`fm_${gameId}_answer`)
      .setLabel('✏️ Answer')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
  )];
}

function buildRematchRow(gameId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rematch_fastmath_${gameId}`)
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
async function startGame(interaction, player1, opponentUser, difficulty, isRematch = false, wager = 0) {
  const vsBot = !opponentUser;
  const gameId = interaction.id;
  const problem = generateProblem(difficulty);

  const game = {
    id: gameId,
    vsBot,
    player1,
    player2: vsBot ? null : opponentUser,
    difficulty,
    problem,
    over: false,
    answered: new Set(), // track who answered (for PvP)
    wager,
  };
  fastMathStore.set(gameId, game);

  const wagerText = (!vsBot && wager > 0) ? `\n⚔️ Wager: **${wager}** coins` : '';
  const startText = vsBot
    ? `Answer before the bot does! Bot answers in **${BOT_TIMES[difficulty] / 1000}s**. Click **Answer** to submit!`
    : `First correct answer wins! Both players click **Answer** to submit.${wagerText}`;

  const replyFn = isRematch
    ? (opts) => interaction.followUp({ ...opts, fetchReply: true })
    : (opts) => interaction.reply({ ...opts, fetchReply: true });

  const reply = await replyFn({
    embeds: [buildEmbed(game, startText)],
    components: buildButton(gameId),
  });

  // Bot timer for solo mode
  let botTimeout = null;
  if (vsBot) {
    botTimeout = setTimeout(async () => {
      const g = fastMathStore.get(gameId);
      if (!g || g.over) return;
      g.over = true;
      fastMathStore.delete(gameId);
      recordLoss(interaction.guildId, g.player1.id, 'fastmath');
      const rematchRow = buildRematchRow(gameId);
      await reply.edit({
        embeds: [buildEmbed(g, `🤖 **Bot answered first!** The answer was \`${g.problem.answer}\`. Better luck next time!`)],
        components: [...buildButton(gameId, true), rematchRow],
      }).catch(() => null);
    }, BOT_TIMES[difficulty]);
  }

  const filter = (i) => {
    const g = fastMathStore.get(gameId);
    if (!g || g.over) return false;
    if (!i.customId.startsWith(`fm_${gameId}_`)) return false;
    if (g.vsBot) return i.user.id === g.player1.id;
    return i.user.id === g.player1.id || (g.player2 && i.user.id === g.player2.id);
  };

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter,
    time: 120000,
  });

  collector.on('collect', async (i) => {
    const g = fastMathStore.get(gameId);
    if (!g || g.over) return;

    if (g.answered.has(i.user.id)) {
      return i.reply({ content: "You've already submitted an answer!", ephemeral: true });
    }

    // Show modal
    const modal = new ModalBuilder()
      .setCustomId(`fm_modal_${gameId}_${i.user.id}`)
      .setTitle('Fast Math — Enter Your Answer');

    const input = new TextInputBuilder()
      .setCustomId('answer_input')
      .setLabel(`What is ${g.problem.display}?`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter a number...')
      .setRequired(true)
      .setMaxLength(20);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await i.showModal(modal);

    try {
      const submission = await i.awaitModalSubmit({
        filter: (mi) => mi.customId === `fm_modal_${gameId}_${i.user.id}`,
        time: 60000,
      });

      const gNow = fastMathStore.get(gameId);
      if (!gNow || gNow.over) {
        return submission.reply({ content: 'The game has already ended.', ephemeral: true });
      }

      const raw = submission.fields.getTextInputValue('answer_input').trim();
      const parsed = parseFloat(raw);
      const correct = !isNaN(parsed) && Math.abs(parsed - gNow.problem.answer) < 0.01;

      if (correct) {
        if (botTimeout) clearTimeout(botTimeout);
        gNow.over = true;
        fastMathStore.delete(gameId);
        collector.stop('gameover');

        let fmCoinReward;
        if (gNow.vsBot) {
          fmCoinReward = 50;
        } else if (gNow.wager > 0) {
          const pot = gNow.wager * 2;
          fmCoinReward = pot - Math.floor(pot * 0.05);
        } else {
          fmCoinReward = 150;
        }
        if (gNow.vsBot) {
          recordWin(interaction.guildId, i.user.id, 'fastmath');
        } else {
          recordWin(interaction.guildId, i.user.id, 'fastmath');
          const loserId = i.user.id === gNow.player1.id ? gNow.player2.id : gNow.player1.id;
          recordLoss(interaction.guildId, loserId, 'fastmath');
        }
        addToWallet(interaction.guildId, i.user.id, fmCoinReward).catch(() => null);

        const resultText = gNow.vsBot
          ? `🎉 **${i.user.username} answered correctly first!** The answer was \`${gNow.problem.answer}\`. **+${fmCoinReward} 🪙**`
          : `🎉 **${i.user.username} wins!** The answer was \`${gNow.problem.answer}\`. **+${fmCoinReward} 🪙**`;

        const rematchRow = buildRematchRow(gameId);
        await submission.reply({ content: `✅ Correct! **${parsed}**`, ephemeral: true });
        await reply.edit({
          embeds: [buildEmbed(gNow, resultText)],
          components: [...buildButton(gameId, true), rematchRow],
        }).catch(() => null);
      } else {
        gNow.answered.add(i.user.id);
        await submission.reply({ content: `❌ Wrong answer! You submitted \`${raw}\`.`, ephemeral: true });

        // In PvP, if both wrong — game continues until timeout
        if (!gNow.vsBot && gNow.player2 && gNow.answered.size >= 2) {
          gNow.over = true;
          fastMathStore.delete(gameId);
          collector.stop('gameover');
          if (gNow.wager > 0) {
            addToWallet(interaction.guildId, gNow.player1.id, gNow.wager).catch(() => null);
            addToWallet(interaction.guildId, gNow.player2.id, gNow.wager).catch(() => null);
          }
          const rematchRow = buildRematchRow(gameId);
          await reply.edit({
            embeds: [buildEmbed(gNow, `❌ Both players got it wrong! The answer was \`${gNow.problem.answer}\`.`)],
            components: [...buildButton(gameId, true), rematchRow],
          }).catch(() => null);
        }
      }
    } catch {
      // Modal timed out — do nothing
    }
  });

  collector.on('end', (_, reason) => {
    if (reason === 'gameover') return;
    if (botTimeout) clearTimeout(botTimeout);
    const g = fastMathStore.get(gameId);
    if (g && !g.over) {
      g.over = true;
      fastMathStore.delete(gameId);
      if (g.wager > 0 && !g.vsBot && g.player2) {
        addToWallet(interaction.guildId, g.player1.id, g.wager).catch(() => null);
        addToWallet(interaction.guildId, g.player2.id, g.wager).catch(() => null);
      }
      reply.edit({
        embeds: [buildEmbed(g, `⏱️ **Timed out!** The answer was \`${g.problem.answer}\`.`)],
        components: buildButton(gameId, true),
      }).catch(() => null);
    }
  });

  // Rematch collector (60s window after game ends)
  const rematchFilter = (i) =>
    i.customId === `rematch_fastmath_${gameId}` &&
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
      await startGame(i, i.user, vsBot ? null : (i.user.id === player1.id ? opponentUser : player1), difficulty, true);
    } catch {
      // Rematch failed silently
    }
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fastmath')
    .setDescription('Solve math problems faster than the bot or your opponent!')
    .addUserOption((opt) =>
      opt.setName('opponent').setDescription('Challenge a user (omit to play vs bot)').setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName('difficulty')
        .setDescription('Problem difficulty (default: medium)')
        .setRequired(false)
        .addChoices(
          { name: 'Easy (single digit)', value: 'easy' },
          { name: 'Medium (double digit)', value: 'medium' },
          { name: 'Hard (triple digit + division)', value: 'hard' },
        ),
    )
    .addIntegerOption((opt) =>
      opt
        .setName('wager')
        .setDescription('Coins to wager (PvP only)')
        .setMinValue(10)
        .setMaxValue(5000)
        .setRequired(false),
    )
    .setDMPermission(false),

  async execute(interaction) {
    const opponent = interaction.options.getUser('opponent');
    const vsBot = !opponent;
    const difficulty = interaction.options.getString('difficulty') || 'medium';
    const wager = interaction.options.getInteger('wager') ?? 0;

    if (!vsBot && opponent.id === interaction.user.id) {
      return interaction.reply({ content: 'You cannot play against yourself!', ephemeral: true });
    }
    if (!vsBot && opponent.bot) {
      return interaction.reply({ content: 'You cannot challenge a bot user!', ephemeral: true });
    }
    if (wager > 0 && vsBot) {
      return interaction.reply({ content: 'Wagering is only available in PvP mode.', ephemeral: true });
    }
    if (wager > 0) {
      const guildId = interaction.guildId;
      const challengerBal = getBalance(guildId, interaction.user.id);
      if (challengerBal.wallet < wager) {
        return interaction.reply({ content: `You don't have enough coins to wager **${wager}** coins.`, ephemeral: true });
      }
      const opponentBal = getBalance(guildId, opponent.id);
      if (opponentBal.wallet < wager) {
        return interaction.reply({ content: `${opponent} doesn't have enough coins to match that wager.`, ephemeral: true });
      }
      addToWallet(guildId, interaction.user.id, -wager);
      addToWallet(guildId, opponent.id, -wager);
    }

    try {
      recordProgress(interaction.guildId, interaction.user.id, 'play_game');
      recordProgress(interaction.guildId, interaction.user.id, 'play_games_3');
      await startGame(interaction, interaction.user, vsBot ? null : opponent, difficulty, false, wager);
    } catch (error) {
      logger.error(error);
      if (wager > 0 && !vsBot && opponent) {
        addToWallet(interaction.guildId, interaction.user.id, wager);
        addToWallet(interaction.guildId, opponent.id, wager);
      }
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ content: 'An unexpected error occurred. Please try again later.', ephemeral: true });
      }
      return interaction.reply({ content: 'An unexpected error occurred. Please try again later.', ephemeral: true });
    }
  },
};

'use strict';

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const { config } = require('../../../config');
const { recordWin, recordLoss } = require('../../utils/gameStatsStore');
const { recordProgress } = require('../../utils/questStore');
const { addToWallet } = require('../../utils/coinStore');
const logger = require('../../utils/logger');

// In-memory store
const minesweeperStore = new Map();

const MINE_COUNTS = { easy: 4, medium: 6, hard: 9 };
const GRID_SIZE = 5;

/** Generate a fresh 5×5 board with mines placed, excluding a safe cell. */
function generateBoard(mineCount, safeRow, safeCol) {
  const board = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({ mine: false, revealed: false, adjacent: 0 })),
  );

  // Place mines avoiding the safe cell and its immediate neighbours
  const forbidden = new Set();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = safeRow + dr;
      const c = safeCol + dc;
      if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
        forbidden.add(r * GRID_SIZE + c);
      }
    }
  }

  const candidates = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!forbidden.has(r * GRID_SIZE + c)) candidates.push([r, c]);
    }
  }

  // Fisher-Yates partial shuffle to pick mineCount mines
  for (let i = 0; i < mineCount; i++) {
    const j = i + Math.floor(Math.random() * (candidates.length - i));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    const [mr, mc] = candidates[i];
    board[mr][mc].mine = true;
  }

  // Calculate adjacent counts
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c].mine) continue;
      let count = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && board[nr][nc].mine) {
            count++;
          }
        }
      }
      board[r][c].adjacent = count;
    }
  }

  return board;
}

/** Flood-fill reveal all connected empty cells from (row, col). */
function floodReveal(board, row, col, visited = new Set()) {
  const key = row * GRID_SIZE + col;
  if (visited.has(key)) return;
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return;
  const cell = board[row][col];
  if (cell.mine || cell.revealed) return;
  visited.add(key);
  cell.revealed = true;
  if (cell.adjacent === 0) {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        floodReveal(board, row + dr, col + dc, visited);
      }
    }
  }
}

/** Count revealed non-mine cells. */
function countRevealed(board) {
  let count = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (!board[r][c].mine && board[r][c].revealed) count++;
    }
  }
  return count;
}

const ADJACENT_LABELS = ['', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'];

/** Build the 5×5 button grid (up to 5 ActionRows of 5 buttons each). */
function buildGrid(gameId, board, gameOver = false) {
  const rows = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = board[r][c];
      const btn = new ButtonBuilder()
        .setCustomId(`ms_${gameId}_${r}_${c}`)
        .setDisabled(gameOver || cell.revealed);

      if (!cell.revealed) {
        btn.setLabel('◻️').setStyle(ButtonStyle.Secondary);
      } else if (cell.mine) {
        btn.setLabel('💣').setStyle(ButtonStyle.Danger);
      } else if (cell.adjacent === 0) {
        btn.setLabel('　').setStyle(ButtonStyle.Success);
      } else {
        btn.setLabel(ADJACENT_LABELS[cell.adjacent] || String(cell.adjacent)).setStyle(ButtonStyle.Primary);
      }
      row.addComponents(btn);
    }
    rows.push(row);
  }
  return rows;
}

function buildRematchRow(gameId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rematch_minesweeper_${gameId}`)
      .setLabel('🔁 Rematch')
      .setStyle(ButtonStyle.Primary),
  );
}

function buildEmbed(game, statusText = '') {
  const totalSafe = GRID_SIZE * GRID_SIZE - MINE_COUNTS[game.difficulty];
  const revealed = countRevealed(game.board);

  return new EmbedBuilder()
    .setTitle('💣 Minesweeper')
    .setDescription(
      `**Difficulty:** ${game.difficulty.charAt(0).toUpperCase() + game.difficulty.slice(1)} ` +
      `(${MINE_COUNTS[game.difficulty]} mines)\n` +
      `**Revealed:** ${revealed} / ${totalSafe} safe cells\n` +
      (statusText ? `\n${statusText}` : ''),
    )
    .setColor(
      game.over
        ? (game.won ? config.colors.success : config.colors.error)
        : config.colors.primary,
    )
    .setFooter({ text: 'Angel Bot • Minesweeper' })
    .setTimestamp();
}

/** Reveal entire board (mines + all safe cells) for game-over display. */
function revealAll(board) {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      board[r][c].revealed = true;
    }
  }
}

/**
 * Core game logic. Called on fresh start and on rematch.
 *
 * @param {import('discord.js').ChatInputCommandInteraction | import('discord.js').MessageComponentInteraction} interaction
 * @param {import('discord.js').User} player
 * @param {string} difficulty
 * @param {boolean} isRematch
 */
async function startGame(interaction, player, difficulty, isRematch = false) {
  const gameId = interaction.id;

  // Board is null until first click (first-click-safe guarantee)
  const game = {
    id: gameId,
    player,
    difficulty,
    board: null,   // generated on first click
    over: false,
    won: false,
    firstClick: true,
  };
  minesweeperStore.set(gameId, game);

  // Initial grid: all unrevealed, board not yet generated
  const placeholderBoard = Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({ mine: false, revealed: false, adjacent: 0 })),
  );
  game.board = placeholderBoard;

  const replyFn = isRematch
    ? (opts) => interaction.followUp({ ...opts, fetchReply: true })
    : (opts) => interaction.reply({ ...opts, fetchReply: true });

  const reply = await replyFn({
    embeds: [buildEmbed(game, 'Click any cell to start! Your first click is always safe.')],
    components: buildGrid(gameId, placeholderBoard),
  });

  const filter = (i) =>
    i.user.id === player.id && i.customId.startsWith(`ms_${gameId}_`);

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter,
    time: 300000,
  });

  collector.on('collect', async (i) => {
    const g = minesweeperStore.get(gameId);
    if (!g || g.over) return;

    const parts = i.customId.split('_');
    // customId: ms_{gameId}_{row}_{col} — row at index 2, col at index 3
    const row = parseInt(parts[2], 10);
    const col = parseInt(parts[3], 10);

    // First-click-safe: regenerate board with this cell guaranteed safe
    if (g.firstClick) {
      g.firstClick = false;
      g.board = generateBoard(MINE_COUNTS[g.difficulty], row, col);
    }

    const cell = g.board[row][col];
    if (cell.revealed) {
      return i.deferUpdate().catch(() => null);
    }

    // Hit a mine
    if (cell.mine) {
      cell.revealed = true;
      g.over = true;
      g.won = false;
      revealAll(g.board);
      minesweeperStore.delete(gameId);
      collector.stop('gameover');
      recordLoss(interaction.guildId, g.player.id, 'minesweeper');
      const rematchRow = buildRematchRow(gameId);
      return i.update({
        embeds: [buildEmbed(g, '💥 **BOOM! You hit a mine! Game over.**')],
        components: [...buildGrid(gameId, g.board, true), rematchRow],
      });
    }

    // Safe cell — flood-fill reveal
    floodReveal(g.board, row, col);

    const totalSafe = GRID_SIZE * GRID_SIZE - MINE_COUNTS[g.difficulty];
    const revealed = countRevealed(g.board);

    if (revealed >= totalSafe) {
      // Win!
      g.over = true;
      g.won = true;
      revealAll(g.board);
      minesweeperStore.delete(gameId);
      collector.stop('gameover');
      recordWin(interaction.guildId, g.player.id, 'minesweeper');
      recordProgress(interaction.guildId, g.player.id, 'win_game');
      addToWallet(interaction.guildId, g.player.id, 50).catch(() => null);
      const rematchRow = buildRematchRow(gameId);
      return i.update({
        embeds: [buildEmbed(g, '🎉 **You cleared the board! +50 🪙**')],
        components: [...buildGrid(gameId, g.board, true), rematchRow],
      });
    }

    return i.update({
      embeds: [buildEmbed(g)],
      components: buildGrid(gameId, g.board),
    });
  });

  collector.on('end', (_, reason) => {
    if (reason === 'gameover') return;
    const g = minesweeperStore.get(gameId);
    if (g && !g.over) {
      g.over = true;
      revealAll(g.board);
      minesweeperStore.delete(gameId);
      reply.edit({
        embeds: [buildEmbed(g, '⏱️ **Timed out!**')],
        components: buildGrid(gameId, g.board, true),
      }).catch(() => null);
    }
  });

  // Rematch collector
  const rematchFilter = (i) =>
    i.customId === `rematch_minesweeper_${gameId}` && i.user.id === player.id;

  const rematchCollector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: rematchFilter,
    time: 360000,
    max: 1,
  });

  rematchCollector.on('collect', async (i) => {
    try {
      await i.deferUpdate();
      await startGame(i, i.user, difficulty, true);
    } catch {
      // Rematch failed silently
    }
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('minesweeper')
    .setDescription('Play Minesweeper! Reveal all safe cells without hitting a mine.')
    .addStringOption((opt) =>
      opt
        .setName('difficulty')
        .setDescription('Mine density (default: medium)')
        .setRequired(false)
        .addChoices(
          { name: 'Easy (4 mines)', value: 'easy' },
          { name: 'Medium (6 mines)', value: 'medium' },
          { name: 'Hard (9 mines)', value: 'hard' },
        ),
    )
    .setDMPermission(false),

  async execute(interaction) {
    const difficulty = interaction.options.getString('difficulty') || 'medium';

    try {
      recordProgress(interaction.guildId, interaction.user.id, 'play_game');
      recordProgress(interaction.guildId, interaction.user.id, 'play_games_3');
      await startGame(interaction, interaction.user, difficulty, false);
    } catch (error) {
      logger.error(error);
      if (interaction.replied || interaction.deferred) {
        return interaction.followUp({ content: 'An unexpected error occurred. Please try again later.', ephemeral: true });
      }
      return interaction.reply({ content: 'An unexpected error occurred. Please try again later.', ephemeral: true });
    }
  },
};

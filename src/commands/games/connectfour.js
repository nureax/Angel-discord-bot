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

// In-memory store
const c4Store = new Map();

const ROWS = 6;
const COLS = 7;
const EMPTY = 0;
const P1 = 1;  // Red 🔴
const P2 = 2;  // Yellow 🟡

const CELL_EMOJI = { [EMPTY]: '⚪', [P1]: '🔴', [P2]: '🟡' };

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
}

function dropPiece(board, col, piece) {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (board[row][col] === EMPTY) {
      board[row][col] = piece;
      return row;
    }
  }
  return -1; // column full
}

function isValidCol(board, col) {
  return board[0][col] === EMPTY;
}

function checkWin(board, piece) {
  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (board[r][c] === piece && board[r][c+1] === piece && board[r][c+2] === piece && board[r][c+3] === piece) return true;
    }
  }
  // Vertical
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] === piece && board[r+1][c] === piece && board[r+2][c] === piece && board[r+3][c] === piece) return true;
    }
  }
  // Diagonal /
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (board[r][c] === piece && board[r-1][c+1] === piece && board[r-2][c+2] === piece && board[r-3][c+3] === piece) return true;
    }
  }
  // Diagonal \
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      if (board[r][c] === piece && board[r+1][c+1] === piece && board[r+2][c+2] === piece && board[r+3][c+3] === piece) return true;
    }
  }
  return false;
}

function isBoardFull(board) {
  return board[0].every((c) => c !== EMPTY);
}

// Minimax with Alpha-Beta pruning
function scoreWindow(window, piece) {
  const opp = piece === P1 ? P2 : P1;
  let score = 0;
  const pieceCount = window.filter((c) => c === piece).length;
  const emptyCount = window.filter((c) => c === EMPTY).length;
  const oppCount = window.filter((c) => c === opp).length;

  if (pieceCount === 4) score += 100;
  else if (pieceCount === 3 && emptyCount === 1) score += 5;
  else if (pieceCount === 2 && emptyCount === 2) score += 2;
  if (oppCount === 3 && emptyCount === 1) score -= 4;

  return score;
}

function scoreBoard(board, piece) {
  let score = 0;
  // Center preference
  const centerCol = board.map((r) => r[Math.floor(COLS / 2)]);
  score += centerCol.filter((c) => c === piece).length * 3;

  // Horizontal
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      score += scoreWindow([board[r][c], board[r][c+1], board[r][c+2], board[r][c+3]], piece);
    }
  }
  // Vertical
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c < COLS; c++) {
      score += scoreWindow([board[r][c], board[r+1][c], board[r+2][c], board[r+3][c]], piece);
    }
  }
  // Diagonal /
  for (let r = 3; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      score += scoreWindow([board[r][c], board[r-1][c+1], board[r-2][c+2], board[r-3][c+3]], piece);
    }
  }
  // Diagonal \
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      score += scoreWindow([board[r][c], board[r+1][c+1], board[r+2][c+2], board[r+3][c+3]], piece);
    }
  }
  return score;
}

function cloneBoard(board) {
  return board.map((r) => [...r]);
}

function minimax(board, depth, alpha, beta, maximizing) {
  const validCols = Array.from({ length: COLS }, (_, i) => i).filter((c) => isValidCol(board, c));

  if (checkWin(board, P2)) return { score: 100000 + depth };
  if (checkWin(board, P1)) return { score: -100000 - depth };
  if (validCols.length === 0 || isBoardFull(board)) return { score: 0 };
  if (depth === 0) return { score: scoreBoard(board, P2) };

  if (maximizing) {
    let best = { score: -Infinity, col: validCols[0] };
    for (const col of validCols) {
      const b = cloneBoard(board);
      dropPiece(b, col, P2);
      const result = minimax(b, depth - 1, alpha, beta, false);
      if (result.score > best.score) { best = { score: result.score, col }; }
      alpha = Math.max(alpha, best.score);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = { score: Infinity, col: validCols[0] };
    for (const col of validCols) {
      const b = cloneBoard(board);
      dropPiece(b, col, P1);
      const result = minimax(b, depth - 1, alpha, beta, true);
      if (result.score < best.score) { best = { score: result.score, col }; }
      beta = Math.min(beta, best.score);
      if (beta <= alpha) break;
    }
    return best;
  }
}

function getBotMove(board) {
  const result = minimax(board, 6, -Infinity, Infinity, true);
  return result.col;
}

function renderBoard(board) {
  let str = '';
  for (let r = 0; r < ROWS; r++) {
    str += board[r].map((c) => CELL_EMOJI[c]).join('') + '\n';
  }
  str += '1️⃣2️⃣3️⃣4️⃣5️⃣6️⃣7️⃣';
  return str;
}

function buildColumnButtons(gameId, board, disabled = false) {
  const rows = [];
  // 7 buttons split across 2 rows (5 + 2 or 4 + 3)
  const row1 = new ActionRowBuilder();
  const row2 = new ActionRowBuilder();
  for (let c = 0; c < COLS; c++) {
    const full = !isValidCol(board, c);
    const btn = new ButtonBuilder()
      .setCustomId(`c4_${gameId}_col_${c}`)
      .setLabel(`${c + 1}`)
      .setStyle(full ? ButtonStyle.Secondary : ButtonStyle.Primary)
      .setDisabled(disabled || full);
    if (c < 4) row1.addComponents(btn);
    else row2.addComponents(btn);
  }
  return [row1, row2];
}

function buildEmbed(game, statusText = '') {
  const turnName = game.vsBot
    ? (game.currentTurn === P1 ? `${game.player1.username} 🔴` : 'Bot 🟡')
    : (game.currentTurn === P1 ? `${game.player1.username} 🔴` : `${game.player2.username} 🟡`);

  return new EmbedBuilder()
    .setTitle(game.vsBot ? '🎮 Connect Four vs Bot' : '🎮 Connect Four')
    .setDescription(
      renderBoard(game.board) + '\n\n' +
      (game.over ? statusText : `**${turnName}'s turn**\n${statusText}`),
    )
    .setColor(game.over ? config.colors.success : config.colors.primary)
    .setFooter({ text: 'Angel Bot • Connect Four' })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('connectfour')
    .setDescription('Play Connect Four! Challenge someone or play vs the bot.')
    .addUserOption((opt) =>
      opt.setName('opponent').setDescription('Challenge a user (omit to play vs bot)').setRequired(false),
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

    const gameId = interaction.id;
    const game = {
      id: gameId,
      vsBot,
      player1: interaction.user,
      player2: vsBot ? null : opponent,
      board: createBoard(),
      currentTurn: P1,
      over: false,
    };
    c4Store.set(gameId, game);

    const initStatus = vsBot
      ? `**${interaction.user.username}** (🔴) vs **Bot** (🟡)\n${interaction.user.username}'s turn!`
      : `**${interaction.user.username}** (🔴) vs **${opponent.username}** (🟡)\n${interaction.user.username}'s turn!`;

    const reply = await interaction.reply({
      embeds: [buildEmbed(game, initStatus)],
      components: buildColumnButtons(gameId, game.board),
      fetchReply: true,
    });

    const filter = (i) => {
      const g = c4Store.get(gameId);
      if (!g || g.over) return false;
      if (!i.customId.startsWith(`c4_${gameId}_col_`)) return false;
      if (g.vsBot) return i.user.id === g.player1.id;
      return i.user.id === g.player1.id || i.user.id === g.player2.id;
    };

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter,
      time: 300000,
    });

    collector.on('collect', async (i) => {
      const g = c4Store.get(gameId);
      if (!g || g.over) return;

      const col = parseInt(i.customId.split('_')[4], 10);

      // PvP turn check
      if (!g.vsBot) {
        const expectedPlayer = g.currentTurn === P1 ? g.player1 : g.player2;
        if (i.user.id !== expectedPlayer.id) {
          return i.reply({ content: "It's not your turn!", ephemeral: true });
        }
      }

      if (!isValidCol(g.board, col)) {
        return i.reply({ content: 'That column is full! Choose another.', ephemeral: true });
      }

      // Player move
      dropPiece(g.board, col, g.currentTurn);

      if (checkWin(g.board, g.currentTurn)) {
        g.over = true;
        c4Store.delete(gameId);
        collector.stop('gameover');

        const winnerName = g.currentTurn === P1 ? g.player1.username : (g.vsBot ? 'Bot' : g.player2.username);
        const winEmoji = g.currentTurn === P1 ? '🔴' : '🟡';
        return i.update({
          embeds: [buildEmbed(g, `🎉 **${winnerName} ${winEmoji} wins!**`)],
          components: buildColumnButtons(gameId, g.board, true),
        });
      }

      if (isBoardFull(g.board)) {
        g.over = true;
        c4Store.delete(gameId);
        collector.stop('gameover');
        return i.update({
          embeds: [buildEmbed(g, "🤝 **It's a draw!**")],
          components: buildColumnButtons(gameId, g.board, true),
        });
      }

      // Switch turn
      g.currentTurn = g.currentTurn === P1 ? P2 : P1;

      if (g.vsBot) {
        // Bot move
        const botCol = getBotMove(g.board);
        dropPiece(g.board, botCol, P2);

        if (checkWin(g.board, P2)) {
          g.over = true;
          c4Store.delete(gameId);
          collector.stop('gameover');
          return i.update({
            embeds: [buildEmbed(g, '🤖 **Bot 🟡 wins!** Better luck next time!')],
            components: buildColumnButtons(gameId, g.board, true),
          });
        }

        if (isBoardFull(g.board)) {
          g.over = true;
          c4Store.delete(gameId);
          collector.stop('gameover');
          return i.update({
            embeds: [buildEmbed(g, "🤝 **It's a draw!**")],
            components: buildColumnButtons(gameId, g.board, true),
          });
        }

        g.currentTurn = P1;
        return i.update({
          embeds: [buildEmbed(g, `**${g.player1.username} 🔴's turn**`)],
          components: buildColumnButtons(gameId, g.board),
        });
      }

      // PvP next turn
      const nextPlayer = g.currentTurn === P1 ? g.player1 : g.player2;
      const emoji = g.currentTurn === P1 ? '🔴' : '🟡';
      return i.update({
        embeds: [buildEmbed(g, `**${nextPlayer.username} ${emoji}'s turn**`)],
        components: buildColumnButtons(gameId, g.board),
      });
    });

    collector.on('end', (_, reason) => {
      if (reason === 'gameover') return;
      const g = c4Store.get(gameId);
      if (g && !g.over) {
        g.over = true;
        c4Store.delete(gameId);
        reply.edit({
          embeds: [buildEmbed(g, '⏱️ **Game timed out!**')],
          components: buildColumnButtons(gameId, g.board, true),
        }).catch(() => null);
      }
    });
  },
};

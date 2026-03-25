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

// In-memory game store
const tttStore = new Map();

// Minimax algorithm for unbeatable bot
function minimax(board, isMaximizing, alpha, beta) {
  const winner = checkWinner(board);
  if (winner === 'O') return 10;
  if (winner === 'X') return -10;
  if (board.every((c) => c !== null)) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = 'O';
        best = Math.max(best, minimax(board, false, alpha, beta));
        board[i] = null;
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === null) {
        board[i] = 'X';
        best = Math.min(best, minimax(board, true, alpha, beta));
        board[i] = null;
        beta = Math.min(beta, best);
        if (beta <= alpha) break;
      }
    }
    return best;
  }
}

function getBotMove(board) {
  let bestVal = -Infinity;
  let bestMove = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      board[i] = 'O';
      const moveVal = minimax(board, false, -Infinity, Infinity);
      board[i] = null;
      if (moveVal > bestVal) {
        bestVal = moveVal;
        bestMove = i;
      }
    }
  }
  return bestMove;
}

function checkWinner(board) {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function buildBoard(game) {
  const rows = [];
  for (let row = 0; row < 3; row++) {
    const actionRow = new ActionRowBuilder();
    for (let col = 0; col < 3; col++) {
      const pos = row * 3 + col;
      const cell = game.board[pos];
      const btn = new ButtonBuilder()
        .setCustomId(`ttt_${game.id}_${pos}`)
        .setDisabled(cell !== null || game.over);

      if (cell === 'X') {
        btn.setLabel('X').setStyle(ButtonStyle.Danger);
      } else if (cell === 'O') {
        btn.setLabel('O').setStyle(ButtonStyle.Primary);
      } else {
        btn.setLabel(`${pos + 1}`).setStyle(ButtonStyle.Secondary);
      }
      actionRow.addComponents(btn);
    }
    rows.push(actionRow);
  }
  return rows;
}

function buildEmbed(game, statusText) {
  const title = game.vsBot ? '🎮 Tic-Tac-Toe vs Bot' : '🎮 Tic-Tac-Toe';
  const desc = statusText || (game.vsBot
    ? `**Your turn** (X) vs Bot (O)`
    : `**${game.currentTurn === 'X' ? game.player1.username : game.player2.username}'s turn** (${game.currentTurn})`);

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(game.over
      ? (checkWinner(game.board) ? config.colors.success : config.colors.neutral)
      : config.colors.primary)
    .setFooter({ text: 'Angel Bot • Tic-Tac-Toe' })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tictactoe')
    .setDescription('Play Tic-Tac-Toe! Challenge someone or play vs the (unbeatable) bot.')
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
      return interaction.reply({ content: 'You cannot challenge a bot!', ephemeral: true });
    }

    const gameId = interaction.id;
    const game = {
      id: gameId,
      board: Array(9).fill(null),
      vsBot,
      player1: interaction.user,   // X
      player2: vsBot ? null : opponent,  // O
      currentTurn: 'X',
      over: false,
    };
    tttStore.set(gameId, game);

    const embed = buildEmbed(game, vsBot
      ? `**${interaction.user.username}** (X) vs **Bot** (O)\nYour turn!`
      : `**${interaction.user.username}** (X) vs **${opponent.username}** (O)\n${interaction.user.username}'s turn!`);

    const reply = await interaction.reply({
      embeds: [embed],
      components: buildBoard(game),
      fetchReply: true,
    });

    const filter = (i) => {
      const g = tttStore.get(gameId);
      if (!g || g.over) return false;
      if (!i.customId.startsWith(`ttt_${gameId}_`)) return false;
      if (g.vsBot) return i.user.id === g.player1.id;
      return i.user.id === g.player1.id || i.user.id === g.player2.id;
    };

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter,
      time: 300000,
    });

    collector.on('collect', async (i) => {
      const g = tttStore.get(gameId);
      if (!g || g.over) return;

      const pos = parseInt(i.customId.split('_')[3], 10);

      // PvP turn check
      if (!g.vsBot) {
        const expectedPlayer = g.currentTurn === 'X' ? g.player1 : g.player2;
        if (i.user.id !== expectedPlayer.id) {
          return i.reply({ content: "It's not your turn!", ephemeral: true });
        }
      }

      if (g.board[pos] !== null) {
        return i.reply({ content: 'That cell is already taken!', ephemeral: true });
      }

      // Player move
      g.board[pos] = g.currentTurn;

      let statusText = null;
      const winner = checkWinner(g.board);
      const isDraw = !winner && g.board.every((c) => c !== null);

      if (winner || isDraw) {
        g.over = true;
        if (winner === 'X') {
          statusText = g.vsBot
            ? `🎉 **${g.player1.username} wins!** You beat the bot!`
            : `🎉 **${g.player1.username} wins!**`;
        } else if (winner === 'O') {
          statusText = g.vsBot
            ? `🤖 **The bot wins!** Better luck next time!`
            : `🎉 **${g.player2.username} wins!**`;
        } else {
          statusText = "🤝 **It's a draw!**";
        }
        tttStore.delete(gameId);
        collector.stop('gameover');
        return i.update({ embeds: [buildEmbed(g, statusText)], components: buildBoard(g) });
      }

      // Switch turn
      g.currentTurn = g.currentTurn === 'X' ? 'O' : 'X';

      if (g.vsBot) {
        // Bot move immediately
        const botMove = getBotMove(g.board);
        g.board[botMove] = 'O';

        const botWinner = checkWinner(g.board);
        const botDraw = !botWinner && g.board.every((c) => c !== null);

        if (botWinner) {
          g.over = true;
          statusText = '🤖 **The bot wins!** Better luck next time!';
          tttStore.delete(gameId);
          collector.stop('gameover');
        } else if (botDraw) {
          g.over = true;
          statusText = "🤝 **It's a draw!**";
          tttStore.delete(gameId);
          collector.stop('gameover');
        } else {
          g.currentTurn = 'X';
          statusText = `**${g.player1.username}'s turn** (X)`;
        }

        return i.update({ embeds: [buildEmbed(g, statusText)], components: buildBoard(g) });
      }

      // PvP next turn
      const nextPlayer = g.currentTurn === 'X' ? g.player1 : g.player2;
      statusText = `**${nextPlayer.username}'s turn** (${g.currentTurn})`;
      return i.update({ embeds: [buildEmbed(g, statusText)], components: buildBoard(g) });
    });

    collector.on('end', (_, reason) => {
      if (reason === 'gameover') return;
      const g = tttStore.get(gameId);
      if (g && !g.over) {
        g.over = true;
        tttStore.delete(gameId);
        const disabledBoard = buildBoard(g);
        reply.edit({
          embeds: [buildEmbed(g, '⏱️ **Game timed out!** No moves were made in time.')],
          components: disabledBoard,
        }).catch(() => null);
      }
    });
  },
};

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
const store2048 = new Map();

function createGrid() {
  const grid = Array.from({ length: 4 }, () => Array(4).fill(0));
  addRandomTile(grid);
  addRandomTile(grid);
  return grid;
}

function getEmptyCells(grid) {
  const cells = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (grid[r][c] === 0) cells.push([r, c]);
    }
  }
  return cells;
}

function addRandomTile(grid) {
  const empty = getEmptyCells(grid);
  if (empty.length === 0) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
}

function cloneGrid(grid) {
  return grid.map((r) => [...r]);
}

function slideRow(row) {
  // Remove zeros
  let filtered = row.filter((x) => x !== 0);
  let score = 0;
  // Merge adjacent equal tiles
  for (let i = 0; i < filtered.length - 1; i++) {
    if (filtered[i] === filtered[i + 1]) {
      filtered[i] *= 2;
      score += filtered[i];
      filtered[i + 1] = 0;
    }
  }
  filtered = filtered.filter((x) => x !== 0);
  // Pad with zeros
  while (filtered.length < 4) filtered.push(0);
  return { row: filtered, score };
}

function moveLeft(grid) {
  const newGrid = cloneGrid(grid);
  let score = 0;
  let moved = false;
  for (let r = 0; r < 4; r++) {
    const { row, score: s } = slideRow(newGrid[r]);
    if (row.join(',') !== newGrid[r].join(',')) moved = true;
    newGrid[r] = row;
    score += s;
  }
  return { grid: newGrid, score, moved };
}

function transpose(grid) {
  return grid[0].map((_, ci) => grid.map((row) => row[ci]));
}

function reverseRows(grid) {
  return grid.map((r) => [...r].reverse());
}

function applyMove(grid, direction) {
  let g = cloneGrid(grid);
  let score = 0;
  let moved = false;

  if (direction === 'left') {
    const result = moveLeft(g);
    return result;
  } else if (direction === 'right') {
    g = reverseRows(g);
    const result = moveLeft(g);
    result.grid = reverseRows(result.grid);
    return result;
  } else if (direction === 'up') {
    g = transpose(g);
    const result = moveLeft(g);
    result.grid = transpose(result.grid);
    return result;
  } else if (direction === 'down') {
    g = transpose(reverseRows(g));
    const result = moveLeft(g);
    result.grid = reverseRows(transpose(result.grid));
    return result;
  }
  return { grid: g, score, moved };
}

function hasValidMoves(grid) {
  if (getEmptyCells(grid).length > 0) return true;
  for (const dir of ['left', 'right', 'up', 'down']) {
    const { moved } = applyMove(grid, dir);
    if (moved) return true;
  }
  return false;
}

function getMaxTile(grid) {
  return Math.max(...grid.flat());
}

function renderGrid(grid) {
  const lines = grid.map((row) =>
    row.map((v) => String(v === 0 ? '.' : v).padStart(5)).join('│'),
  );
  const separator = '─────┼─────┼─────┼─────';
  return '```\n' + lines.join(`\n${separator}\n`) + '\n```';
}

function buildButtons(gameId, disabled = false) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`2048_${gameId}_up`)
      .setLabel('⬆️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`2048_${gameId}_down`)
      .setLabel('⬇️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`2048_${gameId}_left`)
      .setLabel('⬅️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`2048_${gameId}_right`)
      .setLabel('➡️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
  );
  return [row];
}

function buildEmbed(game, statusText = '') {
  const maxTile = getMaxTile(game.grid);
  return new EmbedBuilder()
    .setTitle('🎮 2048')
    .setDescription(
      renderGrid(game.grid) +
      `\n**Score:** ${game.score}  |  **Best tile:** ${maxTile}\n` +
      (statusText ? `\n${statusText}` : ''),
    )
    .setColor(game.over
      ? (maxTile >= 2048 ? config.colors.success : config.colors.error)
      : config.colors.primary)
    .setFooter({ text: 'Angel Bot • 2048' })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('2048')
    .setDescription('Play 2048! Slide tiles to combine them and reach 2048.')
    .setDMPermission(false),

  async execute(interaction) {
    const gameId = interaction.id;
    const game = {
      id: gameId,
      player: interaction.user,
      grid: createGrid(),
      score: 0,
      over: false,
      won: false,
    };
    store2048.set(gameId, game);

    const reply = await interaction.reply({
      embeds: [buildEmbed(game, 'Use the arrow buttons to slide tiles!')],
      components: buildButtons(gameId),
      fetchReply: true,
    });

    const filter = (i) =>
      i.user.id === game.player.id && i.customId.startsWith(`2048_${gameId}_`);

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter,
      time: 300000,
    });

    collector.on('collect', async (i) => {
      const g = store2048.get(gameId);
      if (!g || g.over) return;

      const direction = i.customId.split('_')[2];
      const { grid, score, moved } = applyMove(g.grid, direction);

      if (!moved) {
        return i.reply({ content: "Can't move in that direction!", ephemeral: true });
      }

      g.grid = grid;
      g.score += score;

      const maxTile = getMaxTile(g.grid);

      // Check win (2048 reached) — allow continuing
      if (maxTile >= 2048 && !g.won) {
        g.won = true;
        addRandomTile(g.grid);
        return i.update({
          embeds: [buildEmbed(g, `🎉 **You reached 2048! Keep going or play another game!**`)],
          components: buildButtons(gameId),
        });
      }

      // Check game over
      if (!hasValidMoves(g.grid)) {
        g.over = true;
        store2048.delete(gameId);
        collector.stop('gameover');
        return i.update({
          embeds: [buildEmbed(g, `💀 **Game Over! No more moves. Final score: ${g.score}**`)],
          components: buildButtons(gameId, true),
        });
      }

      addRandomTile(g.grid);

      // Check again after new tile
      if (!hasValidMoves(g.grid)) {
        g.over = true;
        store2048.delete(gameId);
        collector.stop('gameover');
        return i.update({
          embeds: [buildEmbed(g, `💀 **Game Over! No more moves. Final score: ${g.score}**`)],
          components: buildButtons(gameId, true),
        });
      }

      return i.update({
        embeds: [buildEmbed(g)],
        components: buildButtons(gameId),
      });
    });

    collector.on('end', (_, reason) => {
      if (reason === 'gameover') return;
      const g = store2048.get(gameId);
      if (g && !g.over) {
        g.over = true;
        store2048.delete(gameId);
        reply.edit({
          embeds: [buildEmbed(g, `⏱️ **Game timed out! Final score: ${g.score}**`)],
          components: buildButtons(gameId, true),
        }).catch(() => null);
      }
    });
  },
};

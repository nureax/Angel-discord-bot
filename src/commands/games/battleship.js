'use strict';

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
} = require('discord.js');
const { config } = require('../../../config');

// In-memory store
const bsStore = new Map();

const GRID_SIZE = 5;
// Ships: [name, size]
const SHIPS = [['Cruiser', 3], ['Destroyer A', 2], ['Destroyer B', 2]];

// 3 preset ship layouts for player selection
const PRESET_LAYOUTS = [
  {
    name: 'Layout A — Horizontal',
    ships: [
      { name: 'Cruiser', cells: [[0,0],[0,1],[0,2]] },
      { name: 'Destroyer A', cells: [[2,0],[2,1]] },
      { name: 'Destroyer B', cells: [[4,2],[4,3]] },
    ],
  },
  {
    name: 'Layout B — Vertical',
    ships: [
      { name: 'Cruiser', cells: [[0,4],[1,4],[2,4]] },
      { name: 'Destroyer A', cells: [[0,1],[1,1]] },
      { name: 'Destroyer B', cells: [[3,3],[4,3]] },
    ],
  },
  {
    name: 'Layout C — Mixed',
    ships: [
      { name: 'Cruiser', cells: [[1,1],[2,1],[3,1]] },
      { name: 'Destroyer A', cells: [[0,3],[0,4]] },
      { name: 'Destroyer B', cells: [[4,0],[4,1]] },
    ],
  },
];

function createEmptyGrid() {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
  // 0 = water, 1 = ship, 2 = hit, 3 = miss
}

function layoutToGrid(ships) {
  const grid = createEmptyGrid();
  for (const ship of ships) {
    for (const [r, c] of ship.cells) {
      grid[r][c] = 1;
    }
  }
  return grid;
}

function generateBotLayout() {
  // Place bot ships randomly
  const grid = createEmptyGrid();
  const placed = [];

  for (const [name, size] of SHIPS) {
    let ok = false;
    let attempts = 0;
    while (!ok && attempts < 200) {
      attempts++;
      const vert = Math.random() < 0.5;
      const r = Math.floor(Math.random() * GRID_SIZE);
      const c = Math.floor(Math.random() * GRID_SIZE);
      const cells = [];

      if (vert) {
        if (r + size > GRID_SIZE) continue;
        for (let i = 0; i < size; i++) cells.push([r + i, c]);
      } else {
        if (c + size > GRID_SIZE) continue;
        for (let i = 0; i < size; i++) cells.push([r, c + i]);
      }

      // Check overlap
      if (cells.every(([cr, cc]) => grid[cr][cc] === 0)) {
        for (const [cr, cc] of cells) grid[cr][cc] = 1;
        placed.push({ name, cells });
        ok = true;
      }
    }
  }
  return { grid, ships: placed };
}

function renderGrid(grid, revealShips = false) {
  const EMOJI = {
    0: '🌊',  // water
    1: revealShips ? '🚢' : '🌊',  // ship (hidden unless showing player board)
    2: '💥',  // hit
    3: '❌',  // miss
  };
  let str = '';
  for (let r = 0; r < GRID_SIZE; r++) {
    str += grid[r].map((c) => EMOJI[c]).join('') + '\n';
  }
  return str.trim();
}

function buildProbabilityMap(botShotGrid, botGrid) {
  // Probability heat map for bot targeting
  const prob = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));

  // Find hits that haven't been sunk
  const hits = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (botShotGrid[r][c] === 2) hits.push([r, c]);
    }
  }

  if (hits.length > 0) {
    // Target mode: increase probability adjacent to hits
    for (const [hr, hc] of hits) {
      for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr = hr + dr;
        const nc = hc + dc;
        if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE && botShotGrid[nr][nc] === 0) {
          prob[nr][nc] += 5;
        }
      }
    }
  } else {
    // Hunt mode: uniform + center bias
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (botShotGrid[r][c] === 0) {
          prob[r][c] = 1 + (r + c) % 2; // checkerboard hunt pattern
        }
      }
    }
  }
  return prob;
}

function getBotShot(botShotGrid, playerGrid) {
  const prob = buildProbabilityMap(botShotGrid, playerGrid);

  let maxProb = -1;
  let bestCells = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (botShotGrid[r][c] === 0) {
        if (prob[r][c] > maxProb) {
          maxProb = prob[r][c];
          bestCells = [[r, c]];
        } else if (prob[r][c] === maxProb) {
          bestCells.push([r, c]);
        }
      }
    }
  }
  if (bestCells.length === 0) return null;
  return bestCells[Math.floor(Math.random() * bestCells.length)];
}

function countShipCells(grid) {
  let count = 0;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (grid[r][c] === 1) count++;
    }
  }
  return count;
}

function buildFireButtons(gameId, shotGrid, disabled = false) {
  const rows = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < GRID_SIZE; c++) {
      const alreadyShot = shotGrid[r][c] === 2 || shotGrid[r][c] === 3;
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`bs_${gameId}_fire_${r}_${c}`)
          .setLabel(`${r + 1},${c + 1}`)
          .setStyle(alreadyShot
            ? (shotGrid[r][c] === 2 ? ButtonStyle.Danger : ButtonStyle.Secondary)
            : ButtonStyle.Primary)
          .setDisabled(disabled || alreadyShot),
      );
    }
    rows.push(row);
  }
  return rows;
}

function buildEmbed(game, statusText = '') {
  const playerShipCells = countShipCells(game.playerGrid);
  const botShipCells = countShipCells(game.botGrid);

  return new EmbedBuilder()
    .setTitle('🚢 Battleship vs Bot')
    .setDescription(
      `**Your Board** (🚢 ship, 💥 hit, ❌ miss)\n${renderGrid(game.playerGrid, true)}\n\n` +
      `**Enemy Board** (fire on the cells below!)\n${renderGrid(game.botShotGrid, false)}\n\n` +
      `**Your ships remaining:** ${playerShipCells} cells  |  **Enemy ships remaining:** ${botShipCells} cells\n` +
      (statusText ? `\n${statusText}` : ''),
    )
    .setColor(game.over
      ? (game.won ? config.colors.success : config.colors.error)
      : config.colors.primary)
    .setFooter({ text: 'Angel Bot • Battleship' })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('battleship')
    .setDescription('Play Battleship against the bot! Sink all enemy ships to win.')
    .setDMPermission(false),

  async execute(interaction) {
    // Step 1: Player picks a ship layout
    const selectRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`bs_setup_${interaction.id}`)
        .setPlaceholder('Choose your ship layout...')
        .addOptions(
          PRESET_LAYOUTS.map((layout, idx) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(layout.name)
              .setValue(String(idx))
              .setDescription(`Ships placed in ${layout.name.toLowerCase()}`),
          ),
        ),
    );

    const setupEmbed = new EmbedBuilder()
      .setTitle('🚢 Battleship — Choose Layout')
      .setDescription(
        '**Layouts:**\n' +
        PRESET_LAYOUTS.map((l, i) =>
          `**${i + 1}. ${l.name}**\n` + renderGrid(layoutToGrid(l.ships), true),
        ).join('\n\n'),
      )
      .setColor(config.colors.primary)
      .setFooter({ text: 'Angel Bot • Battleship Setup' })
      .setTimestamp();

    const setupReply = await interaction.reply({
      embeds: [setupEmbed],
      components: [selectRow],
      fetchReply: true,
    });

    let layoutIndex = -1;
    try {
      const setupInteraction = await setupReply.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        filter: (i) => i.user.id === interaction.user.id && i.customId === `bs_setup_${interaction.id}`,
        time: 60000,
      });
      layoutIndex = parseInt(setupInteraction.values[0], 10);
      await setupInteraction.deferUpdate();
    } catch {
      return setupReply.edit({
        embeds: [new EmbedBuilder().setTitle('🚢 Battleship').setDescription('Setup timed out.').setColor(config.colors.neutral)],
        components: [],
      }).catch(() => null);
    }

    const chosenLayout = PRESET_LAYOUTS[layoutIndex];
    const playerGrid = layoutToGrid(chosenLayout.ships);
    const { grid: botGrid } = generateBotLayout();

    // botShotGrid tracks where the player has fired on the bot
    // playerShotGrid tracks where the bot has fired on the player
    const botShotGrid = createEmptyGrid(); // player's view of bot's board
    const playerShotGrid = createEmptyGrid(); // bot's view of player's board — mirrors playerGrid hits

    const gameId = interaction.id;
    const game = {
      id: gameId,
      player: interaction.user,
      playerGrid,
      botGrid,
      botShotGrid,   // what has been shot on bot's board (player fires here)
      playerShotGrid, // what bot has shot on player's board
      over: false,
      won: false,
    };
    bsStore.set(gameId, game);

    const reply = await setupReply.edit({
      embeds: [buildEmbed(game, `Layout **${chosenLayout.name}** chosen! Fire on the enemy grid below!`)],
      components: buildFireButtons(gameId, game.botShotGrid),
    });

    const filter = (i) =>
      i.user.id === game.player.id && i.customId.startsWith(`bs_${gameId}_fire_`);

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter,
      time: 300000,
    });

    collector.on('collect', async (i) => {
      const g = bsStore.get(gameId);
      if (!g || g.over) return;

      const parts = i.customId.split('_');
      const row = parseInt(parts[4], 10);
      const col = parseInt(parts[5], 10);

      if (g.botShotGrid[row][col] !== 0) {
        return i.reply({ content: 'Already fired there!', ephemeral: true });
      }

      // Player fires at bot
      const playerHit = g.botGrid[row][col] === 1;
      g.botGrid[row][col] = playerHit ? 2 : 3;
      g.botShotGrid[row][col] = playerHit ? 2 : 3;

      const playerFireMsg = playerHit ? `💥 **Hit** at (${row + 1},${col + 1})!` : `❌ **Miss** at (${row + 1},${col + 1}).`;

      // Check if all bot ships sunk
      if (countShipCells(g.botGrid) === 0) {
        g.over = true;
        g.won = true;
        bsStore.delete(gameId);
        collector.stop('gameover');
        return i.update({
          embeds: [buildEmbed(g, `${playerFireMsg}\n\n🎉 **You sank all enemy ships! You win!**`)],
          components: buildFireButtons(gameId, g.botShotGrid, true),
        });
      }

      // Bot fires
      const botShot = getBotShot(g.playerShotGrid, g.playerGrid);
      let botFireMsg = '';
      if (botShot) {
        const [br, bc] = botShot;
        const botHit = g.playerGrid[br][bc] === 1;
        g.playerGrid[br][bc] = botHit ? 2 : 3;
        g.playerShotGrid[br][bc] = botHit ? 2 : 3;
        botFireMsg = botHit
          ? `\n🤖 Bot hit your ship at **(${br + 1},${bc + 1})**! 💥`
          : `\n🤖 Bot missed at (${br + 1},${bc + 1}).`;

        // Check if all player ships sunk
        if (countShipCells(g.playerGrid) === 0) {
          g.over = true;
          g.won = false;
          bsStore.delete(gameId);
          collector.stop('gameover');
          return i.update({
            embeds: [buildEmbed(g, `${playerFireMsg}${botFireMsg}\n\n💀 **The bot sank all your ships! Game over!**`)],
            components: buildFireButtons(gameId, g.botShotGrid, true),
          });
        }
      }

      return i.update({
        embeds: [buildEmbed(g, `${playerFireMsg}${botFireMsg}`)],
        components: buildFireButtons(gameId, g.botShotGrid),
      });
    });

    collector.on('end', (_, reason) => {
      if (reason === 'gameover') return;
      const g = bsStore.get(gameId);
      if (g && !g.over) {
        g.over = true;
        bsStore.delete(gameId);
        reply.edit({
          embeds: [buildEmbed(g, '⏱️ **Game timed out!**')],
          components: buildFireButtons(gameId, g.botShotGrid, true),
        }).catch(() => null);
      }
    });
  },
};

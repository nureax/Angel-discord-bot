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
const holStore = new Map();

function pickAdversarialNumber(current, guess, lo, hi) {
  // Adversarial: try to make the player wrong
  if (guess === 'higher') {
    // Player thinks secret > current. Bot wants secret <= current.
    // If lo..current is non-empty range, pick from there (player is wrong)
    if (lo <= current) {
      return lo + Math.floor(Math.random() * (current - lo + 1));
    }
    // Can't make player wrong — pick fairly from current+1..hi
    return (current + 1) + Math.floor(Math.random() * (hi - current));
  } else {
    // Player thinks secret < current. Bot wants secret >= current.
    if (current <= hi) {
      return current + Math.floor(Math.random() * (hi - current + 1));
    }
    // Can't make player wrong — pick from lo..current-1
    return lo + Math.floor(Math.random() * (current - lo));
  }
}

function buildButtons(gameId, disabled = false) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`hol_${gameId}_higher`)
      .setLabel('⬆️ Higher')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`hol_${gameId}_lower`)
      .setLabel('⬇️ Lower')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
  )];
}

function buildEmbed(game, extraText = '') {
  const color = game.over
    ? (game.score > 5 ? config.colors.success : config.colors.warning)
    : config.colors.primary;

  return new EmbedBuilder()
    .setTitle('🔢 Higher or Lower')
    .setDescription(
      `**Current number:** \`${game.currentNumber}\`\n` +
      `**Round:** ${game.round}/10  |  **Score:** ${game.score}\n` +
      `**Range:** ${game.lo}–${game.hi}\n\n` +
      (game.over
        ? extraText
        : `Is the secret number **higher** or **lower** than \`${game.currentNumber}\`?${extraText ? '\n\n' + extraText : ''}`),
    )
    .setColor(color)
    .setFooter({ text: 'Angel Bot • Higher or Lower' })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('higherorlower')
    .setDescription('Guess if the secret number is higher or lower! 10 rounds.')
    .setDMPermission(false),

  async execute(interaction) {
    const gameId = interaction.id;
    const startNumber = 1 + Math.floor(Math.random() * 100);
    const game = {
      id: gameId,
      player: interaction.user,
      currentNumber: startNumber,
      lo: 1,
      hi: 100,
      round: 1,
      score: 0,
      over: false,
    };
    holStore.set(gameId, game);

    const reply = await interaction.reply({
      embeds: [buildEmbed(game)],
      components: buildButtons(gameId),
      fetchReply: true,
    });

    const filter = (i) =>
      i.user.id === game.player.id && i.customId.startsWith(`hol_${gameId}_`);

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter,
      time: 300000,
    });

    collector.on('collect', async (i) => {
      const g = holStore.get(gameId);
      if (!g || g.over) return;

      const guess = i.customId.split('_')[3]; // 'higher' or 'lower'

      // Adversarially pick the secret number
      const secret = pickAdversarialNumber(g.currentNumber, guess, g.lo, g.hi);

      let correct = false;
      if (guess === 'higher' && secret > g.currentNumber) correct = true;
      if (guess === 'lower' && secret < g.currentNumber) correct = true;

      let feedback;
      if (correct) {
        g.score++;
        feedback = `✅ Correct! The number was **${secret}**.`;
      } else {
        feedback = `❌ Wrong! The number was **${secret}**.`;
      }

      // Update range based on the revealed secret so future picks stay consistent
      if (correct) {
        // Player was right — secret is beyond currentNumber in the guessed direction
        if (guess === 'higher') {
          g.lo = g.currentNumber + 1;
        } else {
          g.hi = g.currentNumber - 1;
        }
      } else {
        // Player was wrong — secret was on the other side; range contracts accordingly
        if (guess === 'higher') {
          g.hi = g.currentNumber; // secret was <= currentNumber
        } else {
          g.lo = g.currentNumber; // secret was >= currentNumber
        }
      }

      // Safety clamp in case range collapses
      if (g.lo > g.hi) {
        g.lo = 1;
        g.hi = 100;
      }

      g.currentNumber = secret;
      g.round++;

      if (g.round > 10) {
        g.over = true;
        holStore.delete(gameId);
        collector.stop('gameover');
        const finalText = `${feedback}\n\n**Game Over!** Final score: **${g.score}/10**\n${g.score >= 8 ? '🏆 Excellent!' : g.score >= 5 ? '👍 Good job!' : '😔 Better luck next time!'}`;
        return i.update({
          embeds: [buildEmbed(g, finalText)],
          components: buildButtons(gameId, true),
        });
      }

      // Pick next display number (random in valid range)
      const rangeSize = g.hi - g.lo + 1;
      g.currentNumber = g.lo + Math.floor(Math.random() * rangeSize);

      return i.update({
        embeds: [buildEmbed(g, feedback)],
        components: buildButtons(gameId),
      });
    });

    collector.on('end', (_, reason) => {
      if (reason === 'gameover') return;
      const g = holStore.get(gameId);
      if (g && !g.over) {
        g.over = true;
        holStore.delete(gameId);
        reply.edit({
          embeds: [buildEmbed(g, '⏱️ **Game timed out!**')],
          components: buildButtons(gameId, true),
        }).catch(() => null);
      }
    });
  },
};

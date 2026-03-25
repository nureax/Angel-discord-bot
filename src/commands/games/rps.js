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

// In-memory stores
const rpsStore = new Map();
// Per-user frequency table for predictive AI
const rpsFreqTable = new Map();

const CHOICES = ['rock', 'paper', 'scissors'];
const EMOJI = { rock: '🪨', paper: '📄', scissors: '✂️' };
const BEATS = { rock: 'scissors', paper: 'rock', scissors: 'paper' };

function getCounterMove(userId) {
  const freq = rpsFreqTable.get(userId) || { rock: 0, paper: 0, scissors: 0 };
  const total = freq.rock + freq.paper + freq.scissors;
  if (total < 3) return CHOICES[Math.floor(Math.random() * 3)];

  // Bayesian weighting — predict most likely player choice, counter it
  const weights = {
    rock: freq.rock / total,
    paper: freq.paper / total,
    scissors: freq.scissors / total,
  };
  // Find predicted player choice (most probable)
  let predicted = 'rock';
  for (const c of CHOICES) {
    if (weights[c] > weights[predicted]) predicted = c;
  }
  // Counter the predicted choice
  for (const [move, beats] of Object.entries(BEATS)) {
    if (beats === predicted) return move;
  }
  return CHOICES[Math.floor(Math.random() * 3)];
}

function updateFreq(userId, choice) {
  const freq = rpsFreqTable.get(userId) || { rock: 0, paper: 0, scissors: 0 };
  freq[choice] = (freq[choice] || 0) + 1;
  rpsFreqTable.set(userId, freq);
}

function determineWinner(c1, c2) {
  if (c1 === c2) return 'draw';
  if (BEATS[c1] === c2) return 'p1';
  return 'p2';
}

function buildButtons(gameId, disabled = false) {
  const row = new ActionRowBuilder();
  for (const choice of CHOICES) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`rps_${gameId}_${choice}`)
        .setLabel(`${EMOJI[choice]} ${choice.charAt(0).toUpperCase() + choice.slice(1)}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
    );
  }
  return [row];
}

function buildEmbed(title, desc, color) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(color)
    .setFooter({ text: 'Angel Bot • Rock Paper Scissors' })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Play Rock Paper Scissors! Challenge someone or play vs the bot.')
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
      choice1: null,  // player1's choice
      choice2: null,  // player2/bot choice
      over: false,
    };
    rpsStore.set(gameId, game);

    const desc = vsBot
      ? `**${interaction.user.username}** vs **Bot**\nPick your move!`
      : `**${interaction.user.username}** vs **${opponent.username}**\nBoth players: pick your move! Choices are hidden until both have chosen.`;

    const reply = await interaction.reply({
      embeds: [buildEmbed('🪨📄✂️ Rock Paper Scissors', desc, config.colors.primary)],
      components: buildButtons(gameId),
      fetchReply: true,
    });

    const filter = (i) => {
      const g = rpsStore.get(gameId);
      if (!g || g.over) return false;
      if (!i.customId.startsWith(`rps_${gameId}_`)) return false;
      if (g.vsBot) return i.user.id === g.player1.id;
      return i.user.id === g.player1.id || i.user.id === g.player2.id;
    };

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter,
      time: 300000,
    });

    collector.on('collect', async (i) => {
      const g = rpsStore.get(gameId);
      if (!g || g.over) return;

      const choice = i.customId.split('_')[3];

      if (g.vsBot) {
        // Solo vs bot
        g.choice1 = choice;
        updateFreq(g.player1.id, choice);
        g.choice2 = getCounterMove(g.player1.id);
        g.over = true;
        rpsStore.delete(gameId);
        collector.stop('gameover');

        const result = determineWinner(g.choice1, g.choice2);
        let resultText;
        if (result === 'draw') resultText = "🤝 **It's a draw!**";
        else if (result === 'p1') resultText = `🎉 **${g.player1.username} wins!**`;
        else resultText = `🤖 **Bot wins!** Better luck next time!`;

        const desc2 = `**${g.player1.username}:** ${EMOJI[g.choice1]} ${g.choice1}\n**Bot:** ${EMOJI[g.choice2]} ${g.choice2}\n\n${resultText}`;
        const color = result === 'p1' ? config.colors.success : result === 'draw' ? config.colors.neutral : config.colors.error;
        return i.update({
          embeds: [buildEmbed('🪨📄✂️ Rock Paper Scissors — Result', desc2, color)],
          components: buildButtons(gameId, true),
        });
      }

      // PvP
      if (i.user.id === g.player1.id) {
        if (g.choice1) return i.reply({ content: "You've already chosen!", ephemeral: true });
        g.choice1 = choice;
        await i.reply({ content: `You chose ${EMOJI[choice]} **${choice}**! Waiting for opponent...`, ephemeral: true });
      } else {
        if (g.choice2) return i.reply({ content: "You've already chosen!", ephemeral: true });
        g.choice2 = choice;
        await i.reply({ content: `You chose ${EMOJI[choice]} **${choice}**! Waiting for opponent...`, ephemeral: true });
      }

      // Check if both have chosen
      if (g.choice1 && g.choice2) {
        g.over = true;
        rpsStore.delete(gameId);
        collector.stop('gameover');

        const result = determineWinner(g.choice1, g.choice2);
        let resultText;
        if (result === 'draw') resultText = "🤝 **It's a draw!**";
        else if (result === 'p1') resultText = `🎉 **${g.player1.username} wins!**`;
        else resultText = `🎉 **${g.player2.username} wins!**`;

        const desc2 = `**${g.player1.username}:** ${EMOJI[g.choice1]} ${g.choice1}\n**${g.player2.username}:** ${EMOJI[g.choice2]} ${g.choice2}\n\n${resultText}`;
        const color = result === 'draw' ? config.colors.neutral : config.colors.success;
        await reply.edit({
          embeds: [buildEmbed('🪨📄✂️ Rock Paper Scissors — Result', desc2, color)],
          components: buildButtons(gameId, true),
        }).catch(() => null);
      }
    });

    collector.on('end', (_, reason) => {
      if (reason === 'gameover') return;
      const g = rpsStore.get(gameId);
      if (g && !g.over) {
        g.over = true;
        rpsStore.delete(gameId);
        reply.edit({
          embeds: [buildEmbed('🪨📄✂️ Rock Paper Scissors', '⏱️ **Game timed out!**', config.colors.neutral)],
          components: buildButtons(gameId, true),
        }).catch(() => null);
      }
    });
  },
};

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
const bjStore = new Map();

const SUITS = ['♠️', '♥️', '♦️', '♣️'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }
  // Shuffle (Fisher-Yates)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardValue(rank) {
  if (rank === 'A') return 11;
  if (['J', 'Q', 'K'].includes(rank)) return 10;
  return parseInt(rank, 10);
}

function handTotal(hand) {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    total += cardValue(card.rank);
    if (card.rank === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function formatCard(card) {
  return `${card.rank}${card.suit}`;
}

function formatHand(hand, hideSecond = false) {
  if (hideSecond && hand.length >= 2) {
    return `${formatCard(hand[0])} 🂠`;
  }
  return hand.map(formatCard).join(' ');
}

function buildButtons(gameId, disabled = false, firstTurn = false) {
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`bj_${gameId}_hit`)
      .setLabel('👊 Hit')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`bj_${gameId}_stand`)
      .setLabel('🛑 Stand')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId(`bj_${gameId}_double`)
      .setLabel('💰 Double Down')
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled || !firstTurn),
  );
  return [row];
}

function buildEmbed(game, statusText = '', hideDealer = true) {
  const playerTotal = handTotal(game.playerHand);
  const dealerTotal = hideDealer ? handTotal([game.dealerHand[0]]) : handTotal(game.dealerHand);

  return new EmbedBuilder()
    .setTitle('🃏 Blackjack')
    .setDescription(
      `**Dealer's hand:** ${formatHand(game.dealerHand, hideDealer)} ${hideDealer ? `(${dealerTotal}+?)` : `(${dealerTotal})`}\n` +
      `**Your hand:** ${formatHand(game.playerHand)} **(${playerTotal})**\n` +
      (statusText ? `\n${statusText}` : ''),
    )
    .setColor(game.over
      ? (game.result === 'win' ? config.colors.success : game.result === 'lose' ? config.colors.error : config.colors.neutral)
      : config.colors.primary)
    .setFooter({ text: 'Angel Bot • Blackjack' })
    .setTimestamp();
}

function dealerPlay(game) {
  // Dealer stands on 17 or more (S17 house rules)
  while (handTotal(game.dealerHand) < 17) {
    game.dealerHand.push(game.deck.pop());
  }
}

function resolveGame(game) {
  const playerTotal = handTotal(game.playerHand);
  const dealerTotal = handTotal(game.dealerHand);

  if (dealerTotal > 21) return 'win';
  if (playerTotal > dealerTotal) return 'win';
  if (playerTotal < dealerTotal) return 'lose';
  return 'draw';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Play Blackjack against the house!')
    .setDMPermission(false),

  async execute(interaction) {
    const gameId = interaction.id;
    const deck = createDeck();

    // Deal initial hands
    const playerHand = [deck.pop(), deck.pop()];
    const dealerHand = [deck.pop(), deck.pop()];

    const game = {
      id: gameId,
      player: interaction.user,
      deck,
      playerHand,
      dealerHand,
      over: false,
      result: null,
      turnCount: 0,
    };
    bjStore.set(gameId, game);

    // Check player blackjack
    const playerTotal = handTotal(playerHand);
    if (playerTotal === 21) {
      dealerPlay(game);
      const dealerTotal = handTotal(dealerHand);
      game.over = true;
      game.result = dealerTotal === 21 ? 'draw' : 'win';
      bjStore.delete(gameId);

      const resultText = game.result === 'win'
        ? '🎉 **Blackjack! You win!**'
        : "🤝 **Both have Blackjack — it's a push!**";

      return interaction.reply({
        embeds: [buildEmbed(game, resultText, false)],
        components: buildButtons(gameId, true),
      });
    }

    const reply = await interaction.reply({
      embeds: [buildEmbed(game, '**Your turn.** Hit, Stand, or Double Down?', true)],
      components: buildButtons(gameId, false, true),
      fetchReply: true,
    });

    const filter = (i) =>
      i.user.id === game.player.id && i.customId.startsWith(`bj_${gameId}_`);

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter,
      time: 300000,
    });

    collector.on('collect', async (i) => {
      const g = bjStore.get(gameId);
      if (!g || g.over) return;

      const action = i.customId.split('_')[3];
      g.turnCount++;

      if (action === 'hit' || action === 'double') {
        if (action === 'double') {
          // Double down: draw exactly one more card, then stand
          g.playerHand.push(g.deck.pop());
          const total = handTotal(g.playerHand);
          if (total > 21) {
            g.over = true;
            g.result = 'lose';
            bjStore.delete(gameId);
            collector.stop('gameover');
            return i.update({
              embeds: [buildEmbed(g, `💥 **Bust on Double Down! (${total})** You lose.`, true)],
              components: buildButtons(gameId, true),
            });
          }
          // Stand after double
          dealerPlay(g);
          g.over = true;
          g.result = resolveGame(g);
          bjStore.delete(gameId);
          collector.stop('gameover');

          const resultText = g.result === 'win'
            ? '🎉 **You win!** (Double Down)'
            : g.result === 'lose'
              ? `💸 **Dealer wins.** Dealer: ${handTotal(g.dealerHand)}, You: ${handTotal(g.playerHand)}`
              : "🤝 **It's a push!**";

          return i.update({
            embeds: [buildEmbed(g, resultText, false)],
            components: buildButtons(gameId, true),
          });
        }

        // Hit
        g.playerHand.push(g.deck.pop());
        const total = handTotal(g.playerHand);

        if (total > 21) {
          g.over = true;
          g.result = 'lose';
          bjStore.delete(gameId);
          collector.stop('gameover');
          return i.update({
            embeds: [buildEmbed(g, `💥 **Bust! (${total})** You lose.`, true)],
            components: buildButtons(gameId, true),
          });
        }

        if (total === 21) {
          // Auto-stand at 21
          dealerPlay(g);
          g.over = true;
          g.result = resolveGame(g);
          bjStore.delete(gameId);
          collector.stop('gameover');

          const resultText = g.result === 'win'
            ? '🎉 **You win with 21!**'
            : g.result === 'lose'
              ? `💸 **Dealer wins.** Dealer: ${handTotal(g.dealerHand)}`
              : "🤝 **It's a push!**";

          return i.update({
            embeds: [buildEmbed(g, resultText, false)],
            components: buildButtons(gameId, true),
          });
        }

        return i.update({
          embeds: [buildEmbed(g, `Your total: **${total}**. Hit, Stand, or continue?`, true)],
          components: buildButtons(gameId, false, false),
        });
      }

      if (action === 'stand') {
        dealerPlay(g);
        g.over = true;
        g.result = resolveGame(g);
        bjStore.delete(gameId);
        collector.stop('gameover');

        const playerFinal = handTotal(g.playerHand);
        const dealerFinal = handTotal(g.dealerHand);
        const resultText = g.result === 'win'
          ? `🎉 **You win!** You: ${playerFinal}, Dealer: ${dealerFinal}`
          : g.result === 'lose'
            ? `💸 **Dealer wins.** You: ${playerFinal}, Dealer: ${dealerFinal}`
            : `🤝 **Push! Both have ${playerFinal}.**`;

        return i.update({
          embeds: [buildEmbed(g, resultText, false)],
          components: buildButtons(gameId, true),
        });
      }
    });

    collector.on('end', (_, reason) => {
      if (reason === 'gameover') return;
      const g = bjStore.get(gameId);
      if (g && !g.over) {
        g.over = true;
        bjStore.delete(gameId);
        reply.edit({
          embeds: [buildEmbed(g, '⏱️ **Game timed out!**', false)],
          components: buildButtons(gameId, true),
        }).catch(() => null);
      }
    });
  },
};

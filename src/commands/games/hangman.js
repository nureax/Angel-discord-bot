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
const hangmanStore = new Map();

const WORD_LISTS = {
  easy: [
    'CAT', 'DOG', 'SUN', 'MAP', 'BUS', 'CUP', 'HAT', 'PEN', 'LEG', 'ARM',
    'BOOK', 'TREE', 'FISH', 'BIRD', 'CAKE', 'DOOR', 'FIRE', 'GAME', 'HAND', 'JUMP',
    'KITE', 'LAMP', 'MOON', 'NOSE', 'OPEN', 'PARK', 'RAIN', 'SNOW', 'STAR', 'TOWN',
    'UNIT', 'VOTE', 'WALK', 'YEAR', 'ZERO', 'BALL', 'CAMP', 'DESK', 'FARM', 'GOLD',
  ],
  medium: [
    'PLANET', 'BRIDGE', 'CASTLE', 'DANCER', 'ENGINE', 'FOREST', 'GARDEN', 'HAMMER',
    'ISLAND', 'JIGSAW', 'KITTEN', 'LOCKET', 'MAGNET', 'NEEDLE', 'ORANGE', 'PIRATE',
    'QUARTZ', 'RABBIT', 'SILVER', 'TICKET', 'TURNIP', 'VALLEY', 'WALRUS', 'YELLOW',
    'ZIPPER', 'ANCHOR', 'BARREL', 'CANDLE', 'DONKEY', 'ELBOW', 'FRIDGE', 'GOBLIN',
    'HELMET', 'INSECT', 'JUGGLE', 'KENNEL', 'LEMON', 'MUFFIN', 'NAPKIN', 'OYSTER',
    'PILLOW', 'QUARRY', 'ROCKET', 'SADDLE', 'THRONE', 'UMBRELLA', 'VORTEX', 'WITHER',
    'XYLEM', 'YONDER',
  ],
  hard: [
    'QUIZZICAL', 'XYLOPHONE', 'BUZZWORD', 'ZEPPELIN', 'QUAGMIRE', 'JACQUARD',
    'FJORDLAND', 'VEXATION', 'WHIRLPOOL', 'KNAPSACK', 'LABYRINTH', 'MYSTIQUE',
    'OBSIDIAN', 'PHANTASM', 'QUICKSAND', 'RHAPSODY', 'SILHOUETTE', 'TWILIGHT',
    'UNCOMMON', 'VIVACIOUS', 'WAVERING', 'EXORCISM', 'YELPING', 'ZUCCHINI',
    'ABSTRACT', 'BURGUNDY', 'CADENZA', 'DUNGEON', 'ECLIPSE', 'FROSTBITE',
    'GOSSAMER', 'HIBISCUS', 'INIQUITY', 'JUBILEE', 'KINDLING',
    'LUMINOUS', 'MORPHINE', 'NOCTURNE', 'OVERTURE', 'PERJURY',
  ],
};

const HANGMAN_ART = [
  // 0 wrong
  '```\n  +---+\n  |   |\n      |\n      |\n      |\n      |\n=========```',
  // 1 wrong
  '```\n  +---+\n  |   |\n  O   |\n      |\n      |\n      |\n=========```',
  // 2 wrong
  '```\n  +---+\n  |   |\n  O   |\n  |   |\n      |\n      |\n=========```',
  // 3 wrong
  '```\n  +---+\n  |   |\n  O   |\n /|   |\n      |\n      |\n=========```',
  // 4 wrong
  '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n      |\n      |\n=========```',
  // 5 wrong
  '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n /    |\n      |\n=========```',
  // 6 wrong — dead
  '```\n  +---+\n  |   |\n  O   |\n /|\\  |\n / \\  |\n      |\n=========```',
];

function getWordDisplay(word, guessed) {
  return word.split('').map((c) => (guessed.has(c) ? c : '_')).join(' ');
}

function buildSelectMenu(gameId, guessed) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter((l) => !guessed.has(l));
  if (letters.length === 0) return null;

  // Discord select menus max 25 options
  const options = letters.slice(0, 25).map((l) =>
    new StringSelectMenuOptionBuilder().setLabel(l).setValue(l),
  );

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`hangman_${gameId}_letter`)
    .setPlaceholder('Choose a letter to guess...')
    .addOptions(options);

  return new ActionRowBuilder().addComponents(menu);
}

function buildEmbed(game, extraText = '') {
  const display = getWordDisplay(game.word, game.guessed);
  const wrongGuesses = [...game.guessed].filter((l) => !game.word.includes(l));
  const triesLeft = 6 - wrongGuesses.length;

  return new EmbedBuilder()
    .setTitle(`🪓 Hangman — ${game.difficulty.charAt(0).toUpperCase() + game.difficulty.slice(1)}`)
    .setDescription(
      `${HANGMAN_ART[wrongGuesses.length]}\n\n` +
      `**Word:** \`${display}\`  (${game.word.length} letters)\n` +
      `**Wrong guesses:** ${wrongGuesses.length > 0 ? wrongGuesses.join(', ') : 'none'}\n` +
      `**Tries remaining:** ${triesLeft}\n` +
      (extraText ? `\n${extraText}` : ''),
    )
    .setColor(
      game.over
        ? (game.won ? config.colors.success : config.colors.error)
        : triesLeft <= 2 ? config.colors.warning : config.colors.primary,
    )
    .setFooter({ text: 'Angel Bot • Hangman' })
    .setTimestamp();
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hangman')
    .setDescription('Play Hangman! Guess the word before you run out of tries.')
    .addStringOption((opt) =>
      opt
        .setName('difficulty')
        .setDescription('Word difficulty (default: medium)')
        .setRequired(false)
        .addChoices(
          { name: 'Easy (4-5 letters)', value: 'easy' },
          { name: 'Medium (6-7 letters)', value: 'medium' },
          { name: 'Hard (8+ tricky letters)', value: 'hard' },
        ),
    )
    .setDMPermission(false),

  async execute(interaction) {
    const difficulty = interaction.options.getString('difficulty') || 'medium';
    const wordList = WORD_LISTS[difficulty];
    const word = wordList[Math.floor(Math.random() * wordList.length)];

    const gameId = interaction.id;
    const game = {
      id: gameId,
      player: interaction.user,
      word,
      difficulty,
      guessed: new Set(),
      over: false,
      won: false,
    };
    hangmanStore.set(gameId, game);

    const menuRow = buildSelectMenu(gameId, game.guessed);
    const components = menuRow ? [menuRow] : [];

    const reply = await interaction.reply({
      embeds: [buildEmbed(game)],
      components,
      fetchReply: true,
    });

    const filter = (i) =>
      i.user.id === game.player.id && i.customId.startsWith(`hangman_${gameId}_`);

    const collector = reply.createMessageComponentCollector({
      filter,
      time: 300000,
    });

    collector.on('collect', async (i) => {
      const g = hangmanStore.get(gameId);
      if (!g || g.over) return;

      let letter;
      if (i.isStringSelectMenu()) {
        letter = i.values[0];
      } else {
        return;
      }

      if (g.guessed.has(letter)) {
        return i.reply({ content: `You already guessed **${letter}**!`, ephemeral: true });
      }

      g.guessed.add(letter);

      const wrongGuesses = [...g.guessed].filter((l) => !g.word.includes(l));
      const display = getWordDisplay(g.word, g.guessed);
      const isComplete = !display.includes('_');
      const isDead = wrongGuesses.length >= 6;

      if (isComplete) {
        g.over = true;
        g.won = true;
        hangmanStore.delete(gameId);
        collector.stop('gameover');
        return i.update({
          embeds: [buildEmbed(g, `🎉 **You got it! The word was \`${g.word}\`!**`)],
          components: [],
        });
      }

      if (isDead) {
        g.over = true;
        g.won = false;
        g.guessed = new Set(g.word.split('')); // reveal word
        hangmanStore.delete(gameId);
        collector.stop('gameover');
        return i.update({
          embeds: [buildEmbed(g, `💀 **You were hanged! The word was \`${g.word}\`.**`)],
          components: [],
        });
      }

      const feedback = g.word.includes(letter)
        ? `✅ **${letter}** is in the word!`
        : `❌ **${letter}** is not in the word.`;

      const newMenu = buildSelectMenu(gameId, g.guessed);
      return i.update({
        embeds: [buildEmbed(g, feedback)],
        components: newMenu ? [newMenu] : [],
      });
    });

    collector.on('end', (_, reason) => {
      if (reason === 'gameover') return;
      const g = hangmanStore.get(gameId);
      if (g && !g.over) {
        g.over = true;
        g.guessed = new Set(g.word.split(''));
        hangmanStore.delete(gameId);
        reply.edit({
          embeds: [buildEmbed(g, `⏱️ **Timed out! The word was \`${g.word}\`.**`)],
          components: [],
        }).catch(() => null);
      }
    });
  },
};

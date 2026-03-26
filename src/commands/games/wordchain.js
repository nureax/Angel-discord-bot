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
const wcStore = new Map();

// Trap letters the bot tries to end on (very few common words start with these)
const TRAP_LETTERS = new Set(['X', 'Q', 'Z', 'J', 'V']);

// Bot vocabulary (200+ words)
const BOT_VOCAB = [
  'APPLE', 'ELEPHANT', 'TABLE', 'EAGLE', 'ENERGY', 'YELLOW', 'WONDER', 'RIVER',
  'RAIN', 'NIGHT', 'TIME', 'ECHO', 'ORANGE', 'EARTH', 'HIGH', 'HAPPY', 'YOUNG',
  'GREAT', 'TIGER', 'RING', 'GAME', 'ENGINE', 'EGG', 'GARDEN', 'NOBLE', 'EARLY',
  'LAST', 'TOWER', 'REAL', 'LAKE', 'KEEN', 'NEW', 'WORLD', 'DOOR', 'ROSE',
  'EXTRA', 'ALARM', 'MAGIC', 'CLOUD', 'DARK', 'KING', 'GOLD', 'DRAGON', 'NEST',
  'TUNNEL', 'LIGHT', 'TREE', 'EAGLE', 'EMBER', 'RIVER', 'RARE', 'EDGE', 'GRACE',
  'EMBER', 'ROAD', 'DAWN', 'NAME', 'ENTER', 'RAISE', 'EVENT', 'TRAIN', 'NORTH',
  'HOPE', 'EMBER', 'ROCK', 'KEEP', 'POWER', 'RAPID', 'DEEP', 'PLAIN', 'NOVEL',
  'LEAF', 'FLAG', 'GIANT', 'TORCH', 'HALF', 'FLAME', 'EARTH', 'HOME', 'EXCUSE',
  'ECHO', 'OPEN', 'NIGHT', 'TITLE', 'EMPTY', 'YIELD', 'DARK', 'KNOWN', 'NOBLE',
  'EMBER', 'RULE', 'EQUAL', 'LEMON', 'NEVER', 'RAPID', 'DREAM', 'MOUNT', 'TRACE',
  'EJECT', 'THIN', 'NERVE', 'EVERY', 'YEAR', 'RANGE', 'EAST', 'TRACK', 'KNIGHT',
  'TRUST', 'TRADE', 'ENTER', 'REACT', 'TARGET', 'TOPIC', 'CLOCK', 'KNOW', 'WISE',
  'EXACT', 'TOTAL', 'LARGE', 'EAGLE', 'EXTREME', 'EIGHT', 'TOWER', 'REALM', 'MYTH',
  'HONOR', 'RAVEN', 'NOVA', 'ALPHA', 'ARROW', 'OCEAN', 'NOBLE', 'ELITE', 'EARTH',
  'ANSWER', 'REIGN', 'NEVER', 'RAPID', 'DREAM', 'MOUNT', 'TRACE', 'EJECT', 'THIN',
  'NERVE', 'EVERY', 'YEAR', 'RANGE', 'EAST', 'TRACK', 'KNIGHT', 'TRUST', 'TRADE',
  'OVER', 'RUNE', 'EMBER', 'RIDGE', 'EDGE', 'ENGAGE', 'GLOBE', 'EAGLE', 'EASY',
  'ANGER', 'REMOVE', 'ENTER', 'RANDOM', 'MOOD', 'DAGGER', 'RUBY', 'YELL', 'LONG',
  'GREAT', 'TEMPLE', 'LORE', 'ECHO', 'ORDER', 'REALM', 'MYTH', 'HEART', 'TOWER',
  'RIVER', 'RARE', 'EDGE', 'GRACE', 'EMBER', 'ROAD', 'DAWN', 'NAME', 'ENTER',
  // More words to reach 200+
  'VAULT', 'TOUCH', 'HONOR', 'REIGN', 'NORTH', 'HAZE', 'ENDURE', 'EVOLVE', 'EXCLAIM',
  'VIBRATE', 'EXHAUST', 'TORMENT', 'TEXTURE', 'EXTREME', 'EXAMINE', 'EXPLORE',
  'ENVY', 'YARD', 'DECIDE', 'ENERGY', 'YAK', 'KITTEN', 'NOTHING', 'GRAVEL',
  'LIVELY', 'YELLOW', 'WONDER', 'REGAL', 'LOYAL', 'LOST', 'TALENT', 'THREAD',
  'DIVINE', 'EMBER', 'RUIN', 'NECKLACE', 'ELEMENT', 'TOKEN', 'NOBLE', 'ENTER',
  'ROCKET', 'THEORY', 'YONDER', 'RAVEN', 'NIGHT', 'THORN', 'NORTH', 'HASTE',
];

// Validation word list (300+ common English words)
const VALID_WORDS = new Set([
  'APPLE', 'ELEPHANT', 'TABLE', 'EAGLE', 'ENERGY', 'YELLOW', 'WONDER', 'RIVER',
  'RAIN', 'NIGHT', 'TIME', 'ECHO', 'ORANGE', 'EARTH', 'HIGH', 'HAPPY', 'YOUNG',
  'GREAT', 'TIGER', 'RING', 'GAME', 'ENGINE', 'EGG', 'GARDEN', 'NOBLE', 'EARLY',
  'LAST', 'TOWER', 'REAL', 'LAKE', 'KEEN', 'NEW', 'WORLD', 'DOOR', 'ROSE',
  'EXTRA', 'ALARM', 'MAGIC', 'CLOUD', 'DARK', 'KING', 'GOLD', 'DRAGON', 'NEST',
  'TUNNEL', 'LIGHT', 'TREE', 'EMBER', 'RARE', 'EDGE', 'GRACE', 'ROAD', 'DAWN',
  'NAME', 'ENTER', 'RAISE', 'EVENT', 'TRAIN', 'NORTH', 'HOPE', 'ROCK', 'KEEP',
  'POWER', 'RAPID', 'DEEP', 'PLAIN', 'NOVEL', 'LEAF', 'FLAG', 'GIANT', 'TORCH',
  'HALF', 'FLAME', 'HOME', 'EXCUSE', 'OPEN', 'TITLE', 'EMPTY', 'YIELD', 'KNOWN',
  'RULE', 'EQUAL', 'LEMON', 'NEVER', 'DREAM', 'MOUNT', 'TRACE', 'EJECT', 'THIN',
  'NERVE', 'EVERY', 'YEAR', 'RANGE', 'EAST', 'TRACK', 'KNIGHT', 'TRUST', 'TRADE',
  'CLOCK', 'KNOW', 'WISE', 'EXACT', 'TOTAL', 'LARGE', 'EXTREME', 'EIGHT', 'REALM',
  'MYTH', 'HONOR', 'RAVEN', 'NOVA', 'ALPHA', 'ARROW', 'OCEAN', 'ELITE', 'ANSWER',
  'REIGN', 'ANGER', 'REMOVE', 'RANDOM', 'MOOD', 'DAGGER', 'RUBY', 'YELL', 'LONG',
  'TEMPLE', 'LORE', 'ORDER', 'HEART', 'VAULT', 'TOUCH', 'HAZE', 'ENDURE',
  'EVOLVE', 'EXHAUST', 'TORMENT', 'TEXTURE', 'EXAMINE', 'EXPLORE', 'ENVY', 'YARD',
  'DECIDE', 'YAK', 'KITTEN', 'NOTHING', 'GRAVEL', 'LIVELY', 'REGAL', 'LOYAL',
  'LOST', 'TALENT', 'THREAD', 'DIVINE', 'RUIN', 'ELEMENT', 'TOKEN', 'ROCKET',
  'THEORY', 'YONDER', 'THORN', 'HASTE', 'VIBRATE', 'EXPLORE', 'EXCLAIM',
  // Standard dictionary words
  'ABLE', 'ABOVE', 'ABUSE', 'ACID', 'ACORN', 'ACROSS', 'ACTION', 'ACTOR', 'ADAPT',
  'ADULT', 'AFTER', 'AGAIN', 'AGENT', 'AGREE', 'AHEAD', 'ALONG', 'ALTER', 'ANGEL',
  'APART', 'APPLY', 'ARENA', 'ARGUE', 'ARISE', 'ARMOR', 'ASIDE', 'ASSET', 'ATLAS',
  'AVOID', 'AWAKE', 'AWARD', 'AWARE', 'AWFUL', 'BAKED', 'BAKER', 'BASIC', 'BASIS',
  'BATCH', 'BEACH', 'BEGAN', 'BEGIN', 'BEING', 'BELOW', 'BENCH', 'BERRY', 'BIRTH',
  'BLACK', 'BLADE', 'BLAME', 'BLANK', 'BLAST', 'BLAZE', 'BLEND', 'BLIND', 'BLOCK',
  'BLOOD', 'BLOOM', 'BLOWN', 'BOARD', 'BONUS', 'BOOST', 'BOUND', 'BRAVE', 'BREAD',
  'BREAK', 'BREED', 'BRICK', 'BRIDE', 'BRIEF', 'BRING', 'BROKE', 'BROOK', 'BROWN',
  'BRUSH', 'BUILD', 'BUILT', 'BURST', 'BUYER', 'CABIN', 'CANDY', 'CARRY', 'CAUSE',
  'CHAIN', 'CHAIR', 'CHAOS', 'CHARM', 'CHART', 'CHASE', 'CHEAP', 'CHECK', 'CHESS',
  'CHEST', 'CHIEF', 'CHILD', 'CHUNK', 'CIVIC', 'CIVIL', 'CLAIM', 'CLASS', 'CLEAN',
  'CLEAR', 'CLERK', 'CLIFF', 'CLONE', 'CLOSE', 'COACH', 'COAST', 'COUNT', 'COURT',
  'COVER', 'CRAFT', 'CRANE', 'CRASH', 'CRAZY', 'CREEK', 'CRIME', 'CRISP', 'CROSS',
  'CROWD', 'CROWN', 'CRUEL', 'CRUSH', 'CURVE', 'CYCLE', 'DAILY', 'DANCE', 'DEATH',
  'DEBUT', 'DELTA', 'DEMON', 'DENSE', 'DEPTH', 'DEVIL', 'DIRTY', 'DODGE', 'DOUBT',
  'DOUGH', 'DRAFT', 'DRAIN', 'DRAMA', 'DRAWL', 'DRESS', 'DRIFT', 'DRINK', 'DRIVE',
  'DROVE', 'DROWN', 'DYING', 'ELITE', 'EMPTY', 'ENEMY', 'ENJOY', 'ENTRY', 'ERROR',
  'ESSAY', 'ETHIC', 'EVENT', 'FABLE', 'FAINT', 'FAITH', 'FALSE', 'FANCY', 'FATAL',
  'FEAST', 'FENCE', 'FEVER', 'FIELD', 'FIFTH', 'FIGHT', 'FINAL', 'FIRST', 'FIXED',
  'FLEET', 'FLESH', 'FLOAT', 'FLOOD', 'FLOOR', 'FLORA', 'FLUID', 'FOCUS', 'FORCE',
  'FORGE', 'FORTE', 'FOUND', 'FRAME', 'FRANK', 'FRAUD', 'FRESH', 'FROST', 'FRUIT',
  'GHOST', 'GIVEN', 'GLASS', 'GLOBE', 'GLOOM', 'GLORY', 'GLOVE', 'GOING', 'GRACE',
  'GRADE', 'GRAND', 'GRANT', 'GRASP', 'GRASS', 'GRAVE', 'GREED', 'GREEN', 'GREET',
  'GRIEF', 'GRIND', 'GROAN', 'GROSS', 'GROUP', 'GROVE', 'GROWN', 'GUARD', 'GUESS',
  'GUEST', 'GUIDE', 'GUILT', 'GUISE', 'GUSTO', 'HABIT', 'HARSH', 'HAUNT', 'HEAVY',
  'HENCE', 'HERBS', 'HINGE', 'HOBBY', 'HONEY', 'HORSE', 'HOTEL', 'HOURS', 'HOUSE',
  'HUMAN', 'HUMOR', 'IDEAL', 'IMAGE', 'IMPLY', 'INDEX', 'INNER', 'INPUT', 'INTRO',
  'ISSUE', 'IVORY', 'JEWEL', 'JOINT', 'JOKER', 'JOLLY', 'JUDGE', 'JUICE', 'LABEL',
  'LABOR', 'LANCE', 'LASER', 'LATER', 'LAUGH', 'LAYER', 'LEARN', 'LEAST', 'LEAVE',
  'LEGAL', 'LEVEL', 'LIMIT', 'LINED', 'LINER', 'LIVER', 'LOCAL', 'LOGIC', 'LOOSE',
  'LOVER', 'LOWER', 'LUCKY', 'LUNCH', 'LYING', 'MAJOR', 'MAKER', 'MANOR', 'MAPLE',
  'MARCH', 'MATCH', 'MAYOR', 'MEDIA', 'MERCY', 'MERIT', 'METAL', 'MIGHT', 'MINOR',
  'MINUS', 'MIXED', 'MODEL', 'MONEY', 'MONTH', 'MORAL', 'MOTOR', 'MOUSE', 'MOUTH',
  'MOVED', 'MOVIE', 'MUSIC', 'NAIVE', 'NOISE', 'NOTED', 'NURSE', 'OFFER', 'OFTEN',
  'OMEGA', 'ONSET', 'OPERA', 'PAINT', 'PANDA', 'PANEL', 'PANIC', 'PAPER', 'PARTY',
  'PASTA', 'PATCH', 'PAUSE', 'PEACE', 'PEACH', 'PEARL', 'PEDAL', 'PENNY', 'PHASE',
  'PHONE', 'PHOTO', 'PIANO', 'PILOT', 'PIXEL', 'PIZZA', 'PLACE', 'PLANE', 'PLANT',
  'PLATE', 'PLAZA', 'POINT', 'POLAR', 'POPPY', 'PRESS', 'PRICE', 'PRIDE', 'PRIME',
  'PRINT', 'PRIOR', 'PRIZE', 'PROBE', 'PRONE', 'PROOF', 'PROSE', 'PROUD', 'PROVE',
  'QUEEN', 'QUEST', 'QUICK', 'QUIET', 'QUOTA', 'QUOTE', 'RADAR', 'RADIO', 'RALLY',
  'RANCH', 'RATIO', 'REACH', 'READY', 'REBEL', 'REFER', 'RELAX', 'REPAY', 'REPEL',
  'REPLY', 'RIDER', 'RIDGE', 'RIFLE', 'RIGHT', 'RISKY', 'RIVAL', 'ROBOT', 'ROCKY',
  'ROGUE', 'ROUND', 'ROUTE', 'ROYAL', 'RURAL', 'SADLY', 'SAINT', 'SAUCE', 'SCALE',
  'SCARE', 'SCENE', 'SCORE', 'SCOUT', 'SEIZE', 'SENSE', 'SERVE', 'SHADE', 'SHAKE',
  'SHAME', 'SHAPE', 'SHARE', 'SHARK', 'SHARP', 'SHEEP', 'SHEER', 'SHELF', 'SHELL',
  'SHIFT', 'SHINE', 'SHIRT', 'SHOCK', 'SHOOT', 'SHORE', 'SHORT', 'SHOUT', 'SHOWN',
  'SIGHT', 'SILLY', 'SINCE', 'SIXTH', 'SKILL', 'SKULL', 'SLATE', 'SLAVE', 'SLEEP',
  'SLICE', 'SLOPE', 'SMALL', 'SMART', 'SMELL', 'SMILE', 'SMOKE', 'SNEAK', 'SOLAR',
  'SOLID', 'SOLVE', 'SORRY', 'SOUND', 'SOUTH', 'SPACE', 'SPARE', 'SPARK', 'SPEAK',
  'SPEED', 'SPEND', 'SPICE', 'SPINE', 'SPITE', 'SPLIT', 'SPORT', 'SPRAY', 'SQUAD',
  'STACK', 'STAFF', 'STAGE', 'STAIN', 'STAIR', 'STAKE', 'STALE', 'STAND', 'STARE',
  'START', 'STATE', 'STEAK', 'STEAL', 'STEAM', 'STEEL', 'STEEP', 'STEER', 'STERN',
  'STICK', 'STIFF', 'STILL', 'STING', 'STOCK', 'STOOD', 'STORE', 'STORM', 'STORY',
  'STOVE', 'STRAP', 'STRAY', 'STRIP', 'STUCK', 'STUDY', 'STUNT', 'STYLE', 'SUGAR',
  'SUITE', 'SUNNY', 'SUPER', 'SURGE', 'SWEET', 'SWEPT', 'SWIFT', 'SWORD', 'SWORN',
  'SYRUP', 'TAKEN', 'TASTE', 'TEACH', 'TENSE', 'TENTH', 'TERMS', 'THANK', 'THEME',
  'THERE', 'THICK', 'THING', 'THINK', 'THIRD', 'THOSE', 'THREE', 'THREW', 'THROW',
  'THUMB', 'TIGHT', 'TIMER', 'TIRED', 'TITAN', 'TODAY', 'TOPIC', 'TOUCH', 'TOUGH',
  'TOWEL', 'TRACK', 'TRADE', 'TRAIL', 'TRAIT', 'TRASH', 'TREAT', 'TREND', 'TRIAL',
  'TRIBE', 'TRICK', 'TROOP', 'TRUCK', 'TRULY', 'TRUNK', 'TRUTH', 'TULIP', 'TWICE',
  'TWIST', 'UNDER', 'UNION', 'UNITE', 'UNITY', 'UNTIL', 'UPPER', 'UPSET', 'URBAN',
  'USAGE', 'USUAL', 'UTTER', 'VAGUE', 'VALID', 'VALUE', 'VAPOR', 'VERSE', 'VIDEO',
  'VIGOR', 'VIRAL', 'VIRUS', 'VISIT', 'VISTA', 'VITAL', 'VOCAL', 'VOICE', 'VOTER',
  'WALTZ', 'WASTE', 'WATCH', 'WATER', 'WEARY', 'WEAVE', 'WEDGE', 'WEIGH', 'WEIRD',
  'WHALE', 'WHEAT', 'WHEEL', 'WHERE', 'WHICH', 'WHILE', 'WHITE', 'WHOLE', 'WHOSE',
  'WIDER', 'WITCH', 'WOMAN', 'WOMEN', 'WORRY', 'WORST', 'WORTH', 'WOULD', 'WOUND',
  'WRATH', 'WRITE', 'WRONG', 'WROTE', 'YACHT', 'YEARN', 'ZEBRA',
  // Include all bot vocab too
  ...BOT_VOCAB,
]);

function getBotWord(lastLetter, usedWords) {
  // Try to find a word ending on a trap letter
  const available = BOT_VOCAB.filter(
    (w) => w[0] === lastLetter.toUpperCase() && !usedWords.has(w),
  );
  if (available.length === 0) return null;

  // Prefer words ending on trap letters
  const trapWords = available.filter((w) => TRAP_LETTERS.has(w[w.length - 1]));
  const pool = trapWords.length > 0 ? trapWords : available;
  return pool[Math.floor(Math.random() * pool.length)];
}

function buildRematchRow(gameId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`rematch_wordchain_${gameId}`)
      .setLabel('🔁 Rematch')
      .setStyle(ButtonStyle.Primary),
  );
}

function buildButton(gameId, disabled = false) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`wc_${gameId}_word`)
      .setLabel('✏️ Submit Word')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
  )];
}

function buildEmbed(game, statusText = '') {
  const chain = game.chain.slice(-8); // Show last 8 words
  const chainDisplay = chain.length > 0 ? chain.join(' → ') : '*No words yet*';
  const lastWord = game.chain[game.chain.length - 1] || null;

  return new EmbedBuilder()
    .setTitle(game.vsBot ? '🔗 Word Chain vs Bot' : '🔗 Word Chain')
    .setDescription(
      `**Chain:** ${chainDisplay}\n` +
      `**Chain length:** ${game.chain.length}\n` +
      (lastWord ? `**Next word must start with:** \`${lastWord[lastWord.length - 1].toUpperCase()}\`\n` : '') +
      (statusText ? `\n${statusText}` : ''),
    )
    .setColor(game.over ? (game.won ? config.colors.success : config.colors.error) : config.colors.primary)
    .setFooter({ text: 'Angel Bot • Word Chain | 30s per turn' })
    .setTimestamp();
}

/**
 * Core game logic. Called on fresh start and on rematch.
 *
 * @param {import('discord.js').ChatInputCommandInteraction | import('discord.js').MessageComponentInteraction} interaction
 * @param {import('discord.js').User} player1
 * @param {import('discord.js').User | null} opponentUser
 * @param {boolean} isRematch
 */
async function startGame(interaction, player1, opponentUser, isRematch = false, wager = 0) {
  const vsBot = !opponentUser;
  const gameId = interaction.id;

  const game = {
    id: gameId,
    vsBot,
    player1,
    player2: vsBot ? null : opponentUser,
    chain: [],
    usedWords: new Set(),
    currentTurn: 0, // 0 = player1, 1 = player2/bot
    over: false,
    won: false,
    wager,
  };
  wcStore.set(gameId, game);

  const wagerText = (!vsBot && wager > 0) ? `\n⚔️ Wager: **${wager}** coins` : '';
  const initText = vsBot
    ? `**${player1.username}** vs **Bot**\n${player1.username} goes first! Start with any word.`
    : `**${player1.username}** vs **${opponentUser.username}**\n${player1.username} goes first! Start with any word.${wagerText}`;

  const replyFn = isRematch
    ? (opts) => interaction.followUp({ ...opts, fetchReply: true })
    : (opts) => interaction.reply({ ...opts, fetchReply: true });

  const reply = await replyFn({
    embeds: [buildEmbed(game, initText)],
    components: buildButton(gameId),
  });

  let turnTimeout = null;

  function getCurrentPlayer(g) {
    if (g.vsBot) return g.currentTurn === 0 ? g.player1 : null;
    return g.currentTurn === 0 ? g.player1 : g.player2;
  }

  function startTurnTimeout(_g) {
    if (turnTimeout) clearTimeout(turnTimeout);
    turnTimeout = setTimeout(async () => {
      const gNow = wcStore.get(gameId);
      if (!gNow || gNow.over) return;
      gNow.over = true;
      wcStore.delete(gameId);

      const currentPlayer = getCurrentPlayer(gNow);
      const loserName = currentPlayer ? currentPlayer.username : 'Bot';

      // Record loss for the player who timed out
      if (currentPlayer) {
        recordLoss(interaction.guildId, currentPlayer.id, 'wordchain');
        if (!vsBot) {
          const winnerId = currentPlayer.id === player1.id ? (opponentUser ? opponentUser.id : null) : player1.id;
          if (winnerId) {
            recordWin(interaction.guildId, winnerId, 'wordchain');
            const wcPayout = gNow.wager > 0
              ? (gNow.wager * 2) - Math.floor((gNow.wager * 2) * 0.05)
              : 150;
            addToWallet(interaction.guildId, winnerId, wcPayout).catch(() => null);
          }
        }
      }

      const rematchRow = buildRematchRow(gameId);
      await reply.edit({
        embeds: [buildEmbed(gNow, `⏱️ **${loserName} ran out of time! Game over. Chain length: ${gNow.chain.length}**`)],
        components: [...buildButton(gameId, true), rematchRow],
      }).catch(() => null);
      collector.stop('timeout');
    }, 30000);
  }

  startTurnTimeout(game);

  const filter = (i) => {
    const g = wcStore.get(gameId);
    if (!g || g.over) return false;
    if (!i.customId.startsWith(`wc_${gameId}_`)) return false;
    const currentPlayer = getCurrentPlayer(g);
    if (!currentPlayer) return false;
    return i.user.id === currentPlayer.id;
  };

  const collector = reply.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter,
    time: 300000,
  });

  collector.on('collect', async (i) => {
    const g = wcStore.get(gameId);
    if (!g || g.over) return;

    const modal = new ModalBuilder()
      .setCustomId(`wc_modal_${gameId}_${i.user.id}`)
      .setTitle('Word Chain — Enter Your Word');

    const lastWord = g.chain[g.chain.length - 1];
    const requiredStart = lastWord ? lastWord[lastWord.length - 1].toUpperCase() : 'any letter';

    const input = new TextInputBuilder()
      .setCustomId('word_input')
      .setLabel(`Word starting with "${requiredStart}"`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(`Enter a word starting with ${requiredStart}...`)
      .setRequired(true)
      .setMinLength(2)
      .setMaxLength(30);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await i.showModal(modal);

    try {
      const submission = await i.awaitModalSubmit({
        filter: (mi) => mi.customId === `wc_modal_${gameId}_${i.user.id}`,
        time: 30000,
      });

      const gNow = wcStore.get(gameId);
      if (!gNow || gNow.over) {
        return submission.reply({ content: 'The game has already ended.', ephemeral: true }).catch(() => null);
      }

      const word = submission.fields.getTextInputValue('word_input').trim().toUpperCase();

      // Validate
      if (!/^[A-Z]+$/.test(word)) {
        return submission.reply({ content: 'Please enter a word with letters only.', ephemeral: true });
      }

      const lastW = gNow.chain[gNow.chain.length - 1];
      if (lastW && word[0] !== lastW[lastW.length - 1].toUpperCase()) {
        return submission.reply({
          content: `❌ **${word}** must start with **${lastW[lastW.length - 1].toUpperCase()}**!`,
          ephemeral: true,
        });
      }

      if (gNow.usedWords.has(word)) {
        return submission.reply({ content: `❌ **${word}** has already been used!`, ephemeral: true });
      }

      if (!VALID_WORDS.has(word)) {
        return submission.reply({ content: `❌ **${word}** is not in my word list. Try another word!`, ephemeral: true });
      }

      // Valid word — add to chain
      gNow.chain.push(word);
      gNow.usedWords.add(word);

      if (turnTimeout) clearTimeout(turnTimeout);

      if (gNow.vsBot) {
        // Bot responds instantly
        const botWord = getBotWord(word[word.length - 1], gNow.usedWords);
        if (!botWord) {
          // Bot has no valid word — player wins
          gNow.over = true;
          gNow.won = true;
          recordWin(interaction.guildId, gNow.player1.id, 'wordchain');
          addToWallet(interaction.guildId, gNow.player1.id, 50).catch(() => null);
          wcStore.delete(gameId);
          collector.stop('gameover');
          const rematchRow = buildRematchRow(gameId);
          await submission.reply({ content: `✅ Word accepted: **${word}**`, ephemeral: true });
          return reply.edit({
            embeds: [buildEmbed(gNow, `🎉 **The bot has no valid response! You win! Chain length: ${gNow.chain.length} +50 🪙**`)],
            components: [...buildButton(gameId, true), rematchRow],
          }).catch(() => null);
        }

        gNow.chain.push(botWord);
        gNow.usedWords.add(botWord);
        await submission.reply({ content: `✅ Word accepted: **${word}**`, ephemeral: true });
        startTurnTimeout(gNow);
        return reply.edit({
          embeds: [buildEmbed(gNow, `🤖 Bot played **${botWord}**! Your turn — start with **${botWord[botWord.length - 1].toUpperCase()}**.`)],
          components: buildButton(gameId),
        }).catch(() => null);
      }

      // PvP — switch turns
      gNow.currentTurn = gNow.currentTurn === 0 ? 1 : 0;
      const nextPlayer = getCurrentPlayer(gNow);
      startTurnTimeout(gNow);

      await submission.reply({ content: `✅ Word accepted: **${word}**`, ephemeral: true });
      return reply.edit({
        embeds: [buildEmbed(gNow, `**${nextPlayer.username}'s turn!** Start with **${word[word.length - 1].toUpperCase()}**.`)],
        components: buildButton(gameId),
      }).catch(() => null);
    } catch {
      // Modal timed out — turn timeout will handle it
    }
  });

  collector.on('end', (_, reason) => {
    if (reason === 'gameover' || reason === 'timeout') return;
    if (turnTimeout) clearTimeout(turnTimeout);
    const g = wcStore.get(gameId);
    if (g && !g.over) {
      g.over = true;
      wcStore.delete(gameId);
      if (g.wager > 0 && !g.vsBot && g.player2) {
        addToWallet(interaction.guildId, g.player1.id, g.wager).catch(() => null);
        addToWallet(interaction.guildId, g.player2.id, g.wager).catch(() => null);
      }
      reply.edit({
        embeds: [buildEmbed(g, `⏱️ **Game timed out! Chain length: ${g.chain.length}**`)],
        components: buildButton(gameId, true),
      }).catch(() => null);
    }
  });

  // Rematch collector (60s window after game ends)
  const rematchFilter = (i) =>
    i.customId === `rematch_wordchain_${gameId}` &&
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
      await startGame(i, i.user, vsBot ? null : (i.user.id === player1.id ? opponentUser : player1), true);
    } catch {
      // Rematch failed silently
    }
  });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wordchain')
    .setDescription('Play Word Chain! Each word must start with the last letter of the previous word.')
    .addUserOption((opt) =>
      opt.setName('opponent').setDescription('Challenge a user (omit to play vs bot)').setRequired(false),
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
      await startGame(interaction, interaction.user, vsBot ? null : opponent, false, wager);
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

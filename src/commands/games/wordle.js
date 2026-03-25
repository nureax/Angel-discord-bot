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

// In-memory store
const wordleStore = new Map();

// Track words player has previously won (per user) to make it harder
const playerWinHistory = new Map();

// Hard words the bot prefers to pick (uncommon but valid)
const HARD_WORDS = [
  'JAZZY', 'FIZZY', 'FUZZY', 'HAPPY', 'DADDY', 'MAMMY', 'ABBEY', 'ADZES', 'AGAVE',
  'ABHOR', 'VIVID', 'ZONAL', 'CYBER', 'QUERY', 'QUAFF', 'QUEUE', 'QUELL', 'QUIRK',
  'GLOWY', 'VIXEN', 'BOXER', 'JUICY', 'PROXY', 'EXPEL', 'KNOLL', 'BLITZ', 'BYWAY',
  'CAULK', 'CHAFE', 'CRWTH', 'DELVE', 'EPOXY', 'ETHOS', 'FAKIR', 'FJORD', 'FROZE',
  'GLYPH', 'GNARL', 'HERTZ', 'HYDRA', 'JOUST', 'KHAKI', 'KNAVE', 'KUDZU', 'LYMPH',
  'NYMPH', 'OXIDE', 'PHLOX', 'PIXIE', 'PLUMB', 'QUALM', 'RHYME', 'SCOFF', 'SHAWL',
  'SKIMP', 'SYLPH', 'TWIXT', 'USURP', 'VOILE', 'WHELP', 'XEROX', 'YIELD', 'ZLOTY',
];

// Larger valid word list for guess validation (~500 words)
const VALID_WORDS = new Set([
  // Common 5-letter words
  'ABOUT', 'ABOVE', 'ABUSE', 'ACTOR', 'ACUTE', 'ADMIT', 'ADOPT', 'ADULT', 'AFTER', 'AGAIN',
  'AGENT', 'AGREE', 'AHEAD', 'ALARM', 'ALBUM', 'ALERT', 'ALIKE', 'ALIGN', 'ALIVE', 'ALLEY',
  'ALLOW', 'ALONE', 'ALONG', 'ALTER', 'ANGEL', 'ANGER', 'ANGLE', 'ANGRY', 'ANNEX', 'ANTIC',
  'APART', 'APPLE', 'APPLY', 'APRIL', 'ARENA', 'ARGUE', 'ARISE', 'ARMOR', 'ARRAY', 'ARROW',
  'ASIDE', 'ASSET', 'ATLAS', 'ATONE', 'ATTIC', 'AUDIO', 'AUDIT', 'AVOID', 'AWAKE', 'AWARD',
  'AWARE', 'AWFUL', 'BADLY', 'BAKER', 'BASIC', 'BASIS', 'BATCH', 'BEACH', 'BEGAN', 'BEGIN',
  'BEING', 'BELOW', 'BENCH', 'BERRY', 'BIRTH', 'BLACK', 'BLADE', 'BLAME', 'BLANK', 'BLAST',
  'BLAZE', 'BLEND', 'BLESS', 'BLIND', 'BLOCK', 'BLOOD', 'BLOOM', 'BLOWN', 'BOARD', 'BONUS',
  'BOOST', 'BOUND', 'BRAVE', 'BREAD', 'BREAK', 'BREED', 'BRICK', 'BRIDE', 'BRIEF', 'BRING',
  'BROKE', 'BROOK', 'BROWN', 'BRUSH', 'BUILD', 'BUILT', 'BURST', 'BUYER', 'CABIN', 'CANDY',
  'CARRY', 'CAUSE', 'CHAIN', 'CHAIR', 'CHAOS', 'CHARM', 'CHART', 'CHASE', 'CHEAP', 'CHECK',
  'CHEEK', 'CHESS', 'CHEST', 'CHIEF', 'CHILD', 'CHINA', 'CHOIR', 'CHUNK', 'CIVIC', 'CIVIL',
  'CLAIM', 'CLASS', 'CLEAN', 'CLEAR', 'CLERK', 'CLICK', 'CLIFF', 'CLOCK', 'CLONE', 'CLOSE',
  'CLOUD', 'COACH', 'COAST', 'COBRA', 'COMET', 'COMIC', 'COMMA', 'COUCH', 'COULD', 'COUNT',
  'COURT', 'COVER', 'CRAFT', 'CRANE', 'CRASH', 'CRAZY', 'CREEK', 'CRIME', 'CRISP', 'CROSS',
  'CROWD', 'CROWN', 'CRUEL', 'CRUSH', 'CURVE', 'CYCLE', 'DAILY', 'DANCE', 'DEALS', 'DEATH',
  'DEBUT', 'DEBUT', 'DELTA', 'DEMON', 'DENSE', 'DEPOT', 'DEPTH', 'DERBY', 'DEVIL', 'DIRTY',
  'DISCO', 'DODGE', 'DOING', 'DOUBT', 'DOUGH', 'DRAFT', 'DRAIN', 'DRAMA', 'DRANK', 'DRAWL',
  'DREAM', 'DRESS', 'DRIED', 'DRIFT', 'DRINK', 'DRIVE', 'DROVE', 'DROWN', 'DUDES', 'DYING',
  'EAGLE', 'EARLY', 'EARTH', 'EIGHT', 'ELITE', 'EMAIL', 'EMPTY', 'ENEMY', 'ENJOY', 'ENTER',
  'ENTRY', 'EQUAL', 'ERROR', 'ESSAY', 'ETHIC', 'EVENT', 'EVERY', 'EXACT', 'EXIST', 'EXTRA',
  'FABLE', 'FAINT', 'FAITH', 'FALSE', 'FANCY', 'FATAL', 'FEAST', 'FENCE', 'FEVER', 'FIELD',
  'FIERY', 'FIFTH', 'FIFTY', 'FIGHT', 'FINAL', 'FIRST', 'FIXED', 'FLAME', 'FLASK', 'FLEET',
  'FLESH', 'FLOAT', 'FLOOD', 'FLOOR', 'FLORA', 'FLOUR', 'FLUID', 'FOCUS', 'FORCE', 'FORGE',
  'FORTE', 'FOUND', 'FRAME', 'FRANK', 'FRAUD', 'FRESH', 'FRONT', 'FROST', 'FROZE', 'FRUIT',
  'FUNDS', 'FUNNY', 'GHOST', 'GIVEN', 'GLAND', 'GLASS', 'GLOBE', 'GLOOM', 'GLORY', 'GLOVE',
  'GOING', 'GRACE', 'GRADE', 'GRAND', 'GRANT', 'GRASP', 'GRASS', 'GRAVE', 'GREAT', 'GREED',
  'GREEN', 'GREET', 'GRIEF', 'GRIND', 'GROAN', 'GROSS', 'GROUP', 'GROVE', 'GROWN', 'GUARD',
  'GUESS', 'GUEST', 'GUIDE', 'GUILT', 'GUISE', 'GUSTO', 'HABIT', 'HAPPY', 'HARSH', 'HASTE',
  'HAUNT', 'HEART', 'HEAVY', 'HENCE', 'HERBS', 'HEROS', 'HIKED', 'HINGE', 'HOBBY', 'HONEY',
  'HONOR', 'HOPED', 'HORSE', 'HOTEL', 'HOURS', 'HOUSE', 'HUMAN', 'HUMOR', 'IDEAL', 'IMAGE',
  'IMPLY', 'INDEX', 'INDIE', 'INNER', 'INPUT', 'INTER', 'INTRO', 'ISSUE', 'IVORY', 'JAPAN',
  'JEWEL', 'JOINT', 'JOKER', 'JOLLY', 'JUDGE', 'JUICE', 'JUMPY', 'JUROR', 'KARMA', 'KAYAK',
  'KAZOO', 'KEBAB', 'KITTY', 'KNOCK', 'KNOWN', 'LABEL', 'LABOR', 'LANCE', 'LARGE', 'LASER',
  'LATER', 'LAUGH', 'LAYER', 'LEARN', 'LEAST', 'LEAVE', 'LEGAL', 'LEMON', 'LEVEL', 'LIGHT',
  'LIMIT', 'LINED', 'LINER', 'LIVER', 'LOCAL', 'LOGIC', 'LOOSE', 'LOVER', 'LOWER', 'LUCKY',
  'LUNCH', 'LYING', 'MAGIC', 'MAJOR', 'MAKER', 'MANOR', 'MAPLE', 'MARCH', 'MATCH', 'MAYOR',
  'MEDIA', 'MERCY', 'MERIT', 'METAL', 'MIGHT', 'MINOR', 'MINUS', 'MIXED', 'MODEL', 'MONEY',
  'MONTH', 'MORAL', 'MOTOR', 'MOUNT', 'MOUSE', 'MOUTH', 'MOVED', 'MOVIE', 'MULTI', 'MUSIC',
  'NAIVE', 'NERVE', 'NEVER', 'NIGHT', 'NINJA', 'NOISE', 'NORTH', 'NOTED', 'NOVEL', 'NURSE',
  'NYMPH', 'OCEAN', 'OFFER', 'OFTEN', 'OMEGA', 'ONSET', 'OPERA', 'OPTIC', 'ORDER', 'OTHER',
  'OTTER', 'OUTER', 'OUTDO', 'OWNER', 'OZONE', 'PAINT', 'PANDA', 'PANEL', 'PANIC', 'PAPER',
  'PARTY', 'PASTA', 'PATCH', 'PAUSE', 'PEACE', 'PEACH', 'PEARL', 'PEDAL', 'PENNY', 'PHASE',
  'PHONE', 'PHOTO', 'PIANO', 'PILOT', 'PIXEL', 'PIZZA', 'PLACE', 'PLAIN', 'PLANE', 'PLANT',
  'PLATE', 'PLAZA', 'PLEAD', 'PLUCK', 'PLUMB', 'PLUMP', 'PLUNGE', 'POINT', 'POLAR', 'POPPY',
  'POSED', 'POWER', 'PRESS', 'PRICE', 'PRIDE', 'PRIME', 'PRINT', 'PRIOR', 'PRIZE', 'PROBE',
  'PRONE', 'PROOF', 'PROSE', 'PROUD', 'PROVE', 'PURGE', 'QUEEN', 'QUEST', 'QUEUE', 'QUICK',
  'QUIET', 'QUOTA', 'QUOTE', 'RADAR', 'RADIO', 'RAISE', 'RALLY', 'RANCH', 'RANGE', 'RAPID',
  'RATIO', 'REACH', 'READY', 'REALM', 'REBEL', 'REFER', 'REIGN', 'RELAX', 'REPAY', 'REPEL',
  'REPLY', 'RIDER', 'RIDGE', 'RIFLE', 'RIGHT', 'RISKY', 'RIVAL', 'RIVER', 'ROBOT', 'ROCKY',
  'ROGUE', 'ROUND', 'ROUTE', 'ROYAL', 'RULER', 'RURAL', 'SADLY', 'SAINT', 'SAUCE', 'SCALE',
  'SCARE', 'SCENE', 'SCORE', 'SCOUT', 'SEIZE', 'SENSE', 'SERVE', 'SEVEN', 'SHADE', 'SHAKE',
  'SHALL', 'SHAME', 'SHAPE', 'SHARE', 'SHARK', 'SHARP', 'SHEEP', 'SHEER', 'SHELF', 'SHELL',
  'SHIFT', 'SHINE', 'SHIRT', 'SHOCK', 'SHOOT', 'SHORE', 'SHORT', 'SHOUT', 'SHOWN', 'SIGHT',
  'SILLY', 'SINCE', 'SIXTH', 'SKILL', 'SKULL', 'SLATE', 'SLAVE', 'SLEEP', 'SLICE', 'SLIDE',
  'SLOPE', 'SMALL', 'SMART', 'SMELL', 'SMILE', 'SMOKE', 'SNEAK', 'SOLAR', 'SOLID', 'SOLVE',
  'SORRY', 'SOUND', 'SOUTH', 'SPACE', 'SPARE', 'SPARK', 'SPEAK', 'SPEED', 'SPEND', 'SPICE',
  'SPINE', 'SPITE', 'SPLIT', 'SPOOK', 'SPORT', 'SPRAY', 'SQUAD', 'STACK', 'STAFF', 'STAGE',
  'STAIN', 'STAIR', 'STAKE', 'STALE', 'STAND', 'STARE', 'START', 'STATE', 'STAYS', 'STEAK',
  'STEAL', 'STEAM', 'STEEL', 'STEEP', 'STEER', 'STERN', 'STICK', 'STIFF', 'STILL', 'STING',
  'STOCK', 'STOOD', 'STORE', 'STORM', 'STORY', 'STOVE', 'STRAP', 'STRAY', 'STRIP', 'STUCK',
  'STUDY', 'STUNT', 'STYLE', 'SUGAR', 'SUITE', 'SUNNY', 'SUPER', 'SURGE', 'SWEET', 'SWEPT',
  'SWIFT', 'SWORD', 'SWORN', 'SYRUP', 'TABLE', 'TAKEN', 'TASTE', 'TEACH', 'TENSE', 'TENTH',
  'TERMS', 'THANK', 'THEME', 'THERE', 'THICK', 'THING', 'THINK', 'THIRD', 'THOSE', 'THREE',
  'THREW', 'THROW', 'THUMB', 'TIGER', 'TIGHT', 'TIMER', 'TIRED', 'TITAN', 'TITLE', 'TODAY',
  'TOKEN', 'TOPIC', 'TORCH', 'TOTAL', 'TOUCH', 'TOUGH', 'TOWEL', 'TOWER', 'TRACK', 'TRADE',
  'TRAIL', 'TRAIN', 'TRAIT', 'TRASH', 'TREAT', 'TREND', 'TRIAL', 'TRIBE', 'TRIED', 'TRICK',
  'TROOP', 'TRUCK', 'TRULY', 'TRUNK', 'TRUTH', 'TULIP', 'TUNER', 'TUTOR', 'TWICE', 'TWIST',
  'UNDER', 'UNION', 'UNITE', 'UNITY', 'UNTIL', 'UPPER', 'UPSET', 'URBAN', 'USAGE', 'USING',
  'USUAL', 'USURP', 'UTTER', 'VAGUE', 'VALID', 'VALUE', 'VALVE', 'VAPOR', 'VAULT', 'VERSE',
  'VIDEO', 'VIGOR', 'VIRAL', 'VIRUS', 'VISIT', 'VISTA', 'VITAL', 'VOCAL', 'VOICE', 'VOTER',
  'OUTER', 'WALTZ', 'WASTE', 'WATCH', 'WATER', 'WEARY', 'WEAVE', 'WEDGE', 'WEIGH', 'WEIRD',
  'WHALE', 'WHEAT', 'WHEEL', 'WHERE', 'WHICH', 'WHILE', 'WHITE', 'WHOLE', 'WHOSE', 'WIDER',
  'WITCH', 'WOMAN', 'WOMEN', 'WORLD', 'WORRY', 'WORST', 'WORTH', 'WOULD', 'WOUND', 'WRATH',
  'WRITE', 'WRONG', 'WROTE', 'YACHT', 'YEARN', 'YOUNG', 'YOURS', 'YOUTH', 'ZEBRA', 'ZONAL',
  // Hard words also valid
  ...HARD_WORDS,
]);

function pickWord(userId) {
  // Prefer words the player hasn't won with before
  const won = playerWinHistory.get(userId) || new Set();
  const unplayed = HARD_WORDS.filter((w) => !won.has(w));
  const pool = unplayed.length > 5 ? unplayed : HARD_WORDS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function evaluateGuess(guess, answer) {
  const result = Array(5).fill('⬛');
  const answerArr = answer.split('');
  const guessArr = guess.split('');
  const used = Array(5).fill(false);

  // First pass: correct positions
  for (let i = 0; i < 5; i++) {
    if (guessArr[i] === answerArr[i]) {
      result[i] = '🟩';
      used[i] = true;
      guessArr[i] = null;
    }
  }
  // Second pass: wrong position
  for (let i = 0; i < 5; i++) {
    if (guessArr[i] === null) continue;
    for (let j = 0; j < 5; j++) {
      if (!used[j] && guessArr[i] === answerArr[j]) {
        result[i] = '🟨';
        used[j] = true;
        break;
      }
    }
  }
  return result;
}

function buildKeyboard(guesses, results) {
  const letterState = {};
  for (let g = 0; g < guesses.length; g++) {
    for (let i = 0; i < 5; i++) {
      const letter = guesses[g][i];
      const r = results[g][i];
      if (r === '🟩') letterState[letter] = '🟩';
      else if (r === '🟨' && letterState[letter] !== '🟩') letterState[letter] = '🟨';
      else if (!letterState[letter]) letterState[letter] = '⬛';
    }
  }
  const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  return rows.map((row) =>
    row.split('').map((l) => `${letterState[l] || '⬜'}${l}`).join(' '),
  ).join('\n');
}

function buildEmbed(game) {
  const guessLines = game.guesses.map((g, idx) =>
    `${game.results[idx].join('')}  \`${g}\``,
  );
  const remaining = 6 - game.guesses.length;
  const remaining_line = Array(remaining).fill('⬜⬜⬜⬜⬜').join('\n');

  return new EmbedBuilder()
    .setTitle('🟩 Wordle')
    .setDescription(
      (guessLines.length ? guessLines.join('\n') : '') +
      (remaining > 0 && guessLines.length > 0 ? '\n' : '') +
      remaining_line +
      '\n\n**Keyboard:**\n' + buildKeyboard(game.guesses, game.results) +
      (game.statusText ? `\n\n${game.statusText}` : ''),
    )
    .setColor(game.over
      ? (game.won ? config.colors.success : config.colors.error)
      : config.colors.primary)
    .setFooter({ text: `Angel Bot • Wordle | Guesses: ${game.guesses.length}/6` })
    .setTimestamp();
}

function buildGuessButton(gameId, disabled = false) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`wordle_${gameId}_guess`)
      .setLabel('✏️ Guess a Word')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),
  )];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wordle')
    .setDescription('Play Wordle! Guess the 5-letter word in 6 tries.')
    .setDMPermission(false),

  async execute(interaction) {
    const gameId = interaction.id;
    const word = pickWord(interaction.user.id);

    const game = {
      id: gameId,
      player: interaction.user,
      word,
      guesses: [],
      results: [],
      over: false,
      won: false,
      statusText: '',
    };
    wordleStore.set(gameId, game);

    const reply = await interaction.reply({
      embeds: [buildEmbed(game)],
      components: buildGuessButton(gameId),
      fetchReply: true,
    });

    const filter = (i) =>
      i.user.id === game.player.id && i.customId === `wordle_${gameId}_guess`;

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter,
      time: 300000,
    });

    collector.on('collect', async (i) => {
      const g = wordleStore.get(gameId);
      if (!g || g.over) return;

      const modal = new ModalBuilder()
        .setCustomId(`wordle_modal_${gameId}`)
        .setTitle('Wordle — Enter Your Guess');

      const input = new TextInputBuilder()
        .setCustomId('guess_input')
        .setLabel('Enter a 5-letter word')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g. CRANE')
        .setMinLength(5)
        .setMaxLength(5)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(input));
      await i.showModal(modal);

      try {
        const submission = await i.awaitModalSubmit({
          filter: (mi) => mi.customId === `wordle_modal_${gameId}` && mi.user.id === g.player.id,
          time: 60000,
        });

        const gNow = wordleStore.get(gameId);
        if (!gNow || gNow.over) {
          return submission.reply({ content: 'The game has already ended.', ephemeral: true });
        }

        const guess = submission.fields.getTextInputValue('guess_input').trim().toUpperCase();

        if (guess.length !== 5 || !/^[A-Z]{5}$/.test(guess)) {
          return submission.reply({ content: 'Please enter a valid 5-letter word (letters only).', ephemeral: true });
        }

        if (!VALID_WORDS.has(guess)) {
          return submission.reply({ content: `**${guess}** is not in the word list. Try again!`, ephemeral: true });
        }

        const result = evaluateGuess(guess, gNow.word);
        gNow.guesses.push(guess);
        gNow.results.push(result);

        const isWin = result.every((r) => r === '🟩');

        if (isWin) {
          gNow.over = true;
          gNow.won = true;
          gNow.statusText = `🎉 **You got it in ${gNow.guesses.length} ${gNow.guesses.length === 1 ? 'try' : 'tries'}!**`;
          const won = playerWinHistory.get(gNow.player.id) || new Set();
          won.add(gNow.word);
          playerWinHistory.set(gNow.player.id, won);
          wordleStore.delete(gameId);
          collector.stop('gameover');
          await submission.reply({ content: '✅ Correct!', ephemeral: true });
          return reply.edit({
            embeds: [buildEmbed(gNow)],
            components: buildGuessButton(gameId, true),
          }).catch(() => null);
        }

        if (gNow.guesses.length >= 6) {
          gNow.over = true;
          gNow.won = false;
          gNow.statusText = `💀 **Game over! The word was \`${gNow.word}\`.**`;
          wordleStore.delete(gameId);
          collector.stop('gameover');
          await submission.reply({ content: `❌ Not quite. The word was **${gNow.word}**.`, ephemeral: true });
          return reply.edit({
            embeds: [buildEmbed(gNow)],
            components: buildGuessButton(gameId, true),
          }).catch(() => null);
        }

        await submission.reply({ content: `Guess recorded! ${6 - gNow.guesses.length} tries remaining.`, ephemeral: true });
        return reply.edit({
          embeds: [buildEmbed(gNow)],
          components: buildGuessButton(gameId),
        }).catch(() => null);
      } catch {
        // Modal timed out
      }
    });

    collector.on('end', (_, reason) => {
      if (reason === 'gameover') return;
      const g = wordleStore.get(gameId);
      if (g && !g.over) {
        g.over = true;
        g.statusText = `⏱️ **Timed out! The word was \`${g.word}\`.**`;
        wordleStore.delete(gameId);
        reply.edit({
          embeds: [buildEmbed(g)],
          components: buildGuessButton(gameId, true),
        }).catch(() => null);
      }
    });
  },
};

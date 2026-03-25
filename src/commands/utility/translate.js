'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { createBaseEmbed, errorEmbed } = require('../../utils/embed');
const { config } = require('../../../config');
const logger = require('../../utils/logger');

const LANGUAGE_CHOICES = [
  { name: 'English', value: 'en' },
  { name: 'Spanish', value: 'es' },
  { name: 'French', value: 'fr' },
  { name: 'German', value: 'de' },
  { name: 'Japanese', value: 'ja' },
  { name: 'Korean', value: 'ko' },
  { name: 'Chinese', value: 'zh' },
  { name: 'Portuguese', value: 'pt' },
  { name: 'Italian', value: 'it' },
  { name: 'Russian', value: 'ru' },
  { name: 'Arabic', value: 'ar' },
  { name: 'Hindi', value: 'hi' },
];

/** Returns the display name for a language code. */
function langName(code) {
  return LANGUAGE_CHOICES.find((l) => l.value === code)?.name ?? code;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('translate')
    .setDescription('Translate text between languages')
    .addStringOption((opt) =>
      opt
        .setName('text')
        .setDescription('Text to translate (max 500 characters)')
        .setRequired(true)
        .setMaxLength(500),
    )
    .addStringOption((opt) => {
      opt
        .setName('to')
        .setDescription('Target language')
        .setRequired(true);
      for (const lang of LANGUAGE_CHOICES) opt.addChoices(lang);
      return opt;
    })
    .addStringOption((opt) => {
      opt
        .setName('from')
        .setDescription('Source language (leave blank for auto-detect)')
        .setRequired(false);
      for (const lang of LANGUAGE_CHOICES) opt.addChoices(lang);
      return opt;
    })
    .setDMPermission(false),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const text = interaction.options.getString('text');
      const toLang = interaction.options.getString('to');
      const fromLang = interaction.options.getString('from'); // may be null

      const langpair = fromLang ? `${fromLang}|${toLang}` : `autodetect|${toLang}`;
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`;

      let data;
      try {
        const res = await fetch(url);
        data = await res.json();
      } catch (fetchErr) {
        logger.error('Translate API fetch error:', fetchErr);
        return interaction.editReply({
          embeds: [errorEmbed('API Error', 'Could not reach the translation API. Please try again later.')],
        });
      }

      if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
        const apiMsg = data.responseDetails ?? 'Unknown error from translation API.';
        logger.warn('Translate API non-200 response:', data);
        return interaction.editReply({
          embeds: [errorEmbed('Translation Failed', `The translation API returned an error: ${apiMsg}`)],
        });
      }

      const translated = data.responseData.translatedText;

      // MyMemory sometimes returns the raw text unchanged with an error note
      // when rate-limited — detect and surface that.
      if (translated.toUpperCase().includes('MYMEMORY WARNING')) {
        return interaction.editReply({
          embeds: [errorEmbed('Rate Limited', 'The free translation API has been rate-limited. Please wait a moment and try again.')],
        });
      }

      const fromDisplay = fromLang ? langName(fromLang) : 'Auto-detect';
      const toDisplay = langName(toLang);

      const embed = createBaseEmbed(config.colors.primary)
        .setTitle('🌐 Translation')
        .addFields(
          { name: `📝 Original (${fromDisplay})`, value: `\`\`\`${text.slice(0, 1020)}\`\`\`` },
          { name: `🔤 Translated (${toDisplay})`, value: `\`\`\`${translated.slice(0, 1020)}\`\`\`` },
        );

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error('Translate command error:', err);
      const errEmbed = errorEmbed('Error', 'An unexpected error occurred during translation.');
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [errEmbed] }).catch(() => null);
      } else {
        await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
      }
    }
  },
};

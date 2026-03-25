'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { config } = require('../../../config');
const { errorEmbed } = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display a list of all available commands')
    .addStringOption((opt) =>
      opt
        .setName('command')
        .setDescription('Get detailed help for a specific command')
        .setRequired(false),
    ),

  async execute(interaction) {
    try {
      const commandName = interaction.options.getString('command');

      if (commandName) {
        // Detailed help for a single command
        const command = interaction.client.commands.get(commandName.toLowerCase());
        if (!command) {
          return interaction.reply({
            content: `No command found with name \`${commandName}\`. Use \`/help\` to see all commands.`,
            ephemeral: true,
          });
        }

        const embed = new EmbedBuilder()
          .setColor(config.colors.primary)
          .setTitle(`/${command.data.name}`)
          .setDescription(command.data.description ?? 'No description provided.')
          .setTimestamp()
          .setFooter({ text: 'Angel Bot' });

        if (command.data.options?.length > 0) {
          const optionLines = command.data.options.map((opt) => {
            // type 1 = SUB_COMMAND, type 2 = SUB_COMMAND_GROUP
            if (opt.type === 1 || opt.type === 2) {
              return `\`${opt.name}\` — ${opt.description} *(subcommand)*`;
            }
            const required = opt.required ? '*(required)*' : '*(optional)*';
            return `\`${opt.name}\` — ${opt.description} ${required}`;
          });
          embed.addFields({ name: 'Options', value: optionLines.join('\n') });
        }

        return interaction.reply({ embeds: [embed] });
      }

      // Full command list grouped by category
      const categories = new Map();
      for (const command of interaction.client.commands.values()) {
        // Determine category from the command file path stored on the module
        // Fallback: read from the command's category property or default to "Other"
        const category = command.category || 'Other';
        if (!categories.has(category)) categories.set(category, []);
        categories.get(category).push(command);
      }

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle('📖 Angel Bot — Command List')
        .setDescription('Use `/help <command>` for detailed information about a specific command.')
        .setTimestamp()
        .setFooter({ text: 'Angel Bot' });

      for (const [cat, cmds] of categories) {
        const lines = cmds.map((c) => `\`/${c.data.name}\` — ${c.data.description}`);
        let value = lines.join('\n');
        if (value.length > 1000) {
          // Truncate to fit Discord's 1024-char field value limit
          let truncated = '';
          for (const line of lines) {
            if ((truncated + '\n' + line).length > 1000) break;
            truncated += (truncated ? '\n' : '') + line;
          }
          value = truncated + '\n...and more';
        }
        embed.addFields({
          name: `__${capitalize(cat)}__`,
          value,
        });
      }

      return interaction.reply({ embeds: [embed] });
    } catch (error) {
      const errEmbed = errorEmbed('Error', 'An unexpected error occurred. Please try again later.');
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [errEmbed] });
      } else {
        await interaction.reply({ embeds: [errEmbed], ephemeral: true });
      }
    }
  },
};

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

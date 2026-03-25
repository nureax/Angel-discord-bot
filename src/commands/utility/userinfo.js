'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { config } = require('../../../config');
const { errorEmbed } = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Display information about a user')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('The user to look up (defaults to yourself)').setRequired(false),
    ),

  async execute(interaction) {
    try {
      const target = interaction.options.getUser('user') ?? interaction.user;
      const member = await interaction.guild?.members.fetch(target.id).catch(() => null);

      const flags = target.flags?.toArray() ?? [];
      const flagEmojis = {
        Staff: '👨‍💼 Discord Staff',
        Partner: '🤝 Discord Partner',
        Hypesquad: '🏠 HypeSquad Events',
        BugHunterLevel1: '🐛 Bug Hunter',
        BugHunterLevel2: '🏅 Bug Hunter Level 2',
        HypeSquadOnlineHouse1: '🏅 HypeSquad Bravery',
        HypeSquadOnlineHouse2: '🏅 HypeSquad Brilliance',
        HypeSquadOnlineHouse3: '🏅 HypeSquad Balance',
        PremiumEarlySupporter: '💎 Early Supporter',
        VerifiedBotDeveloper: '🤖 Verified Bot Dev',
        ActiveDeveloper: '🛠️ Active Developer',
      };

      const badgeList = flags.map((f) => flagEmojis[f]).filter(Boolean);

      const embed = new EmbedBuilder()
        .setColor(member?.displayHexColor || config.colors.primary)
        .setTitle(`👤 ${target.tag}`)
        .setThumbnail(target.displayAvatarURL({ extension: 'gif', forceStatic: false, size: 256 }))
        .addFields(
          { name: '🆔 User ID', value: target.id, inline: true },
          { name: '🤖 Bot?', value: target.bot ? 'Yes' : 'No', inline: true },
          { name: '📅 Account Created', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:D>`, inline: true },
        )
        .setTimestamp()
        .setFooter({ text: 'Angel Bot' });

      if (member) {
        embed.addFields(
          { name: '🎭 Nickname', value: member.nickname ?? 'None', inline: true },
          { name: '📥 Joined Server', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>` : 'Unknown', inline: true },
          {
            name: '🏷️ Roles',
            value:
              member.roles.cache.size > 1
                ? member.roles.cache
                    .filter((r) => r.id !== interaction.guild.id)
                    .sort((a, b) => b.position - a.position)
                    .map((r) => r.toString())
                    .slice(0, 10)
                    .join(', ')
                : 'None',
            inline: false,
          },
        );
      }

      if (badgeList.length > 0) {
        embed.addFields({ name: '🏆 Badges', value: badgeList.join('\n'), inline: false });
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

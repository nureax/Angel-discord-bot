'use strict';

const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { config } = require('../../../config');
const { errorEmbed } = require('../../utils/embed');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('Display detailed information about this server'),

  async execute(interaction) {
    try {
      const guild = interaction.guild;
      if (!guild) {
        return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      }

      // Fetch full guild data (member counts etc.)
      await guild.fetch();

      const owner = await guild.fetchOwner().catch(() => null);
      const channels = guild.channels.cache;

      const textChannels = channels.filter((c) => c.type === ChannelType.GuildText).size;
      const voiceChannels = channels.filter((c) => c.type === ChannelType.GuildVoice).size;
      const categoryChannels = channels.filter((c) => c.type === ChannelType.GuildCategory).size;
      const roles = guild.roles.cache.size - 1; // exclude @everyone

      const verificationLevels = ['None', 'Low', 'Medium', 'High', 'Very High'];

      const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(`📊 ${guild.name}`)
        .setThumbnail(guild.iconURL({ extension: 'gif', forceStatic: false }))
        .addFields(
          { name: '🆔 Server ID', value: guild.id, inline: true },
          { name: '👑 Owner', value: owner ? `${owner.user.tag}` : 'Unknown', inline: true },
          { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
          { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
          { name: '🤖 Bots', value: `${guild.members.cache.filter((m) => m.user.bot).size}`, inline: true },
          { name: '🎭 Roles', value: `${roles}`, inline: true },
          { name: '💬 Text Channels', value: `${textChannels}`, inline: true },
          { name: '🔊 Voice Channels', value: `${voiceChannels}`, inline: true },
          { name: '📁 Categories', value: `${categoryChannels}`, inline: true },
          { name: '🔒 Verification', value: verificationLevels[guild.verificationLevel] ?? 'Unknown', inline: true },
          { name: '🚀 Boost Level', value: `Level ${guild.premiumTier} (${guild.premiumSubscriptionCount} boosts)`, inline: true },
          { name: '🌐 Region', value: guild.preferredLocale, inline: true },
        )
        .setTimestamp()
        .setFooter({ text: 'Angel Bot' });

      if (guild.bannerURL()) {
        embed.setImage(guild.bannerURL({ size: 1024 }));
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

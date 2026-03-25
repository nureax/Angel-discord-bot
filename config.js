'use strict';

require('dotenv').config();

const config = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID || null,
  prefix: process.env.PREFIX || '!', // Reserved for future prefix command support
  logLevel: process.env.LOG_LEVEL || 'info',

  // Color palette used across embeds
  colors: {
    primary: 0x7c3aed,   // purple
    success: 0x22c55e,   // green
    warning: 0xf59e0b,   // amber
    error: 0xef4444,     // red
    info: 0x3b82f6,      // blue
    neutral: 0x6b7280,   // gray
  },

  // Moderation settings
  moderation: {
    // Default mute duration in minutes (used when no duration is provided)
    defaultMuteDuration: 10,
    // Maximum warn count before auto-action
    maxWarns: 3,
    automod: {
      spamThreshold: 5,
      spamWindowMs: 5000,
    },
  },

  // Reminder settings
  reminder: {
    // Maximum reminder duration in minutes
    maxDurationMinutes: 10080, // 7 days
  },

  // XP / leveling settings
  xp: {
    minPerMessage: 15,
    maxPerMessage: 25,
    cooldownSeconds: 60,
  },
};

// Validate required config
function validateConfig() {
  const missing = [];
  if (!config.token) missing.push('DISCORD_TOKEN');
  if (!config.clientId) missing.push('CLIENT_ID');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = { config, validateConfig };

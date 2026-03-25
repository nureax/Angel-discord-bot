'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { createBaseEmbed, errorEmbed } = require('../../utils/embed');
const { config } = require('../../../config');
const logger = require('../../utils/logger');

/**
 * Maps an Open-Meteo WMO weather code to a human-readable description.
 * @param {number} code
 * @returns {string}
 */
function describeWeatherCode(code) {
  if (code === 0) return 'Clear Sky ☀️';
  if (code >= 1 && code <= 3) return 'Partly Cloudy ⛅';
  if (code >= 45 && code <= 48) return 'Foggy 🌫️';
  if (code >= 51 && code <= 67) return 'Drizzle/Rain 🌧️';
  if (code >= 71 && code <= 77) return 'Snow 🌨️';
  if (code >= 80 && code <= 82) return 'Rain Showers 🌦️';
  if (code >= 95 && code <= 99) return 'Thunderstorm ⛈️';
  return 'Unknown 🌡️';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get current weather for a city')
    .addStringOption((opt) =>
      opt
        .setName('city')
        .setDescription('City name (e.g. London, New York, Tokyo)')
        .setRequired(true),
    )
    .setDMPermission(false),

  async execute(interaction) {
    try {
      await interaction.deferReply();

      const city = interaction.options.getString('city').trim();

      // Step 1 — Geocode the city name
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`;

      let geoData;
      try {
        const geoRes = await fetch(geoUrl);
        geoData = await geoRes.json();
      } catch (fetchErr) {
        logger.error('Weather geocoding fetch error:', fetchErr);
        return interaction.editReply({
          embeds: [errorEmbed('API Error', 'Could not reach the geocoding API. Please try again later.')],
        });
      }

      if (!geoData.results || geoData.results.length === 0) {
        return interaction.editReply({
          embeds: [errorEmbed('City Not Found', `No location found for **${city}**. Please check the spelling and try again.`)],
        });
      }

      const location = geoData.results[0];
      const { latitude, longitude, name, country, admin1 } = location;

      if (typeof latitude !== 'number' || !isFinite(latitude) || typeof longitude !== 'number' || !isFinite(longitude)) {
        return interaction.editReply({
          embeds: [errorEmbed('Location Error', 'Could not retrieve coordinates for that location.')],
        });
      }

      // Step 2 — Fetch weather data
      const weatherUrl =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,apparent_temperature` +
        `&temperature_unit=fahrenheit&wind_speed_unit=mph`;

      let weatherData;
      try {
        const weatherRes = await fetch(weatherUrl);
        weatherData = await weatherRes.json();
      } catch (fetchErr) {
        logger.error('Weather forecast fetch error:', fetchErr);
        return interaction.editReply({
          embeds: [errorEmbed('API Error', 'Could not reach the weather API. Please try again later.')],
        });
      }

      if (!weatherData.current) {
        return interaction.editReply({
          embeds: [errorEmbed('Weather Unavailable', 'Weather data is not available for this location right now.')],
        });
      }

      const {
        temperature_2m: temp,
        apparent_temperature: feelsLike,
        relative_humidity_2m: humidity,
        wind_speed_10m: windSpeed,
        weather_code: weatherCode,
      } = weatherData.current;

      const condition = describeWeatherCode(weatherCode);

      // Build display name: "Name, Region, Country" or "Name, Country"
      const locationParts = [name];
      if (admin1 && admin1 !== name) locationParts.push(admin1);
      if (country) locationParts.push(country);
      const displayName = locationParts.join(', ');

      const embed = createBaseEmbed(config.colors.info)
        .setTitle(`🌍 Weather — ${displayName}`)
        .setDescription(`**Condition:** ${condition}`)
        .addFields(
          { name: '🌡️ Temperature', value: `${Math.round(temp)}°F`, inline: true },
          { name: '🤔 Feels Like', value: `${Math.round(feelsLike)}°F`, inline: true },
          { name: '💧 Humidity', value: `${humidity}%`, inline: true },
          { name: '💨 Wind Speed', value: `${Math.round(windSpeed)} mph`, inline: true },
          { name: '📍 Coordinates', value: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`, inline: true },
        );

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      logger.error('Weather command error:', err);
      const errEmbed = errorEmbed('Error', 'An unexpected error occurred while fetching weather data.');
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ embeds: [errEmbed] }).catch(() => null);
      } else {
        await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => null);
      }
    }
  },
};

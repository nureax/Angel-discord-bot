'use strict';

const { config } = require('../../config');

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const LEVEL_COLORS = {
  error: '\x1b[31m', // red
  warn: '\x1b[33m',  // yellow
  info: '\x1b[36m',  // cyan
  debug: '\x1b[35m', // magenta
};

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

/**
 * Returns a formatted ISO timestamp string.
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Structured logger with level filtering and colorized output.
 */
const logger = {
  _currentLevel: LOG_LEVELS[config.logLevel] ?? LOG_LEVELS.info,

  _log(level, message, ...args) {
    if (LOG_LEVELS[level] > this._currentLevel) return;

    const color = LEVEL_COLORS[level] || '';
    const timestamp = getTimestamp();
    const prefix = `${BOLD}[${timestamp}]${RESET} ${color}${BOLD}[${level.toUpperCase()}]${RESET}`;

    if (args.length > 0) {
      console[level === 'debug' ? 'log' : level](`${prefix} ${message}`, ...args);
    } else {
      console[level === 'debug' ? 'log' : level](`${prefix} ${message}`);
    }
  },

  error(message, ...args) { this._log('error', message, ...args); },
  warn(message, ...args)  { this._log('warn',  message, ...args); },
  info(message, ...args)  { this._log('info',  message, ...args); },
  debug(message, ...args) { this._log('debug', message, ...args); },
};

module.exports = logger;

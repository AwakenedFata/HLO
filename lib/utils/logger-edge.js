/**
 * Logger khusus untuk Edge Runtime (middleware.js)
 * Kompatibel dengan Edge Runtime yang tidak mendukung Winston
 */

// Definisikan level log
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
}

// Ambil level log dari environment variable atau default ke INFO
const currentLogLevel = process.env.LOG_LEVEL
  ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] || LOG_LEVELS.INFO
  : LOG_LEVELS.INFO

/**
 * Format pesan log dengan timestamp
 */
const formatLogMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString()
  const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ""
  return `[${timestamp}] [${level}] ${message}${metaString}`
}

/**
 * Log ke console jika level log saat ini memungkinkan
 */
const log = (level, levelValue, message, meta = {}) => {
  if (levelValue <= currentLogLevel) {
    const formattedMessage = formatLogMessage(level, message, meta)

    switch (level) {
      case "ERROR":
        console.error(formattedMessage)
        break
      case "WARN":
        console.warn(formattedMessage)
        break
      case "INFO":
        console.info(formattedMessage)
        break
      case "DEBUG":
        console.debug(formattedMessage)
        break
      default:
        console.log(formattedMessage)
    }
  }
}

// Ekspor fungsi logger dengan API yang mirip Winston
const logger = {
  error: (message, meta = {}) => log("ERROR", LOG_LEVELS.ERROR, message, meta),
  warn: (message, meta = {}) => log("WARN", LOG_LEVELS.WARN, message, meta),
  info: (message, meta = {}) => log("INFO", LOG_LEVELS.INFO, message, meta),
  debug: (message, meta = {}) => log("DEBUG", LOG_LEVELS.DEBUG, message, meta),
}

export default logger

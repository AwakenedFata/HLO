'use client';

// Simple client-side logger that mimics winston's API
const logger = {
  info: (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[INFO]', ...args)
    }
  },
  warn: (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[WARN]', ...args)
    }
  },
  error: (...args) => {
    console.error('[ERROR]', ...args)
  },
  debug: (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[DEBUG]', ...args)
    }
  },
}

export default logger
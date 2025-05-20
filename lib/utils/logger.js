// Isomorphic logger that works in both client and server environments
const isServer = typeof window === 'undefined'

// Import the appropriate logger based on environment
const logger = isServer 
  ? require('./logger-server').default 
  : require('./logger-client').default

export default logger
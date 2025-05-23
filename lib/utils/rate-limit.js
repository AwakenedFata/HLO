/**
 * Simple rate limiting utility for API routes and middleware
 * Compatible with both Node.js and Edge runtimes
 */

export function rateLimit({
  interval,
  uniqueTokenPerInterval = 500,
  limit,
  identifier = "global",
}) {
  const tokenCache = new Map();

  // Clean up old entries periodically
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    const windowStart = Math.floor(now / interval) * interval;

    for (const [key, timestamp] of tokenCache.entries()) {
      if (timestamp < windowStart) {
        tokenCache.delete(key);
      }
    }
  }, interval);

  // Node.js: allow process to exit naturally
  if (
    typeof process !== "undefined" &&
    typeof process.release !== "undefined" &&
    process.release.name === "node" &&
    typeof cleanupInterval.unref === "function"
  ) {
    cleanupInterval.unref();
  }

  return {
    check: async (token, customLimit = limit) => {
      const now = Date.now();
      const routeKey = typeof identifier === "function" ? identifier() : identifier;
      const windowKey = `${token}:${routeKey}:${Math.floor(now / interval)}`;

      const tokenCount = (tokenCache.get(windowKey) || 0) + 1;
      tokenCache.set(windowKey, tokenCount);

      const remaining = Math.max(0, customLimit - tokenCount);
      const reset = interval - (now % interval);
      const success = tokenCount <= customLimit;

      if (!success) {
        console.warn(`[RATE LIMIT] ${windowKey} exceeded limit (${customLimit})`);
        const error = new Error("Rate limit exceeded");
        error.statusCode = 429;
        throw error;
      }

      return {
        success,
        limit: customLimit,
        remaining,
        reset: Math.ceil(reset / 1000),
      };
    },
  };
}

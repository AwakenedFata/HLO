// File: /lib/redis.js

import Redis from 'ioredis';
import logger from '@/lib/utils/logger';

// Gunakan environment variable untuk konfigurasi Redis
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redis;

// Fungsi untuk mendapatkan Redis client
export function getRedisClient() {
  if (redis) {
    return redis;
  }

  try {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      connectTimeout: 10000,
    });

    redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    redis.on('error', (err) => {
      logger.error('Redis connection error:', err);
    });

    redis.on('reconnecting', () => {
      logger.warn('Redis reconnecting...');
    });

    return redis;
  } catch (error) {
    logger.error('Failed to initialize Redis client:', error);
    return null;
  }
}

// Fungsi untuk menyimpan data ke cache
export async function setCache(key, data, expireSeconds = 300) {
  const client = getRedisClient();
  if (!client) return false;

  try {
    await client.set(key, JSON.stringify(data), 'EX', expireSeconds);
    return true;
  } catch (error) {
    logger.error(`Error setting Redis cache for key ${key}:`, error);
    return false;
  }
}

// Fungsi untuk mengambil data dari cache
export async function getCache(key) {
  const client = getRedisClient();
  if (!client) return null;

  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error(`Error getting Redis cache for key ${key}:`, error);
    return null;
  }
}

// Fungsi untuk menghapus cache
export async function deleteCache(key) {
  const client = getRedisClient();
  if (!client) return false;

  try {
    await client.del(key);
    return true;
  } catch (error) {
    logger.error(`Error deleting Redis cache for key ${key}:`, error);
    return false;
  }
}

// Fungsi untuk menghapus cache dengan pattern
export async function deleteCachePattern(pattern) {
  const client = getRedisClient();
  if (!client) return false;

  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
    return true;
  } catch (error) {
    logger.error(`Error deleting Redis cache with pattern ${pattern}:`, error);
    return false;
  }
}

// Fungsi untuk invalidasi cache saat data berubah
export async function invalidateCache(type) {
  switch (type) {
    case 'pins':
      await deleteCachePattern('pins:*');
      await deleteCachePattern('dashboard:*');
      await deleteCachePattern('pending:*');
      break;
    case 'pending':
      await deleteCachePattern('pending:*');
      await deleteCachePattern('dashboard:*');
      break;
    case 'redemptions':
      await deleteCachePattern('redemptions:*');
      break;
    case 'all':
      await deleteCachePattern('*');
      break;
    default:
      break;
  }
}
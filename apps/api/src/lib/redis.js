// =============================================================================
// src/lib/redis.js
// =============================================================================
// Singleton del Redis client (ioredis). In Fase 1c usato solo per
// healthcheck (PING); in Fase 1e+ servirà per session store, rate
// limiting, queue.
//
// Connessione lazy: ioredis non si connette finché non viene fatta la
// prima operazione. retryStrategy con backoff esponenziale, max 5
// tentativi prima di rinunciare per evitare riconnessioni infinite in
// loop se Redis è giù.
// =============================================================================

import { Redis } from 'ioredis';
import { config } from '../config.js';

export const redis = new Redis(config.redis.url, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 5) return null; // dopo 5 tentativi smetti
    return Math.min(times * 500, 5000); // 500ms, 1s, 1.5s, 2s, 2.5s
  },
  reconnectOnError(err) {
    // Riconnetti solo su errori transitori (es. cluster failover)
    return err.message.includes('READONLY');
  },
});

/**
 * Aggancia gli eventi Redis al logger Fastify.
 */
export function attachRedisLogging(redisInstance, fastifyLogger) {
  redisInstance.on('connect', () => fastifyLogger.info('redis connected'));
  redisInstance.on('ready', () => fastifyLogger.debug('redis ready'));
  redisInstance.on('error', (err) => fastifyLogger.error({ err }, 'redis error'));
  redisInstance.on('close', () => fastifyLogger.warn('redis connection closed'));
}

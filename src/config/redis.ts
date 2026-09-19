import IORedis from 'ioredis';
import { env } from './env';

// BullMQ requires this specific option on the connection it's handed.
// One connection is created per process (API process and worker process
// each construct their own via this factory) — do not share a single
// instance across the two processes, they are separate deployables.
export function createRedisConnection(): IORedis {
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}

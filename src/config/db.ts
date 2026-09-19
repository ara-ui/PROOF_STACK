import mongoose from 'mongoose';
import { env } from './env';

// Phase 0 decision, enforced here rather than left to per-model discipline:
// no client-supplied filter object should ever reach a Mongo query
// unvalidated. This is defence in depth for Phase 3+; harmless now since
// Phase 1 only ever queries by hardcoded/known IDs.
mongoose.set('sanitizeFilter', true);
mongoose.set('strictQuery', true);

let connected = false;

export async function connectMongo(): Promise<typeof mongoose> {
  if (connected) return mongoose;

  // autoIndex left on for Phase 1 (local dev, single seeded challenge).
  // Turn this off and run an explicit `syncIndexes` script before this
  // matters for production data volume — noted for a later phase, not
  // acted on here since it would be scope creep for Phase 1.
  await mongoose.connect(env.MONGO_URI);
  connected = true;
  // eslint-disable-next-line no-console
  console.log(`[mongo] connected: ${env.MONGO_URI}`);
  return mongoose;
}

export async function disconnectMongo(): Promise<void> {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
}

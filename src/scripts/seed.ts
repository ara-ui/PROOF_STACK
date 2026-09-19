import fs from 'node:fs';
import path from 'node:path';
import { connectMongo, disconnectMongo } from '../config/db';
import { Challenge } from '../models/Challenge';

interface SeedChallenge {
  slug: string;
  title: string;
  description: string;
  difficulty: number;
  language: string;
  starterCode: string;
  timeLimitMs: number;
  skills: unknown[];
  isPublished: boolean;
  testCases: { input: string; expectedOutput: string; isHidden: boolean }[];
}

async function main() {
  const filePath = path.resolve(__dirname, '../../seed/challenges.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const challenges: SeedChallenge[] = JSON.parse(raw);

  await connectMongo();

  for (const challenge of challenges) {
    // Upsert by slug so re-running the seed script is safe (idempotent),
    // consistent with the Phase 1 rule that the only lookups used are by
    // known identifiers — here, the slug acts as that stable identifier.
    await Challenge.findOneAndUpdate({ slug: challenge.slug }, challenge, {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    });
    // eslint-disable-next-line no-console
    console.log(`[seed] upserted challenge: ${challenge.slug}`);
  }

  await disconnectMongo();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[seed] failed', err);
  process.exit(1);
});

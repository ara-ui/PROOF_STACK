import express from 'express';
import { env } from './config/env';
import { connectMongo } from './config/db';
import { submissionRouter } from './routes/submission.routes';
import { errorHandler } from './middleware/errorHandler';

async function main() {
  await connectMongo();

  const app = express();
  app.use(express.json({ limit: '256kb' })); // headroom above the 64KB source cap

  app.get('/health', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.use('/api', submissionRouter);

  app.use(errorHandler);

  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[api] listening on :${env.PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[api] fatal startup error', err);
  process.exit(1);
});

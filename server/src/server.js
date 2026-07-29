import 'dotenv/config';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { initIO } from './sockets/index.js';
import { logger } from './utils/logger.js';

const PORT = process.env.PORT || 5000;

async function main() {
  await connectDB();

  const app = createApp();
  const httpServer = createServer(app);
  initIO(httpServer);

  httpServer.listen(PORT, () => {
    logger.info(`Pairagraph server listening on port ${PORT}`);
  });
}

main().catch((err) => {
  logger.error('Failed to start server', { message: err.message, stack: err.stack });
  process.exit(1);
});

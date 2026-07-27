import 'dotenv/config';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { initIO } from './sockets/index.js';

const PORT = process.env.PORT || 5000;

async function main() {
  await connectDB();

  const app = createApp();
  const httpServer = createServer(app);
  initIO(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`Pairagraph server listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

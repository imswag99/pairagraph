import http from 'node:http';
import { initIO } from '../sockets/index.js';

// Several services broadcast through getIO() (matchmaking, invite, collaboration,
// chat). Tests exercise the real service functions rather than mocking that away,
// so a throwaway Socket.IO server is spun up — nothing needs to connect to it,
// io.to(room).emit(...) is a safe no-op with zero listening sockets.
export function startTestSocket() {
  const httpServer = http.createServer();
  const io = initIO(httpServer);
  httpServer.listen(0);
  return {
    io,
    close: () =>
      new Promise((resolve) => {
        io.close();
        httpServer.close(() => resolve());
      }),
  };
}

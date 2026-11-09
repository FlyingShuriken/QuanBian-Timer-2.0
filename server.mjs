import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import next from 'next';
import { installMatch } from './server/match.mjs';
import { createStorage } from './server/storage.mjs';

const dev = process.argv.includes('--dev');
const lanHost = process.env.TIMER_LAN_HOST;
if (lanHost && !Object.values(networkInterfaces()).flat().some(
  address => address?.family === 'IPv4' && !address.internal && address.address === lanHost,
)) {
  throw new Error('TIMER_LAN_HOST must be a local LAN IPv4 address');
}
if (dev && lanHost) throw new Error('Build the production app before enabling LAN mode');

const port = Number(process.env.PORT || 3210);
const hostname = lanHost || '127.0.0.1';
const server = createServer({ requestTimeout: 30000 });
const app = next({ dev, hostname, port, httpServer: server });
const storage = createStorage(process.env.TIMER_DATA_DIR || '.data');

await app.prepare();
const timer = installMatch(server, storage, { lanHost, fallback: app.getRequestHandler() });
server.listen(port, hostname, () => {
  if (!lanHost) console.log(`Controller: http://localhost:${port}/`);
  if (lanHost) {
    console.log(`LAN controller: http://${lanHost}:${port}/`);
    console.log(`LAN display: http://${lanHost}:${port}/display`);
    console.log(`Operator credential: ${timer.credential}`);
  }
});

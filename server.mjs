import { createServer } from 'node:http';
import next from 'next';

const dev = process.argv.includes('--dev');
const hostname = '127.0.0.1';
const port = Number(process.env.PORT || 3210);
const server = createServer();
const app = next({ dev, hostname, port, httpServer: server });

await app.prepare();
server.on('request', app.getRequestHandler());
server.listen(port, hostname, () => console.log(`http://localhost:${port}`));

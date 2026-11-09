import { createServer } from 'node:http';
import next from 'next';
import { createStorage } from './server/storage.mjs';
import { json, readJSON } from './server/http.mjs';

const dev = process.argv.includes('--dev');
const hostname = '127.0.0.1';
const port = Number(process.env.PORT || 3210);
const server = createServer();
const app = next({ dev, hostname, port, httpServer: server });
const storage = createStorage(process.env.TIMER_DATA_DIR || '.data');

await app.prepare();
const handle = app.getRequestHandler();
server.on('request', async (req, res) => {
  try {
    if (req.url === '/api/config') {
      if (req.method === 'GET') return json(res, 200, storage.read());
      if (req.method !== 'POST') return json(res, 405, { error: '无效的请求' });
      const hosts = [`localhost:${port}`, `127.0.0.1:${port}`];
      if (!hosts.includes(req.headers.host) || req.headers.origin !== `http://${req.headers.host}`) {
        return json(res, 403, { error: '请求来源无效' });
      }
      return json(res, 200, storage.apply(await readJSON(req, 34 * 1024 * 1024)));
    }
    if (req.method === 'GET' && req.url.startsWith('/assets/')) {
      const asset = storage.readAsset(req.url.slice('/assets/'.length));
      if (!asset) return json(res, 404, { error: '文件不存在' });
      res.writeHead(200, { 'Content-Type': asset.type, 'X-Content-Type-Options': 'nosniff' });
      return res.end(asset.bytes);
    }
    return await handle(req, res);
  } catch (error) {
    if (!res.headersSent) return json(res, 400, { error: error.message });
    res.end();
  }
});
server.listen(port, hostname, () => console.log(`http://localhost:${port}`));

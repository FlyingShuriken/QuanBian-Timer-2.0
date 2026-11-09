import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { createMatch, matchActions } from '../src/timer/match.mjs';
import { maxArchiveBytes } from '../src/timer/assets.mjs';
import { json, readJSON } from './http.mjs';
import { operatorAuth } from './operator-auth.mjs';

export function installMatch(server, storage, { lanHost, fallback = (_req, res) => res.writeHead(404).end() } = {}) {
  const auth = operatorAuth(Boolean(lanHost));
  const instance = randomUUID();
  let sequence = 0;
  let expiryTimer;
  let config = storage.read();
  const match = createMatch(config);
  const viewers = new WebSocketServer({ noServer: true, maxPayload: 128 });

  function allowedHost(req) {
    const port = req.socket.localPort;
    return (lanHost ? [lanHost] : ['localhost', '127.0.0.1'])
      .some(host => req.headers.host === `${host}:${port}` || (port === 80 && req.headers.host === host));
  }

  function sameOrigin(req) {
    return allowedHost(req) && req.headers.origin === `http://${req.headers.host}`;
  }

  function snapshot() {
    const now = performance.now();
    return {
      type: 'snapshot', instance, sequence: ++sequence, sampledAt: now,
      settings: config.settings, ...match.snapshot(now),
    };
  }

  function scheduleExpiry() {
    clearTimeout(expiryTimer);
    const due = match.nextDeadline();
    if (due !== null) {
      expiryTimer = setTimeout(publish, Math.max(1, Math.ceil(due - performance.now())));
      expiryTimer.unref();
    }
  }

  function publish() {
    const data = JSON.stringify(snapshot());
    for (const peer of viewers.clients) {
      if (peer.readyState !== WebSocket.OPEN) continue;
      if (peer.bufferedAmount > 128 * 1024) peer.terminate();
      else peer.send(data);
    }
    scheduleExpiry();
  }

  function accept(peer) {
    peer.on('error', () => peer.terminate());
    peer.on('message', (bytes, binary) => {
      if (!binary && bytes.toString() === 'sync' && peer.readyState === WebSocket.OPEN &&
          peer.bufferedAmount < 128 * 1024) {
        peer.send(JSON.stringify({ type: 'sync', sampledAt: performance.now() }));
      }
    });
    peer.send(JSON.stringify(snapshot()));
    scheduleExpiry();
  }

  function upgrade(req, socket, head) {
    if (req.url !== '/ws/display') return;
    if (!allowedHost(req) || (req.headers.origin && !sameOrigin(req))) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
      return;
    }
    viewers.handleUpgrade(req, socket, head, accept);
  }

  async function request(req, res) {
    if (!allowedHost(req)) return json(res, 403, { error: '服务器地址无效' });
    if (req.method === 'GET' && req.url.startsWith('/assets/')) {
      const asset = storage.readAsset(req.url.slice('/assets/'.length));
      if (!asset) return json(res, 404, { error: '文件不存在' });
      res.writeHead(200, {
        'Content-Type': asset.type, 'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      return res.end(asset.bytes);
    }
    if (!req.url.startsWith('/api/')) return fallback(req, res);
    if (req.method === 'GET' && req.url === '/api/operator') {
      const host = lanHost ? `${lanHost}:${req.socket.localPort}` : req.headers.host;
      return json(res, 200, { authorized: Boolean(auth.allowed(req)), displayUrl: `http://${host}/display` });
    }
    if (req.method === 'POST' && !sameOrigin(req)) {
      return json(res, 403, { error: '请求来源无效' });
    }
    if (req.method === 'POST' && req.url === '/api/operator') {
      const body = await readJSON(req, 1024);
      const result = auth.login(body.credential);
      if (result.cookie) res.setHeader('Set-Cookie', result.cookie);
      return json(res, result.status, result.error ? { error: result.error } : { authorized: true });
    }
    if (!auth.allowed(req)) return json(res, 401, { error: '请先登录控制端' });
    if (req.url === '/api/config' && req.method === 'GET') return json(res, 200, config);
    if (req.url === '/api/config' && req.method === 'POST') {
      const body = await readJSON(req, Math.ceil(maxArchiveBytes * 4 / 3) + 1024 * 1024);
      if (!auth.allowed(req)) return json(res, 401, { error: '请先登录控制端' });
      config = storage.apply(body);
      match.apply(config.sessions);
      publish();
      return json(res, 200, config);
    }
    if (req.url === '/api/command' && req.method === 'POST') {
      const { action } = await readJSON(req, 1024);
      if (!auth.allowed(req)) return json(res, 401, { error: '请先登录控制端' });
      if (!matchActions.has(action)) return json(res, 400, { error: '无效的计时操作' });
      if (action === 'previous' || action === 'next') {
        const index = match.navigationIndex(action);
        if (index !== config.index) config = storage.write({ ...config, index });
      }
      match.command(action, performance.now());
      publish();
      return json(res, 200, { sequence });
    }
    return json(res, 404, { error: '无效的请求' });
  }

  const heartbeat = setInterval(publish, 1000);
  heartbeat.unref();
  server.on('upgrade', upgrade);
  server.on('request', (req, res) => {
    request(req, res).catch(error => {
      if (!res.headersSent) json(res, 400, { error: error.code ? '无法读取或保存配置' : error.message });
      else res.end();
    });
  });

  return {
    credential: auth.credential,
    close() {
      clearInterval(heartbeat);
      clearTimeout(expiryTimer);
      for (const peer of viewers.clients) peer.terminate();
      viewers.close();
    },
  };
}

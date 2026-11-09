export function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

export async function readJSON(req, limit) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new Error('需要 JSON');
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > limit) {
      req.resume();
      throw new Error('请求过大');
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString());
}

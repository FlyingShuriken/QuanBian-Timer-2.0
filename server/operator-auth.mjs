import { randomBytes, timingSafeEqual } from 'node:crypto';

const token = () => randomBytes(24).toString('base64url');

export function operatorAuth(lan) {
  const credential = lan ? token() : null;
  let session = null;
  let attempts = 0;
  let resetAt = 0;

  return {
    credential,
    allowed(req) {
      return !lan || (session !== null && req.headers.cookie?.split(';').some(
        cookie => cookie.trim() === `timer_operator=${session}`,
      ));
    },
    login(value, now = Date.now()) {
      if (!lan) return { status: 200 };
      if (now >= resetAt) {
        attempts = 0;
        resetAt = now + 30000;
      }
      if (attempts >= 8) return { status: 429, error: '尝试次数过多，请稍后重试' };
      const entered = Buffer.from(typeof value === 'string' ? value : '');
      const expected = Buffer.from(credential);
      if (entered.length !== expected.length || !timingSafeEqual(entered, expected)) {
        attempts++;
        return { status: 401, error: '操作密钥无效' };
      }
      session = token();
      return { status: 200, cookie: `timer_operator=${session}; HttpOnly; SameSite=Strict; Path=/api` };
    },
  };
}

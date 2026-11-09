'use client';

import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import { useCallback, useEffect, useRef, useState } from 'react';
import TimerDisplay from './components/TimerDisplay';
import Modal from './components/rules/Modal';
import { useMatchFeed } from './hooks/useMatchFeed';
import { matchShortcut } from './timer/shortcuts.mjs';

async function api(path, payload, signal) {
  const options = payload === undefined ? { signal } : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal,
  };
  const response = await fetch(`/api/${path}`, options);
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error || '请求失败');
    error.status = response.status;
    throw error;
  }
  return result;
}

export default function App() {
  const { sample, connected, reconnect } = useMatchFeed();
  const instance = sample?.snapshot.instance;
  const [session, setSession] = useState(null);
  const [credential, setCredential] = useState('');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(null);
  const [displayUrl, setDisplayUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const authorized = session === instance && Boolean(instance);

  useEffect(() => {
    if (!connected || !instance) return;
    const controller = new AbortController();
    api('operator', undefined, controller.signal).then(result => {
      if (!controller.signal.aborted) {
        setSession(result.authorized ? instance : '');
        setDisplayUrl(result.displayUrl);
      }
    }).catch(() => {
      if (!controller.signal.aborted) setError('无法读取控制端状态');
    });
    return () => controller.abort();
  }, [connected, instance]);

  const execute = useCallback(async (action, reportError = true) => {
    if (!connected || !authorized || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      return await action(AbortSignal.timeout(10000));
    } catch (err) {
      if (err.status === 401) setSession('');
      if (!err.status) reconnect();
      if (!reportError) throw err;
      setError(err.status ? err.message : '连接中断，请确认当前状态后重试');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }, [authorized, connected, reconnect]);

  const send = useCallback(action => execute(signal => api('command', { action }, signal)), [execute]);

  useEffect(() => {
    if (draft || !authorized || !connected) return;
    const onKey = event => {
      const action = matchShortcut(event);
      if (!action) return;
      event.preventDefault();
      send(action);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [authorized, connected, draft, send]);

  async function login(event) {
    event.preventDefault();
    if (!connected || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      await api('operator', { credential }, AbortSignal.timeout(10000));
      setCredential('');
      setSession(instance);
    } catch (err) {
      setError(err.message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  async function copyDisplay() {
    const url = displayUrl || new URL('/display', location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
      window.prompt('复制显示链接', url);
    }
  }

  if (!sample || (!authorized && session !== '')) {
    return <main className="grid h-screen place-items-center bg-slate-950 text-white">
      <p role="status">{error || '正在连接计时主机…'}</p>
    </main>;
  }
  if (!authorized) {
    return (
      <main className="grid h-screen place-items-center bg-slate-950 text-white">
        <form onSubmit={login} className="grid w-80 gap-3 rounded border border-white/30 p-5">
          <h1 className="text-xl font-bold">计时控制端</h1>
          <label>主机操作密钥
            <input className="mt-1 w-full rounded p-2 text-slate-950" type="password" autoComplete="current-password"
              required value={credential} onChange={event => setCredential(event.target.value)} />
          </label>
          <button disabled={!connected || busy} className="rounded bg-blue-700 px-3 py-2">登录</button>
          {error && <p role="alert">{error}</p>}
          <a href="/display" className="underline">打开显示页</a>
        </form>
      </main>
    );
  }

  const locked = !connected || busy || Boolean(draft);
  return (
    <>
      <TimerDisplay sample={sample}>
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded bg-black/70 p-2 text-sm text-white">
          <span role="status">{connected ? '主机已连接' : '正在重新连接'}</span>
          <button className="rounded border border-white/50 px-2 py-1" onClick={copyDisplay}>{copied ? '已复制' : '复制显示链接'}</button>
          <button disabled={locked} aria-label="设定" onClick={() => execute(async signal => {
            setDraft(await api('config', undefined, signal));
          })}><Cog6ToothIcon className="size-7" /></button>
        </div>
        {error && <p role="alert" className="absolute right-4 top-20 z-10 rounded bg-red-950 p-2 text-white">{error}</p>}
        <fieldset disabled={locked} className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 flex-wrap justify-center gap-2 rounded bg-black/70 p-2 text-sm text-white">
          {[
            ['previous', '上一环节'], ['primary', '主计时 Q'],
            ...(sample.snapshot.session.isDualTimer ? [['secondary', '副计时 W']] : []),
            ['pause', sample.snapshot.paused ? '解除暂停 P' : '紧急暂停 P'],
            ['reset', '重置 R'], ['next', '下一环节'],
          ].map(([action, title]) => (
            <button key={action} type="button" className="rounded border border-white/50 px-2 py-1 disabled:opacity-50"
              onClick={() => send(action)}>{title}</button>
          ))}
        </fieldset>
      </TimerDisplay>
      {draft && <Modal
        sessions={draft.sessions}
        settings={draft.settings}
        onClose={() => setDraft(null)}
        onApply={async payload => {
          if (!connected || !authorized || sending.current) throw new Error('主机尚未连接');
          await execute(signal => api('config', payload, signal), false);
        }}
      />}
    </>
  );
}

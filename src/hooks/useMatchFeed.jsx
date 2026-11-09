'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { staleAfterMs } from '../timer/display-time.mjs';

export function useMatchFeed() {
  const [sample, setSample] = useState(null);
  const [connected, setConnected] = useState(false);
  const connection = useRef(null);

  const reconnect = useCallback(() => {
    setConnected(false);
    connection.current?.close();
  }, []);

  useEffect(() => {
    let disposed = false;
    let retry;
    let watchdog;
    let synchronize;

    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${location.host}/ws/display`);
      connection.current = socket;
      let latest;
      let lastSnapshot = performance.now();
      let sentAt;
      let offset;
      let lowestRtt = Infinity;

      const sync = () => {
        if (socket.readyState !== WebSocket.OPEN) return;
        sentAt = performance.now();
        socket.send('sync');
      };

      socket.onopen = () => {
        if (disposed) return;
        sync();
        synchronize = setInterval(sync, 10000);
      };
      socket.onmessage = ({ data }) => {
        if (disposed || connection.current !== socket || socket.readyState !== WebSocket.OPEN) return;
        const now = performance.now();
        const message = JSON.parse(data);
        if (message.type === 'sync' && sentAt !== undefined) {
          const rtt = now - sentAt;
          if (rtt < lowestRtt) {
            lowestRtt = rtt;
            offset = message.sampledAt - (sentAt + now) / 2;
          }
          return;
        }
        if (message.type !== 'snapshot' ||
            (message.instance === latest?.instance && message.sequence <= latest.sequence)) return;
        latest = message;
        lastSnapshot = now;
        setSample({ snapshot: message, receivedAt: now, offset: offset ?? message.sampledAt - now });
        setConnected(true);
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        clearInterval(watchdog);
        clearInterval(synchronize);
        if (disposed) return;
        setConnected(false);
        retry = setTimeout(connect, 750);
      };
      watchdog = setInterval(() => {
        if (performance.now() - lastSnapshot >= staleAfterMs) {
          setConnected(false);
          socket.close();
        }
      }, 250);
    }

    connect();
    return () => {
      disposed = true;
      clearTimeout(retry);
      clearInterval(watchdog);
      clearInterval(synchronize);
      connection.current?.close();
      connection.current = null;
    };
  }, []);

  return { sample, connected, reconnect };
}

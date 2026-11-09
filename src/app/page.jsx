'use client';

import { useEffect, useState } from 'react';
import App from '../App';

export default function Page() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready ? <App /> : null;
}

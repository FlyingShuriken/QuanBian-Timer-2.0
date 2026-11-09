'use client';

import TimerDisplay from '../../components/TimerDisplay';
import { useMatchFeed } from '../../hooks/useMatchFeed';

export default function DisplayPage() {
  const { sample } = useMatchFeed();
  if (!sample) return <main className="grid h-screen place-items-center bg-slate-950 text-white">正在连接计时主机…</main>;
  return <TimerDisplay sample={sample} />;
}

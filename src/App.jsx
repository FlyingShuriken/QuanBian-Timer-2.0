import { useEffect, useState } from 'react';
import Screen from './components/Screen';
import Modal from './components/rules/Modal';
import { defaultSettings, readSavedMatch } from './timer/config.mjs';
import { createMatch } from './timer/match.mjs';
import { matchShortcut } from './timer/shortcuts.mjs';

function App() {
  const [match] = useState(() => createMatch(readSavedMatch(key => localStorage.getItem(key))));
  const [state, setState] = useState(() => match.snapshot(0));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [settings, setSettings] = useState(() => {
    try {
      return { ...defaultSettings, ...JSON.parse(localStorage.getItem('debateTimerSettings')) };
    } catch {
      return defaultSettings;
    }
  });

  useEffect(() => {
    localStorage.setItem('debateTimerSettings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    if (state.running === null) return;
    const id = setInterval(() => setState(match.snapshot(performance.now())), 50);
    return () => clearInterval(id);
  }, [match, state.running]);

  useEffect(() => {
    if (isModalOpen) return;
    const onKey = (event) => {
      const action = matchShortcut(event);
      if (!action) return;
      const now = performance.now();
      match.command(action, now);
      setState(match.snapshot(now));
      localStorage.setItem('debateTimerCurrentIndex', String(match.saved().index));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isModalOpen, match]);

  useEffect(() => {
    if (!settings.customFontFamily || !settings.customFontPath) return;
    const font = new FontFace(settings.customFontFamily, `url("${settings.customFontPath}")`);
    document.fonts.add(font);
    font.load().catch(console.error);
    return () => { document.fonts.delete(font); };
  }, [settings.customFontFamily, settings.customFontPath]);

  return (
    <div>
      <Screen {...state} setIsModalOpen={setIsModalOpen} settings={settings} />
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        setSessions={(sessions) => {
          match.apply(sessions);
          setState(match.snapshot(performance.now()));
          localStorage.setItem('debateTimerSessions', JSON.stringify(match.saved().sessions));
          localStorage.setItem('debateTimerCurrentIndex', '0');
        }}
        settings={settings}
        setSettings={setSettings}
      />
    </div>
  );
}

export default App;

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
  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/config', { signal: controller.signal }).then(response => response.json()).then(config => {
      if (controller.signal.aborted) return;
      match.apply(config.sessions);
      setState(match.snapshot(performance.now()));
      setSettings(config.settings);
    }).catch(error => { if (!controller.signal.aborted) console.error(error); });
    return () => controller.abort();
  }, [match]);

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
      {isModalOpen && <Modal
        sessions={match.saved().sessions}
        settings={settings}
        onClose={() => setIsModalOpen(false)}
        onApply={async payload => {
          const response = await fetch('/api/config', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          });
          const config = await response.json();
          if (!response.ok) throw new Error(config.error);
          match.apply(config.sessions);
          setState(match.snapshot(performance.now()));
          setSettings(config.settings);
        }}
      />}
    </div>
  );
}

export default App;

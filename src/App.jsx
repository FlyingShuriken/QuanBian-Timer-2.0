import { library } from '@fortawesome/fontawesome-svg-core';
import { faCog } from '@fortawesome/free-solid-svg-icons';
import { useEffect, useState } from "react";
import Screen from "./components/Screen";
import Modal from "./components/rules/Modal";
import { matchShortcut } from "./timer/shortcuts.mjs";

// Add the cog icon to the library
library.add(faCog);

const specialSessions = {
    "1": { 
      title: "教练指导", 
      duration: 60, 
      isDualTimer: false 
    },
    "2": { 
      title: "教练指导", 
      duration: 120, 
      isDualTimer: false 
    }
  };

function App() {
  // Initial default session
  const defaultSessions = [
    {
      title: "请选择赛制",
      isDualTimer: false,
      duration: 1,
    }
  ];

  // Default settings
  const defaultSettings = {
    coverBackground: '/cover.png',
    defaultBackground: '/background.png',
    positiveColor: '#23C1FF', // Tailwind blue-500
    negativeColor: '#AEF359', // Tailwind lime-500
    fontStyle: 'font-sans', // Default font style
    customFontFamily: '',
    customFontPath: ''
  };

  // Load sessions from localStorage or use default
  const [sessions, setSessions] = useState(() => {
    const savedSessions = localStorage.getItem('debateTimerSessions');
    return savedSessions ? JSON.parse(savedSessions) : defaultSessions;
  });

  // Load settings from localStorage or use default
  const [settings, setSettings] = useState(() => {
    // First try to load from localStorage
    const savedSettings = localStorage.getItem('debateTimerSettings');
    if (savedSettings) {
      return JSON.parse(savedSettings);
    }
    
    // Fallback to default settings
    return defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem('debateTimerSettings', JSON.stringify(settings));
  }, [settings]);

  const [currentSessionIndex, setCurrentSessionIndex] = useState(() => {
    const savedIndex = localStorage.getItem('debateTimerCurrentIndex');
    return savedIndex ? parseInt(savedIndex, 10) : 0;
  });
  
  const [key, setKey] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [specialSessionContext, setSpecialSessionContext] = useState(null);

  // Save sessions to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('debateTimerSessions', JSON.stringify(sessions));
  }, [sessions]);

  // Save current session index to localStorage
  useEffect(() => {
    localStorage.setItem('debateTimerCurrentIndex', currentSessionIndex.toString());
  }, [currentSessionIndex]);

  useEffect(() => {
    if (!settings.customFontFamily || !settings.customFontPath) return;
    const font = new FontFace(settings.customFontFamily, `url("${settings.customFontPath}")`);
    document.fonts.add(font);
    font.load().catch(console.error);
    return () => { document.fonts.delete(font); };
  }, [settings.customFontFamily, settings.customFontPath]);

  // Customize keyboard shortcut for special sessions
  useEffect(() => {
    const handleSpecialSessionToggle = (sessionKey) => {
      if (specialSessionContext) {
        if (specialSessionContext.key === sessionKey) {
          // Same key pressed → go back to original sessions
          setSessions(specialSessionContext.allSessions);
          setCurrentSessionIndex(specialSessionContext.index);
          setSpecialSessionContext(null);
        } else {
          // ✅ Different special session key → just switch directly
          setSessions([specialSessions[sessionKey]]);
          setCurrentSessionIndex(0);
          setSpecialSessionContext({
            ...specialSessionContext,
            key: sessionKey
          });
        }
      } else {
        // First time entering special session → store current context
        setSpecialSessionContext({
          allSessions: sessions,
          index: currentSessionIndex,
          key: sessionKey
        });
        setSessions([specialSessions[sessionKey]]);
        setCurrentSessionIndex(0);
      }
      setKey((prevKey) => prevKey + 1);
    };
    

    const handleKeyDown = (event) => {
      if (isModalOpen) return;
      const action = matchShortcut(event);
      if (action === 'coach1' || action === 'coach2') {
        handleSpecialSessionToggle(action.at(-1));
      } else if (action === 'previous' || action === 'next') {
        if (specialSessionContext) {
          setSessions(specialSessionContext.allSessions);
          setCurrentSessionIndex(specialSessionContext.index);
          setSpecialSessionContext(null);
        } else {
          if (sessions.length < 2) return;
          const step = action === 'next' ? 1 : -1;
          setCurrentSessionIndex(index => (index + step + sessions.length) % sessions.length);
        }
        setKey(key => key + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [specialSessionContext, sessions, currentSessionIndex, isModalOpen]);

  const session = sessions[currentSessionIndex];

  return (
    <div>
      <Screen 
        key={key}
        shortcutsDisabled={isModalOpen}
        session={{
          ...session,
          label1: session.label1 || "正方",
          label2: session.label2 || "反方"
        }}
        setIsModalOpen={setIsModalOpen}
        settings={settings}
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        setSessions={(newSessions) => {
          setSessions(newSessions);
          // Reset special session context when sessions change
          setSpecialSessionContext(null);
        }}
        settings={settings}
        setSettings={setSettings}
      />
    </div>
  );
}

export default App;
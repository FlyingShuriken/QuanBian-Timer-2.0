import { useEffect, useState } from 'react';
import PropTypes from "prop-types";
import Timer from "./Timer";
import PauseModal from "./modals/PauseModal";
import { displayTime, staleAfterMs } from "../timer/display-time.mjs";

export default function TimerDisplay({ sample, children }) {
  const { snapshot, receivedAt } = sample;
  const { session, running, paused, settings } = snapshot;
  const [now, setNow] = useState(receivedAt);
  const { stale, remainingMs } = displayTime(sample, Math.max(now, receivedAt));
  const [primary, secondary = 0] = remainingMs.map(ms => Math.ceil(ms / 1000));

  useEffect(() => {
    if (stale) return;
    const remaining = Math.max(0, receivedAt + staleAfterMs - performance.now());
    const deadline = setTimeout(() => setNow(performance.now()), Math.ceil(remaining) + 1);
    const tick = running === null ? null : setInterval(() => setNow(performance.now()), 50);
    return () => { clearTimeout(deadline); clearInterval(tick); };
  }, [receivedAt, running, stale]);

  useEffect(() => {
    if (!settings.customFontPath) return;
    const font = new FontFace('DebateCustom', `url("${settings.customFontPath}")`);
    document.fonts.add(font);
    font.load().catch(console.error);
    return () => { document.fonts.delete(font); };
  }, [settings.customFontPath]);

  // Get title style for non-dual timers
  const getTitleStyle = () => {
    if (session.isDualTimer) return { color: "white" };
    
    if (session.title.includes("正")) {
      return { color: settings.positiveColor };
    }
    if (session.title.includes("反")) {
      return { color: settings.negativeColor };
    }
    return { color: "white" };
  };

  // Get timer active style based on session type
  const getTimerActiveStyle = (timerLabel) => {
    // For dual timers, use positive/negative colors based on the label
    if (session.isDualTimer) {
      if (timerLabel === "正方" || timerLabel === session.label1) {
        return settings.positiveColor;
      } else if (timerLabel === "反方" || timerLabel === session.label2) {
        return settings.negativeColor;
      }
    }
  
    // For single timers, use existing logic
    if (session.title === "教练指导" || (!session.title.includes("正") && !session.title.includes("反"))) {
      return "text-white";
    }
    
    return session.title.includes("反") ? settings.negativeColor : settings.positiveColor;
  };

  // Render title with colored parts for dual timers
  const renderTitle = () => {
    if (!session.isDualTimer) {
      return session.title;
    }

    // For dual timer sessions, colorize the specific terms
    return (
      <>
        {session.title.split(/(正方|反方)/).map((part, index) => {
          if (part === "正方") {
            return (
              <span key={index} style={{ color: settings.positiveColor }}>
                {part}
              </span>
            );
          } else if (part === "反方") {
            return (
              <span key={index} style={{ color: settings.negativeColor }}>
                {part}
              </span>
            );
          }
          return part;
        })}
      </>
    );
  };

  return (
    <div
      className={`w-screen h-screen flex flex-col justify-center bg-cover bg-center ${settings.fontStyle}`}
      style={{
        backgroundImage: session.title === "封面" 
          ? `url("${settings.coverBackground}")` 
          : `url("${settings.defaultBackground}")`,
        fontFamily: settings.customFontFamily || 'inherit'
      }}
    
    >
      {children}

      {session.title !== "封面" && (
        <>
          <div className="text-center mb-6">
            <h1
              className="text-[2rem] md:text-[3rem] lg:text-[4rem] xl:text-[5rem] font-bold"
              style={getTitleStyle()}
            >
              {renderTitle()}
            </h1>
          </div>
  
          <div className="flex justify-center">
            <Timer
              key="Primary"
              minutes={Math.floor(primary / 60)}
              seconds={primary % 60}
              label={session.isDualTimer ? session.label1 : ""}
              isActive={!stale && running === 0}
              idleStyle="text-slate-400"
              activeStyle={getTimerActiveStyle(session.isDualTimer ? session.label1 : "")}
              settings={settings}
              labelStyle={session.isDualTimer ? { color: settings.positiveColor } : {}}
            />
            {session.isDualTimer && (
              <Timer
                key="Secondary"
                minutes={Math.floor(secondary / 60)}
                seconds={secondary % 60}
                label={session.label2}
                isActive={!stale && running === 1}
                idleStyle="text-slate-400"
                activeStyle={getTimerActiveStyle(session.label2)}
                settings={settings}
                labelStyle={{ color: settings.negativeColor }}
              />
            )}
          </div>
        </>
      )}
  
      {paused && <PauseModal isOpen={paused} />}
      {stale && <div role="status" className="absolute bottom-4 left-4 z-10 rounded bg-black/80 px-3 py-2 text-white">计时连接已中断</div>}
    </div>
  );
}

TimerDisplay.propTypes = {
  sample: PropTypes.object.isRequired,
  children: PropTypes.node,
};

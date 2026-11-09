import { Cog6ToothIcon } from '@heroicons/react/24/outline';
import PropTypes from "prop-types";
import Timer from "./Timer";
import PauseModal from "./modals/PauseModal";

function Screen({ session, remainingMs, running, paused, setIsModalOpen, settings }) {
  const [primary, secondary = 0] = remainingMs.map(ms => Math.ceil(ms / 1000));

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
      <div className="absolute top-4 right-4">
        <button aria-label="设定" onClick={() => setIsModalOpen(true)}>
          <Cog6ToothIcon className="size-8 text-gray-400 hover:text-gray-800" />
        </button>
      </div>
  
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
              isActive={running === 0}
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
                isActive={running === 1}
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
    </div>
  );
}

Screen.propTypes = {
  remainingMs: PropTypes.arrayOf(PropTypes.number).isRequired,
  running: PropTypes.number,
  paused: PropTypes.bool.isRequired,
  session: PropTypes.shape({
    isDualTimer: PropTypes.bool.isRequired,
    duration: PropTypes.number.isRequired,
    label1: PropTypes.string,
    label2: PropTypes.string,
    title: PropTypes.string.isRequired,
  }).isRequired,
  setIsModalOpen: PropTypes.func.isRequired,
  settings: PropTypes.object.isRequired,
};

export default Screen;
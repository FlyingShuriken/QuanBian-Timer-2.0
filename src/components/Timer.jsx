import PropTypes from "prop-types";

function Timer({ 
  minutes, 
  seconds, 
  label, 
  isActive, 
  idleStyle, 
  activeStyle, 
  settings, 
  labelStyle = {} 
}) {
  // Format time with leading zeros
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;

  // Create a glow effect based on the color
  const createGlowEffect = (color) => {
    // Convert hex to rgba if it's a hex color
    let rgbaColor = color;
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      rgbaColor = `rgba(${r}, ${g}, ${b}, 0.5)`;
    } 
    // Extract rgba values if it's already rgb/rgba
    else if (color.startsWith('rgb')) {
      // For rgba values, just use as is with adjusted opacity
      if (color.startsWith('rgba')) {
        rgbaColor = color.replace(/rgba\((.+?),\s*[\d.]+\)/, 'rgba($1, 0.5)');
      } 
      // For rgb values, convert to rgba
      else {
        rgbaColor = color.replace(/rgb\((.+?)\)/, 'rgba($1, 0.5)');
      }
    }

    return `0 0 5px ${rgbaColor}, 0 0 10px ${rgbaColor}, 0 0 15px ${rgbaColor}`;
  };

  // Handle both string className and color value
  const getStyle = () => {
    const baseStyle = { fontFamily: 'Oswald, sans-serif' };
    
    if (isActive) {
      // If activeStyle is a hex color or other color value
      if (typeof activeStyle === 'string' && (activeStyle.startsWith('#') || activeStyle.startsWith('rgb'))) {
        return { 
          ...baseStyle, 
          color: activeStyle,
          textShadow: createGlowEffect(activeStyle)
        };
      } 
      // If it's a Tailwind class, use the appropriate color from settings
      else {
        let glowColor;
        if (label === "正方" || label === settings?.label1) {
          glowColor = settings.positiveColor;
        } else if (label === "反方" || label === settings?.label2) {
          glowColor = settings.negativeColor;
        } else if (activeStyle === "text-white") {
          glowColor = "rgba(255, 255, 255, 0.7)";
        } else {
          // Default glow for other cases
          glowColor = "rgba(255, 255, 255, 0.7)";
        }
        
        return { 
          ...baseStyle,
          textShadow: createGlowEffect(glowColor)
        };
      }
    }
    
    // For inactive state - subtle glow
    return { 
      ...baseStyle,
      textShadow: '0 0 5px rgba(150, 150, 150, 0.3)'
    };
  };

  // Determine which class to use based on active state
  const getClassName = () => {
    if (isActive) {
      // If activeStyle is a Tailwind class (doesn't start with # or rgb)
      if (typeof activeStyle === 'string' && !activeStyle.startsWith('#') && !activeStyle.startsWith('rgb')) {
        return activeStyle;
      }
      return '';
    }
    return idleStyle;
  };

  return (
    <div className="w-full h-full flex flex-col justify-center items-center -mt-10">
      {label && (
        <div 
          className="text-[2rem] md:text-[2.5rem] lg:text-[4.5rem] xl:text-[4.5rem] font-bold" 
          style={labelStyle}
        >
          {label}
        </div>
      )}
      <div
        className={`text-[8.5rem] md:text-[11rem] lg:text-[13rem] xl:text-[13rem] font-bold -mt-4 ${getClassName()}`}
        style={getStyle()}
      >
        {formattedTime}
      </div>
    </div>
  );
}

Timer.propTypes = {
  minutes: PropTypes.number.isRequired,
  seconds: PropTypes.number.isRequired,
  label: PropTypes.string,
  isActive: PropTypes.bool.isRequired,
  idleStyle: PropTypes.string,
  activeStyle: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  settings: PropTypes.object.isRequired,
  labelStyle: PropTypes.object
};

export default Timer;
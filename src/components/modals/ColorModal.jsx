import { TrashIcon } from '@heroicons/react/24/outline';
import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';

const ColorModal = ({ isOpen, onClose, onColorSelect, title, initialColor }) => {
  // Parse initial color to HSV
  const initialHsv = hexToHsv(initialColor || '#FF0000');
  const [hue, setHue] = useState(initialHsv.h);
  const [saturation, setSaturation] = useState(initialHsv.s);
  const [value, setValue] = useState(initialHsv.v);
  const [hexValue, setHexValue] = useState(initialColor || '#FF0000');
  
  // Store recent colors
  const [savedColors, setSavedColors] = useState([]);
  
  const MAX_COLORS = 8; // Maximum number of colors to save
  
  const hueSliderRef = useRef(null);
  const colorSquareRef = useRef(null);
  const isDraggingHue = useRef(false);
  const isDraggingSquare = useRef(false);

  // Load saved colors from localStorage when component mounts or when isOpen changes
  useEffect(() => {
    if (isOpen) {
      try {
        const storedColors = localStorage.getItem('savedColors');
        if (storedColors) {
          setSavedColors(JSON.parse(storedColors));
        }
      } catch (error) {
        console.error("Error loading saved colors:", error);
        setSavedColors([]);
      }
    }
  }, [isOpen]);

  // Convert hex color to HSV
  function hexToHsv(hex) {
    // Remove # if present
    hex = hex.replace(/^#/, '');
    
    // Parse the hex values
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    
    // Calculate HSV
    let h = 0;
    const s = max === 0 ? 0 : delta / max;
    const v = max;
    
    if (delta === 0) {
      h = 0;
    } else if (max === r) {
      h = ((g - b) / delta) % 6;
    } else if (max === g) {
      h = (b - r) / delta + 2;
    } else {
      h = (r - g) / delta + 4;
    }
    
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    
    return { h, s, v };
  }
  
  // Convert HSV to hex color
  function hsvToHex(h, s, v) {
    const f = (n, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
    const r = Math.round(f(5) * 255);
    const g = Math.round(f(3) * 255);
    const b = Math.round(f(1) * 255);
    
    return `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  }
  
  // Update hex whenever HSV changes
  useEffect(() => {
    const newHex = hsvToHex(hue, saturation, value);
    setHexValue(newHex);
  }, [hue, saturation, value]);
  
  // Update HSV when hex changes directly
  const handleHexChange = (value) => {
    setHexValue(value);
    if (/^#[0-9A-F]{6}$/i.test(value)) {
      const newHsv = hexToHsv(value);
      setHue(newHsv.h);
      setSaturation(newHsv.s);
      setValue(newHsv.v);
    }
  };
  
  // Handle hue slider mouse events
  const handleHueMouseDown = (e) => {
    if (hueSliderRef.current) {
      isDraggingHue.current = true;
      updateHueFromMousePosition(e);
      window.addEventListener('mousemove', handleHueMouseMove);
      window.addEventListener('mouseup', handleHueMouseUp);
    }
  };
  
  const handleHueMouseMove = (e) => {
    if (isDraggingHue.current) {
      updateHueFromMousePosition(e);
    }
  };
  
  const handleHueMouseUp = () => {
    isDraggingHue.current = false;
    window.removeEventListener('mousemove', handleHueMouseMove);
    window.removeEventListener('mouseup', handleHueMouseUp);
  };
  
  const updateHueFromMousePosition = (e) => {
    const rect = hueSliderRef.current.getBoundingClientRect();
    const height = rect.height;
    const y = e.clientY - rect.top;
    const newHue = Math.max(0, Math.min(359, Math.round(y / height * 360)));
    setHue(newHue);
  };
  
  // Handle color square mouse events
  const handleSquareMouseDown = (e) => {
    if (colorSquareRef.current) {
      isDraggingSquare.current = true;
      updateSaturationValueFromMousePosition(e);
      window.addEventListener('mousemove', handleSquareMouseMove);
      window.addEventListener('mouseup', handleSquareMouseUp);
    }
  };
  
  const handleSquareMouseMove = (e) => {
    if (isDraggingSquare.current) {
      updateSaturationValueFromMousePosition(e);
    }
  };
  
  const handleSquareMouseUp = () => {
    isDraggingSquare.current = false;
    window.removeEventListener('mousemove', handleSquareMouseMove);
    window.removeEventListener('mouseup', handleSquareMouseUp);
  };
  
  const updateSaturationValueFromMousePosition = (e) => {
    const rect = colorSquareRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const x = Math.max(0, Math.min(width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(height, e.clientY - rect.top));
    
    const newSaturation = x / width;
    const newValue = 1 - y / height;
    
    setSaturation(newSaturation);
    setValue(newValue);
  };
  
  const deleteColor = (colorToDelete, e) => {
    // Stop event propagation to prevent color selection
    e.stopPropagation();
    
    try {
      // Get current colors from localStorage directly
      const currentStoredColors = JSON.parse(localStorage.getItem('savedColors') || '[]');
      const updatedColors = currentStoredColors.filter(color => color !== colorToDelete);
      
      // Update localStorage
      localStorage.setItem('savedColors', JSON.stringify(updatedColors));
      
      // Update state
      setSavedColors(updatedColors);
    } catch (error) {
      console.error("Error deleting color:", error);
    }
  };
  
  const handleSavedColorSelect = (color) => {
    setHexValue(color);
    const newHsv = hexToHsv(color);
    setHue(newHsv.h);
    setSaturation(newHsv.s);
    setValue(newHsv.v);
  };
  
  const saveToRecentColors = (colorToSave) => {
    try {
      // Always get the latest data from localStorage
      const currentStoredColors = JSON.parse(localStorage.getItem('savedColors') || '[]');
      
      // Remove this color if it already exists to avoid duplicates
      const filteredColors = currentStoredColors.filter(color => color !== colorToSave);
      
      // Add the new color to the beginning of the array (most recent first)
      const newColors = [colorToSave, ...filteredColors].slice(0, MAX_COLORS);
      
      // Save to localStorage
      localStorage.setItem('savedColors', JSON.stringify(newColors));
      
      // Update state
      setSavedColors(newColors);
      
      console.log("Saved colors to localStorage:", newColors);
    } catch (error) {
      console.error("Error saving colors:", error);
    }
  };
  
  const handleConfirm = () => {
    // Save the current color to recent colors
    saveToRecentColors(hexValue);
    
    // Pass the color to the parent component
    onColorSelect(hexValue);
    onClose();
  };
  
  if (!isOpen) return null;
  
  // Calculate position for the color square selector
  const squareSelectorStyle = {
    left: `${saturation * 100}%`,
    top: `${(1 - value) * 100}%`
  };
  
  // Calculate position for the hue slider selector
  const hueThumbStyle = {
    top: `${(hue / 360) * 100}%`
  };

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-md shadow-md w-11/12 max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">{title || '选择颜色'}</h2>
          <button
            className="text-gray-600 text-xl"
            onClick={onClose}
          >
            &times;
          </button>
        </div>
        
        <div className="flex space-x-4 mb-4">
          {/* Saturation/Value square */}
          <div 
            ref={colorSquareRef}
            className="relative w-64 h-64 rounded-md cursor-crosshair"
            style={{
              backgroundColor: hsvToHex(hue, 1, 1),
              backgroundImage: 'linear-gradient(to right, #fff, transparent), linear-gradient(to top, #000, transparent)'
            }}
            onMouseDown={handleSquareMouseDown}
          >
            {/* Selector circle */}
            <div 
              className="absolute w-4 h-4 rounded-full border-2 border-white transform -translate-x-1/2 -translate-y-1/2"
              style={{
                ...squareSelectorStyle,
                boxShadow: '0 0 2px rgba(0, 0, 0, 0.6)'
              }}
            ></div>
          </div>
          
          {/* Hue slider */}
          <div 
            ref={hueSliderRef}
            className="relative w-8 h-64 rounded-md cursor-ns-resize"
            style={{
              background: 'linear-gradient(to bottom, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)'
            }}
            onMouseDown={handleHueMouseDown}
          >
            {/* Hue thumb */}
            <div 
              className="absolute w-8 h-3 left-0 -ml-1 transform -translate-y-1/2 pointer-events-none"
              style={{
                ...hueThumbStyle,
                boxShadow: '0 0 2px rgba(0, 0, 0, 0.6)'
              }}
            >
              <div className="w-10 h-3 bg-white rounded-md border border-gray-300"></div>
            </div>
          </div>
        </div>
        
        {/* Color Preview and Hex Input */}
        <div className="flex items-center space-x-2 mb-4">
          <div 
            className="w-12 h-10 rounded-md"
            style={{ backgroundColor: hexValue }}
          ></div>
          
          <div className="px-3 py-2 border rounded-md">
            <span>Hex</span>
          </div>
          
          <input
            type="text"
            value={hexValue}
            onChange={(e) => handleHexChange(e.target.value)}
            className="flex-1 border rounded-md px-3 py-2"
          />
          
        </div>
        
        {/* Recent Colors */}
        <div className="mb-4">
          {/* <div className="flex justify-between items-center mb-2">
            <span className="text-gray-700">Recent colors:</span>
          </div> */}
          
          <div className="border rounded-md p-3">
            <div className="flex flex-wrap justify-start">
              {savedColors.length > 0 ? (
                savedColors.map((color, index) => (
                  <div
                    key={`${color}-${index}`}
                    className="relative group mb-2 mr-2"
                  >
                    <button
                      className={`w-8 h-8 rounded-full relative ${
                        color === hexValue ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => handleSavedColorSelect(color)}
                    ></button>
                    <button
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => deleteColor(color, e)}
                    >
                      <TrashIcon className="h-3 w-3" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-2">
                  No saved colors yet
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-end">
          <button
            className="px-4 py-2 bg-gray-300 text-gray-700 rounded mr-2"
            onClick={onClose}
          >
            取消
          </button>
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded"
            onClick={handleConfirm}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
};

ColorModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onColorSelect: PropTypes.func.isRequired,
  title: PropTypes.string,
  initialColor: PropTypes.string
};

export default ColorModal;
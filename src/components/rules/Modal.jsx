import JSZip from 'jszip';
import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import ColorModal from "../modals/ColorModal";
import AddModal from "./AddRecord/AddModal";
import { processJsonFile } from "./jsonHandler";

const Modal = ({ isOpen, onClose, setSessions, settings, setSettings }) => {
  const [jsonFile, setJsonFile] = useState(null);
  const [data, setData] = useState([]);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [view, setView] = useState("upload");
  
  // State for color picker modal
  const [isColorModalOpen, setIsColorModalOpen] = useState(false);
  const [currentColorSetting, setCurrentColorSetting] = useState(null);
  const [colorModalTitle, setColorModalTitle] = useState("");
  const containerRef = useRef(null);

  // Load data from localStorage when modal opens
  useEffect(() => {
    if (isOpen) {
      const savedData = localStorage.getItem('debateTimerCustomData');
      if (savedData) {
        try {
          setData(JSON.parse(savedData));
        } catch (error) {
          console.error("Error parsing saved data:", error);
        }
      }
    }
  }, [isOpen]);

  // Save data to localStorage when it changes
  useEffect(() => {
    if (data.length > 0) {
      localStorage.setItem('debateTimerCustomData', JSON.stringify(data));
    }
  }, [data]);

  const handleSettingsChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value instanceof File ? URL.createObjectURL(value) : value,
    }));
  };

  // Function to open color modal
  const openColorModal = (field, title) => {
    setCurrentColorSetting(field);
    setColorModalTitle(title);
    setIsColorModalOpen(true);
  };
  
  // Handle color change from ColorModal
  const handleColorChange = (color) => {
    if (currentColorSetting) {
      handleSettingsChange(currentColorSetting, color);
    }
  };

  const handleCompletePackageUpload = async (file) => {
    console.log("Uploaded file:", file);
    console.log("File type:", file.type);
    
    // Check both MIME type and file extension
    const isZipMimeType = file.type === 'application/zip' || file.type === 'application/x-zip-compressed';
    const isZipExtension = file.name.toLowerCase().endsWith('.zip');
    
    if (!file || (!isZipMimeType && !isZipExtension)) {
      console.log("File validation failed:", {
        fileName: file?.name,
        fileType: file?.type,
        isZipMimeType,
        isZipExtension
      });
      setShowError(true);
      setErrorMessage("Please upload a valid ZIP file");
      return;
    }
  
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      
      // Process JSON config file
      const configFile = contents.file("config.json");
      if (configFile) {
        const configText = await configFile.async("string");
        const configData = JSON.parse(configText);
        
        // Handle sessions data
        if (configData.sessions) {
          setData(configData.sessions);
          setSessions(configData.sessions);
          localStorage.setItem('debateTimerCustomData', JSON.stringify(configData.sessions));
        }
        
        // Handle settings if present
        if (configData.settings) {
          const newSettings = {...settings};
          
          // Only update non-file settings
          if (configData.settings.positiveColor) 
            newSettings.positiveColor = configData.settings.positiveColor;
          if (configData.settings.negativeColor) 
            newSettings.negativeColor = configData.settings.negativeColor;
          if (configData.settings.fontStyle) 
            newSettings.fontStyle = configData.settings.fontStyle;
          if (configData.settings.customFontFamily)
            newSettings.customFontFamily = configData.settings.customFontFamily;
          if (configData.settings.customFontFormat)
            newSettings.customFontFormat = configData.settings.customFontFormat;
          
          setSettings(newSettings);
        }
      }
      
      // Process cover background
      const coverImage = contents.file("cover.png") || contents.file("cover.jpg");
      if (coverImage) {
        const blob = await coverImage.async("blob");
        const imageUrl = URL.createObjectURL(blob);
        if (imageUrl) {
          setSettings(prev => ({...prev, coverBackground: imageUrl}));
        }
      }
      
      // Process default background
      const defaultImage = contents.file("background.png") || contents.file("background.jpg");
      if (defaultImage) {
        const blob = await defaultImage.async("blob");
        const imageUrl = URL.createObjectURL(blob);
        if (imageUrl) {
          setSettings(prev => ({...prev, defaultBackground: imageUrl}));
        }
      }
      
      // Process font files with our improved function
      try {
        await processFontFromZip(contents, setSettings);
      } catch (fontError) {
        console.error("Font processing error:", fontError);
        setShowError(true);
        setErrorMessage("Error loading font: " + fontError.message);
      }
      
      // Show success message
      setShowError(false);
      
    } catch (error) {
      console.error("Error processing ZIP file:", error);
      setShowError(true);
      setErrorMessage("Error processing ZIP file: " + error.message);
    }
  };

  // Improved function for processing font files from ZIP
  const processFontFromZip = async (contents, setSettings) => {
      // Find all font files in the ZIP
      const fontFiles = Object.keys(contents.files).filter(path => 
        /\.(woff2|woff|ttf|otf)$/i.test(path) && !path.startsWith('__MACOSX'));
      
      if (fontFiles.length === 0) {
        console.log("No font files found in ZIP");
        return;
      }
      
      try {
        // Get the first font file
        const fontPath = fontFiles[0];
        console.log("Processing font file:", fontPath);
        
        // Determine font format from file extension
        const format = fontPath.split('.').pop().toLowerCase();
        
        // Get font metadata if available
        let fontFamily;
        const metadataFile = contents.file("font-metadata.json");
        
        if (metadataFile) {
          const metadataText = await metadataFile.async("string");
          const metadata = JSON.parse(metadataText);
          fontFamily = metadata.family;
          console.log("Using font family from metadata:", fontFamily);
        } else {
          // Generate a unique font family name based on the filename
          const baseName = fontPath.split('/').pop().split('.')[0];
          fontFamily = `custom-font-${baseName}-${Date.now()}`;
          console.log("Generated font family name:", fontFamily);
        }
        
        // Extract font to ArrayBuffer for most reliable loading
        const fontFile = contents.file(fontPath);
        const fontArrayBuffer = await fontFile.async("arraybuffer");
        
        // Create blob with proper MIME type
        const mimeTypes = {
          'woff2': 'font/woff2',
          'woff': 'font/woff',
          'ttf': 'font/ttf',
          'otf': 'font/otf'
        };
        
        const fontBlob = new Blob([fontArrayBuffer], { 
          type: mimeTypes[format] || 'font/ttf'
        });
        
        // Create a persistent URL
        const fontUrl = URL.createObjectURL(fontBlob);
        
        console.log(`Loading font: family=${fontFamily}, format=${format}, url=${fontUrl}`);
        
        // Create a style element to load the font
        const style = document.createElement('style');
        style.textContent = `
          @font-face {
            font-family: '${fontFamily}';
            src: url('${fontUrl}') format('${format}');
            font-weight: normal;
            font-style: normal;
          }
        `;
        document.head.appendChild(style);
        
        // Also load via FontFace API for better compatibility
        const fontFace = new FontFace(fontFamily, `url(${fontUrl})`);
        try {
          const loadedFont = await fontFace.load();
          document.fonts.add(loadedFont);
          console.log("Font loaded successfully via FontFace API");
        } catch (fontError) {
          console.warn("FontFace API loading failed, falling back to @font-face", fontError);
        }
        
        // Update settings with the loaded font information
        setSettings(prev => ({
          ...prev,
          customFontFamily: fontFamily,
          customFontUrl: fontUrl,
          customFontFormat: format
        }));
        
        return true;
      } catch (error) {
        console.error("Error processing font:", error);
        throw error;
      }
    };

  const exportCompletePackage = async () => {
    const zip = new JSZip();
    
    // Add JSON config
    const configData = {
      sessions: data,
      settings: {
        positiveColor: settings.positiveColor,
        negativeColor: settings.negativeColor,
        fontStyle: settings.fontStyle,
        customFontFamily: settings.customFontFamily,
        customFontFormat: settings.customFontFormat
      }
    };
    zip.file("config.json", JSON.stringify(configData, null, 2));
    
    // Add background images if they're loaded
    if (settings.coverBackground) {
      try {
        const coverResponse = await fetch(settings.coverBackground);
        const coverBlob = await coverResponse.blob();
        zip.file("cover.png", coverBlob);
      } catch (error) {
        console.error("Error adding cover image:", error);
      }
    }
    
    if (settings.defaultBackground) {
      try {
        const bgResponse = await fetch(settings.defaultBackground);
        const bgBlob = await bgResponse.blob();
        zip.file("background.png", bgBlob);
      } catch (error) {
        console.error("Error adding background image:", error);
      }
    }
    
    // Add font file if available
    if (settings.customFontPath || settings.customFontUrl) {
      try {
        const fontSource = settings.customFontPath || settings.customFontUrl;
        console.log("Adding font from source:", fontSource);
        
        const fontResponse = await fetch(fontSource);
        const fontBlob = await fontResponse.blob();

        // Get appropriate filename with extension
        const format = settings.customFontFormat || 'ttf';
        
        // Add font metadata to help with reloading
        const fontMetadata = {
          format: format,
          family: settings.customFontFamily || `custom-font-${Date.now()}`
        };
        
        // Add both the font file and metadata
        zip.file(`font.${format}`, fontBlob);
        zip.file("font-metadata.json", JSON.stringify(fontMetadata));
        
        console.log(`Added font file and metadata to ZIP`);
      } catch (error) {
        console.error("Error adding font file:", error);
      }
    }
    
    // Generate and download the ZIP file
    const content = await zip.generateAsync({type: "blob"});
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = "debate_timer_config.zip";
    a.click();
    URL.revokeObjectURL(url);
  };
  
  const onDrop = (acceptedFiles) => {
    processJsonFile(
      acceptedFiles,
      setJsonFile,
      (loadedData) => {
        setData(loadedData);
        setSessions(loadedData); // Update sessions in the App component
        localStorage.setItem('debateTimerCustomData', JSON.stringify(loadedData));
      },
      setShowError,
      setErrorMessage
    );
  };

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  const handleDragStart = (e, index) => {
    e.dataTransfer.setData("dragIndex", index);
  };

  const handleDrop = (e, dropIndex) => {
    const dragIndex = e.dataTransfer.getData("dragIndex");
    const items = [...data];
    const [draggedItem] = items.splice(dragIndex, 1);
    items.splice(dropIndex, 0, draggedItem);
    setData(items);
  };

  const allowDrop = (e) => {
    e.preventDefault();
  };

  const handleDelete = (index) => {
    setData((prevData) => prevData.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    // Don't proceed with the save if there's no data
    if (data.length === 0) {
      setShowError(true);
      setErrorMessage("");
      return;
    }

    // Preserve all properties in each item, not just the basic ones
    // This ensures that properties like 'label1' needed by App.jsx are preserved
    const formattedData = data.map(item => {
      // First, ensure we have all the required properties with their standard names
      const formattedItem = {
        title: item.环节名称 || item.title || "",
        isDualTimer: item.双方环节 || item.isDualTimer || false,
        duration: item.时长 || item.duration || 0,
        // Ensure label1 and other potentially needed properties exist
        label1: item.label1 || "",
        label2: item.label2 || "",
        // Copy any other existing properties
        ...item
      };
      
      // Standardize property names if they're in Chinese
      if (item.环节名称) formattedItem.title = item.环节名称;
      if (item.双方环节 !== undefined) formattedItem.isDualTimer = item.双方环节;
      if (item.时长) formattedItem.duration = item.时长;
      
      return formattedItem;
    });
  
    // Save to localStorage
    localStorage.setItem('debateTimerSessions', JSON.stringify(formattedData));
    
    // Also update the current sessions state
    setSessions(formattedData);
    
    // Export to file if requested
    const fileName = window.prompt("输入导出文件名:", "data.json");
    if (fileName) {
      // Export the full data with all properties
      const blob = new Blob([JSON.stringify(formattedData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName || "data.json";
      a.click();
      URL.revokeObjectURL(url);
      
      // Close modal after successful save
      onClose();
    }
  };

  const handleDrag = (e) => {
    const container = containerRef.current;
    if (container) {
      const { clientY } = e;
      const { top, bottom } = container.getBoundingClientRect();
      const scrollSpeed = 2;

      // Scroll up when near the top
    if (clientY < top + 50) {
      container.scrollBy(0, -scrollSpeed);
    }

    // Scroll down when near the bottom
    if (clientY > bottom - 500) {
      container.scrollBy(0, scrollSpeed);
      }
    }
  };

  useEffect(() => {
    const container = containerRef.current;

    if (container) {
      container.addEventListener('drag', handleDrag);

      return () => {
        container.removeEventListener('drag', handleDrag);
      };
    }
  }, []);

  const prevDataLengthRef = useRef(data.length);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      // Only scroll if data length increased (new item added)
      if (data.length > prevDataLengthRef.current) {
        container.scrollTop = container.scrollHeight;
      }
    }
    // Update previous length reference
    prevDataLengthRef.current = data.length;
  }, [data]);

  const handleFontUpload = (file) => {
    setSettings(prev => ({
      ...prev,
      customFontFamily: 'DebateCustom',
      customFontPath: URL.createObjectURL(file),
      customFontFormat: file.name.split('.').pop().toLowerCase(),
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex justify-center items-center z-50">
      <div className="bg-white p-4 rounded-md shadow-md w-11/12 max-w-2xl relative flex flex-col h-[80vh]">
        <button
          className="absolute top-2 right-2 text-gray-600"
          onClick={onClose}
        >
          &times;
        </button>
        <div className="flex justify-start mb-4">
          <button
            className={`px-4 py-2 ${view === "upload" ? "bg-blue-500" : "bg-gray-300"} text-white rounded`}
            onClick={() => setView("upload")}
          >
            设定
          </button>
          <button
            className={`px-4 py-2 ${view === "customize" ? "bg-blue-500" : "bg-gray-300"} text-white rounded ml-2`}
            onClick={() => setView("customize")}
          >
            赛制
          </button>
        </div>

        <div
          ref={containerRef}
          className="flex-1 overflow-y-auto pb-20"
          onDragOver={allowDrop}
        >
          {view === "upload" && (
            <div className="space-y-3 ">
              {/* Section: Upload ZIP Config Package */}
              <div className="border rounded-lg p-4 shadow-sm">
                <h3 className="font-bold text-lg mb-2">上传 ZIP 配置包</h3>
                <p className="text-sm text-gray-600 mb-4">
                  第一次使用时请自行设置赛制、背景图和字体后再保存为 ZIP 配置包。
                </p>
                <input
                  type="file"
                  accept=".zip"
                  className="w-full border rounded p-2"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      handleCompletePackageUpload(file);
                    }
                  }}
                />
              </div>

              {/* Section: Background Images */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cover Background */}
                <div className="border rounded-lg p-4 shadow-sm">
                  <label className="block font-semibold text-gray-700 mb-2">封面背景</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full border rounded p-2"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        await handleSettingsChange("coverBackground", file);
                      }
                    }}
                  />
                  {settings.coverBackground && (
                    <img
                      src={settings.coverBackground}
                      alt="封面背景预览"
                      className="mt-3 w-full h-32 object-cover rounded"
                    />
                  )}
                </div>

                {/* Default Background */}
                <div className="border rounded-lg p-4 shadow-sm">
                  <label className="block font-semibold text-gray-700 mb-2">默认背景</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="w-full border rounded p-2"
                    onChange={async (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        await handleSettingsChange("defaultBackground", file);
                      }
                    }}
                  />
                  {settings.defaultBackground && (
                    <img
                      src={settings.defaultBackground}
                      alt="默认背景预览"
                      className="mt-3 w-full h-32 object-cover rounded"
                    />
                  )}
                </div>
              </div>

              {/* Section: Team Colors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Positive Color */}
                <div className="border rounded-lg p-4 shadow-sm">
                  <label className="block font-semibold text-gray-700 mb-2">正方颜色</label>
                  <div className="flex items-center">
                    <div
                      className="w-10 h-10 rounded-md border mr-3"
                      style={{ backgroundColor: settings.positiveColor }}
                    />
                    <button
                      className="px-4 py-2 bg-red-500 text-white rounded"
                      onClick={() => openColorModal("positiveColor", "正方颜色")}
                    >
                      选择颜色
                    </button>
                  </div>
                </div>

                {/* Negative Color */}
                <div className="border rounded-lg p-4 shadow-sm">
                  <label className="block font-semibold text-gray-700 mb-2">反方颜色</label>
                  <div className="flex items-center">
                    <div
                      className="w-10 h-10 rounded-md border mr-3"
                      style={{ backgroundColor: settings.negativeColor }}
                    />
                    <button
                      className="px-4 py-2 bg-red-500 text-white rounded"
                      onClick={() => openColorModal("negativeColor", "反方颜色")}
                    >
                      选择颜色
                    </button>
                  </div>
                </div>
              </div>

              {/* Section: Custom Font */}
              <div className="border rounded-lg p-4 shadow-sm">
                <label className="block font-semibold text-gray-700 mb-2">自定义字体</label>
                <div className="flex flex-col md:flex-row md:items-center md:space-x-3 space-y-2 md:space-y-0">
                  <input
                    type="file"
                    accept=".woff,.woff2,.ttf,.otf"
                    className="border rounded p-2 w-full md:w-auto"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        handleFontUpload(file);
                      }
                    }}
                  />
                </div>

                <div
                  className="mt-4 text-xl border rounded p-3 bg-gray-50"
                  style={{ fontFamily: settings.customFontFamily || "inherit" }}
                >
                  预览文字 / Preview Text / 0123456789
                </div>

                <div className="absolute bottom-0 right-0 bg-white p-4 w-full flex justify-end">
                <button
                  className="px-4 py-2 bg-green-500 text-white rounded mr-2"
                  onClick={exportCompletePackage}
                >
                  保存为ZIP
                </button>
              </div>
              </div>
            </div>
          )}

          

          {view === "customize" && (
            <div className="flex-1 overflow-y-auto" ref={containerRef} onDragOver={allowDrop}>
              {data.length === 0 ? (
                <div className="text-center p-6 text-gray-500">
                  暂无环节数据，请添加新的环节或从文件导入
                </div>
              ) : (
                data.map((item, index) => (
                  <div
                    key={index}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={allowDrop}
                    onDrop={(e) => handleDrop(e, index)}
                    className="bg-white p-4 mb-2 shadow rounded-md flex items-center justify-between"
                  >
                    <div className="flex items-center">
                      <div className="mr-2 cursor-pointer">&#9776;</div>
                      <div>
                        <p>环节名称: {item.title || item.环节名称}</p>
                        <p>时长: {item.duration || item.时长}秒</p>
                        <p>双方环节: {(item.isDualTimer || item.双方环节) ? "是" : "否"}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(index)}
                      className="ml-4 px-2 py-1 bg-red-500 text-white rounded"
                    >
                      删除
                    </button>
                  </div>
                ))
              )}

              <div className="absolute bottom-0 right-0 bg-white p-4 w-full flex justify-end">
                <button
                  className="px-4 py-2 bg-green-500 text-white rounded mr-2"
                  onClick={() => setIsAddModalOpen(true)}
                >
                  新增环节
                </button>
              </div>
            </div>  
          )}

        </div>

        {isAddModalOpen && (
          <AddModal setIsModalOpen={setIsAddModalOpen} setData={setData} />
        )}

        {isColorModalOpen && (
          <ColorModal
            isOpen={isColorModalOpen}
            onClose={() => setIsColorModalOpen(false)}
            onColorSelect={handleColorChange}
            title={colorModalTitle}
            initialColor={currentColorSetting === 'positiveColor' ? settings.positiveColor : settings.negativeColor}
          />
        )}
      </div>
    </div>
  );
};

function getFormat(filename) {
  if (filename.endsWith('.woff2')) return 'woff2';
  if (filename.endsWith('.woff')) return 'woff';
  if (filename.endsWith('.ttf')) return 'truetype';
  if (filename.endsWith('.otf')) return 'opentype';
  return 'truetype'; // default
}

function getContentType(format) {
  switch(format.toLowerCase()) {
    case 'woff2': return 'font/woff2';
    case 'woff': return 'font/woff';
    case 'ttf': return 'font/ttf';
    case 'otf': return 'font/otf';
    default: return 'font/ttf';
  }
}

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  setSessions: PropTypes.func.isRequired,
  settings: PropTypes.object.isRequired,
  setSettings: PropTypes.func.isRequired,
};

export default Modal;
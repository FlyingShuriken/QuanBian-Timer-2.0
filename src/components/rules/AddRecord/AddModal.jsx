import PropTypes from "prop-types";
import { useState } from "react";
import DurationPicker from "./DurationPicker";
import { normalizeSessions } from "../../../timer/config.mjs";

const AddModal = ({ setIsModalOpen, setData }) => {
  const [formData, setFormData] = useState({
    title: "",
    duration: { minutes: 0, seconds: 0 },
    isDualTimer: false, // Initialize as boolean
  });
  const [error, setError] = useState("");

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === "minutes" || name === "seconds") {
      setFormData((prev) => ({
        ...prev,
        duration: { ...prev.duration, [name]: parseInt(value, 10) || 0 },
      }));
    } else if (name === "isDualTimer") {
      setFormData((prev) => ({
        ...prev,
        isDualTimer: value === "true", // Convert string to boolean
      }));
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleAdd = () => {
    try {
      const [stage] = normalizeSessions([{
        ...formData,
        duration: formData.duration.minutes * 60 + formData.duration.seconds,
      }]);
      setData(prev => [...prev, stage]);
      setIsModalOpen(false);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex justify-center items-center">
      <div className="w-2/5 lg:w-1/5 bg-white p-8 rounded-md shadow-md relative">
        {/* Close button at the top right */}
        <button
          className="absolute top-2 right-2 text-gray-600"
          aria-label="关闭新增环节"
          onClick={() => setIsModalOpen(false)}
        >
          &times;
        </button>

        <h2 className="text-lg font-bold mb-4">新增环节</h2>

        <div className="w-full mb-4">
          <label htmlFor="stage-title" className="block mb-2">环节名称</label>
          <input
            type="text"
            name="title"
            id="stage-title"
            value={formData.title}
            onChange={handleInputChange}
            className="input w-full border border-slate-400 rounded p-4"
          />
        </div>

        <div className="w-full mb-4">
          <label htmlFor="stage-dual" className="block mb-2">
            双人环节
            <span
              className="ml-2"
              title="若双方都参与当前环节，如对辩、自由辩，请勾选“是”。"
            >
              ?
            </span>
          </label>
          <select
            name="isDualTimer"
            id="stage-dual"
            value={formData.isDualTimer ? "true" : "false"} // Convert boolean to string for display
            onChange={handleInputChange}
            className="tw-select tw-w-full"
          >
            <option value="true">是</option>
            <option value="false">否</option>
          </select>
        </div>

        <DurationPicker
          duration={formData.duration}
          handleInputChange={handleInputChange}
        />

        {error && <p role="alert" className="text-red-700">{error}</p>}
        <button type="button" className="rounded bg-blue-700 px-3 py-2 text-white" onClick={handleAdd}>
          添加
        </button>
      </div>
    </div>
  );
};

AddModal.propTypes = {
  setIsModalOpen: PropTypes.func.isRequired,
  setData: PropTypes.func.isRequired,
};

export default AddModal;


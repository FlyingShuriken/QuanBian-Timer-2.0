import PropTypes from "prop-types";

const TimeInput = ({ label, name, value, onChange }) => {
  return (
    <div className="flex flex-col justify-center">
      <input
        type="number"
        name={name}
        id={name}
        min={0}
        max={name === "seconds" ? 59 : 1440}
        value={value}
        onChange={onChange}
        className="w-full px-2 py-4 border border-slate-400 rounded text-3xl text-center overflow-hidden"
      />
      <label htmlFor={name} className="block mt-1 my-2">{label}</label>
    </div>
  );
};

TimeInput.propTypes = {
  label: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

export default TimeInput;

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import PropTypes from "prop-types";

const PauseModal = ({ isOpen }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-75">
      <div className="bg-white rounded p-4 relative w-96 flex flex-col items-center text-center">

        <ExclamationTriangleIcon className="h-16 w-16 text-red-600 mb-4" />
        <h1 className="text-3xl">{"暂停"}</h1>
        <p className="mt-2">{"电脑计时出现问题，当前环节请以手动计时为准"}</p>
      </div>
    </div>
  );
};

PauseModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
};

export default PauseModal;
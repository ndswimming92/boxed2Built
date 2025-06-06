import React from 'react';

const Modal = ({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: React.ReactNode }) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg max-w-3xl w-full p-6 relative overflow-y-auto max-h-[90vh] mx-4">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-black text-xl">&times;</button>
        {children}
      </div>
    </div>
  );
};

export default Modal;
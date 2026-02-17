import React, { useState } from 'react';

const DeleteModal = ({ isOpen, onClose, onConfirm, bookTitle }) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    await onConfirm();
    setIsDeleting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white p-6 rounded-lg w-full max-w-sm">
        <h2 className="text-xl font-bold mb-4">Confirm Delete</h2>
        <p className="mb-6">Are you sure you want to delete "{bookTitle}"?</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="w-full py-2 border rounded">Cancel</button>
          <button onClick={handleDelete} className="w-full py-2 bg-red-500 text-white rounded" disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;

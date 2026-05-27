
// frontend/src/admin/component/IsbnScannerModal.jsx
import React, { useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { X } from 'lucide-react';
import { Scanner } from '@yudiel/react-qr-scanner';

const extractIsbnFromRaw = (raw = '') => {
  const digits = String(raw).replace(/\D/g, '');

  if (digits.length === 13 && (digits.startsWith('978') || digits.startsWith('979'))) {
    return digits;
  }

  if (digits.length === 10) return digits;

  return '';
};

const IsbnScannerModal = ({ isOpen, onClose, onDetected }) => {
  const [error, setError] = useState('');

  const handleScan = (codes) => {
    try {
      const first = Array.isArray(codes) ? codes[0] : null;
      const raw = first?.rawValue || '';
      const isbn = extractIsbnFromRaw(raw);

      if (!isbn) return;
      onDetected(isbn);
      onClose();
    } catch (e) {
      setError('Failed to read barcode');
    }
  };

  return (
    <Transition appear show={isOpen} as={React.Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={onClose}>
        <div className="fixed inset-0 bg-black/60" />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-2xl bg-white rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-purple-800">Scan Book Barcode</h3>
                <button onClick={onClose}>
                  <X className="w-7 h-7 text-gray-500 hover:text-red-600" />
                </button>
              </div>

              <p className="text-sm text-gray-600 mb-4">
                Point the camera at the barcode on the back of the book.
              </p>

              <div className="overflow-hidden rounded-2xl border-2 border-purple-200">
                <Scanner
                  onScan={handleScan}
                  onError={(err) => {
                    console.error(err);
                    setError(err?.message || 'Camera error');
                  }}
                  constraints={{
                    facingMode: 'environment',
                  }}
                  formats={['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128']}
                  styles={{
                    container: { width: '100%', minHeight: 360 },
                    video: { width: '100%', height: 360, objectFit: 'cover' },
                  }}
                />
              </div>

              {error && (
                <p className="text-red-600 font-semibold mt-4">{error}</p>
              )}

              <div className="mt-4 text-sm text-gray-500">
                Tip: use a well-lit area and hold the book steady.
              </div>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default IsbnScannerModal;

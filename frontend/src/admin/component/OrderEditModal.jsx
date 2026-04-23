
import { Dialog, Transition } from '@headlessui/react';
import React, { Fragment, useEffect, useState } from 'react';
import { X } from 'lucide-react';

const OrderEditModal = ({ isOpen, onClose, order, onSave }) => {
  const [form, setForm] = useState({
    status: 'processing',
    shipping_amount_eur: '',
    shipping_provider: '',
    shipping_service: '',
    tracking_number: '',
    tracking_url: '',
  });

  useEffect(() => {
    if (!order) return;
    setForm({
      status: order.status || 'processing',
      shipping_amount_eur: order.shipping_amount_eur ?? '',
      shipping_provider: order.shipping_provider ?? '',
      shipping_service: order.shipping_service ?? '',
      tracking_number: order.tracking_number ?? '',
      tracking_url: order.tracking_url ?? '',
    });
  }, [order]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    onSave({
      id: order.id,
      ...form,
      shipping_amount_eur: Number(form.shipping_amount_eur || 0),
    });
    onClose();
  };

  if (!order) return null;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <div className="fixed inset-0 bg-black/30" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="w-full max-w-lg bg-white rounded-2xl p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <Dialog.Title className="text-xl font-bold text-purple-800">
                Edit Order #{order.id}
              </Dialog.Title>
              <button onClick={onClose}>
                <X className="w-6 h-6 text-gray-500 hover:text-red-600" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="font-semibold">Status</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  className="w-full mt-1 p-2 border rounded"
                >
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>

              <div>
                <label className="font-semibold">Shipping Amount (€)</label>
                <input
                  type="number"
                  step="0.01"
                  name="shipping_amount_eur"
                  value={form.shipping_amount_eur}
                  onChange={handleChange}
                  className="w-full mt-1 p-2 border rounded"
                />
              </div>

              <div>
                <label className="font-semibold">Shipping Provider</label>
                <input
                  type="text"
                  name="shipping_provider"
                  value={form.shipping_provider}
                  onChange={handleChange}
                  placeholder="DPD / DHL"
                  className="w-full mt-1 p-2 border rounded"
                />
              </div>

              <div>
                <label className="font-semibold">Shipping Service</label>
                <input
                  type="text"
                  name="shipping_service"
                  value={form.shipping_service}
                  onChange={handleChange}
                  placeholder="Classic / Paket"
                  className="w-full mt-1 p-2 border rounded"
                />
              </div>

              <div>
                <label className="font-semibold">Tracking Number</label>
                <input
                  type="text"
                  name="tracking_number"
                  value={form.tracking_number}
                  onChange={handleChange}
                  className="w-full mt-1 p-2 border rounded"
                />
              </div>

              <div>
                <label className="font-semibold">Tracking URL</label>
                <input
                  type="text"
                  name="tracking_url"
                  value={form.tracking_url}
                  onChange={handleChange}
                  className="w-full mt-1 p-2 border rounded"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={onClose}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-purple-600 text-white rounded font-bold"
              >
                Save
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </Transition>
  );
};

export default OrderEditModal;

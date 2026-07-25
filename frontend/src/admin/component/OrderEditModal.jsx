
import { Dialog, Transition } from '@headlessui/react';
import React, { Fragment, useEffect, useState } from 'react';
import { X, Package, User, MapPin, CreditCard, Tag, Wallet } from 'lucide-react';
import { format } from 'date-fns';

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

    // These are attached upstream in OrdersDashboard's enrichedOrders memo.
    // Fall back to raw/parsed-inline in case this modal is ever reused
    // with a plain (non-enriched) order object.
    const items = order.order_items_parsed
        ?? (typeof order.order_items === 'string' ? JSON.parse(order.order_items || '[]') : order.order_items) ?? [];
    const address = order.shipping_address_parsed
        ?? (typeof order.shipping_address === 'string' ? JSON.parse(order.shipping_address || '{}') : order.shipping_address) ?? {};
    const payment = order.payment_result_parsed
        ?? (typeof order.payment_result === 'string' ? JSON.parse(order.payment_result || '{}') : order.payment_result) ?? {};
    const user = order.user;

    const itemsSubtotal = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0), 0);

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <div className="fixed inset-0 bg-black/30" />
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="w-full max-w-2xl bg-white rounded-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <Dialog.Title className="text-xl font-bold text-purple-800">
                                Order #{order.id}
                                {order.created_at && (
                                    <span className="ml-3 text-sm font-normal text-gray-400">
                                        {format(new Date(order.created_at), 'MMM d, yyyy HH:mm')}
                                    </span>
                                )}
                            </Dialog.Title>
                            <button onClick={onClose}>
                                <X className="w-6 h-6 text-gray-500 hover:text-red-600" />
                            </button>
                        </div>

                        {/* ===== ORDER DETAILS (read-only) ===== */}
                        <div className="space-y-4 mb-6">

                            {/* Customer */}
                            <div className="bg-purple-50 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-sm font-bold text-purple-800 mb-2">
                                    <User className="w-4 h-4" /> Customer
                                </div>
                                <p className="text-sm text-gray-700">
                                    {user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'N/A' : 'Guest'}
                                </p>
                                <p className="text-sm text-gray-500">{user?.email || 'N/A'}</p>
                            </div>

                            {/* Shipping address */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                                    <MapPin className="w-4 h-4" /> Shipping Address
                                </div>
                                <p className="text-sm text-gray-700">
                                    {address.address || '—'}<br />
                                    {address.city || ''} {address.postalCode || ''}<br />
                                    {address.country || ''}
                                </p>
                            </div>

                            {/* Items */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                                    <Package className="w-4 h-4" /> Items ({items.length})
                                </div>
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-gray-500 border-b">
                                            <th className="pb-1 font-medium">Title</th>
                                            <th className="pb-1 font-medium text-center">Qty</th>
                                            <th className="pb-1 font-medium text-right">Price</th>
                                            <th className="pb-1 font-medium text-right">Line total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((it, idx) => (
                                            <tr key={idx} className="border-b border-gray-100 last:border-0">
                                                <td className="py-1.5 text-gray-800">{it.title_en || it.title_de || `Book #${it.bookId}`}</td>
                                                <td className="py-1.5 text-center">{it.quantity}</td>
                                                <td className="py-1.5 text-right">€{Number(it.price || 0).toFixed(2)}</td>
                                                <td className="py-1.5 text-right font-medium">€{((Number(it.price) || 0) * (Number(it.quantity) || 0)).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Payment + totals */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                                        <CreditCard className="w-4 h-4" /> Payment
                                    </div>
                                    <p className="text-sm text-gray-700">Method: {order.payment_method || '—'}</p>
                                    <p className="text-sm text-gray-700">Paid: {order.is_paid ? 'Yes' : 'No'}</p>
                                    {payment.status && <p className="text-sm text-gray-500">Status: {payment.status}</p>}
                                </div>

                                <div className="bg-gray-50 rounded-lg p-4">
                                    <div className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                                        <Tag className="w-4 h-4" /> Totals
                                    </div>
                                    <p className="text-sm text-gray-700">Items: €{itemsSubtotal.toFixed(2)}</p>
                                    <p className="text-sm text-gray-700">Shipping: €{Number(order.shipping_amount_eur || 0).toFixed(2)}</p>
                                    {Number(order.coupon_discount || 0) > 0 && (
                                        <p className="text-sm text-gray-700">Discount: -€{Number(order.coupon_discount).toFixed(2)} {order.coupon_code ? `(${order.coupon_code})` : ''}</p>
                                    )}
                                    {Number(order.wallet_used || 0) > 0 && (
                                        <p className="text-sm text-gray-700 flex items-center gap-1"><Wallet className="w-3 h-3" /> Wallet used: -€{Number(order.wallet_used).toFixed(2)}</p>
                                    )}
                                    <p className="text-sm font-bold text-green-700 mt-1">Total: €{Number(order.total || 0).toFixed(2)}</p>
                                </div>
                            </div>
                        </div>

                        {/* ===== UPDATE ORDER (editable) ===== */}
                        <div className="border-t pt-4">
                            <p className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">Update Order</p>
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
                                        <option value="cancelled">Cancelled</option>
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

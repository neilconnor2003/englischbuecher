import React, { useState } from 'react';
import BookModal from './BookModal';
// Replace with actual RTK Query hook
const useGetOrderItemsQuery = () => ({ data: [], isLoading: false }); // Placeholder

const OrderItemsDashboard = () => {
  const { data: orderItems = [], isLoading } = useGetOrderItemsQuery();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const fields = [
    { name: 'order_id', label: 'Order ID', type: 'number', required: true },
    { name: 'book_id', label: 'Book ID', type: 'number', required: true },
    { name: 'quantity', label: 'Quantity', type: 'number', required: true },
    { name: 'price', label: 'Price', type: 'number', required: true },
  ];

  const handleAdd = () => {
    setSelectedItem(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  const handleSave = (data) => {
    //console.log('Save order item:', data); // Replace with API call
    setIsModalOpen(false);
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Order Items</h1>
      <button
        onClick={handleAdd}
        className="mb-4 px-4 py-2 bg-primary text-white rounded hover:bg-secondary"
      >
        Add Order Item
      </button>
      <BookModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        book={selectedItem}
        onSave={handleSave}
        fields={fields}
      />
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2">Order ID</th>
            <th className="p-2">Book ID</th>
            <th className="p-2">Quantity</th>
            <th className="p-2">Price</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orderItems.map((item) => (
            <tr key={item.id} className="border-b">
              <td className="p-2">{item.order_id}</td>
              <td className="p-2">{item.book_id}</td>
              <td className="p-2">{item.quantity}</td>
              <td className="p-2">{item.price}</td>
              <td className="p-2">
                <button
                  onClick={() => handleEdit(item)}
                  className="text-blue-500 hover:underline"
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default OrderItemsDashboard;

import React, { useEffect, useState } from 'react';
import config from '@config';

const StockManager = () => {
  const [books, setBooks] = useState([]);
  const [loadingId, setLoadingId] = useState(null);

  const fetchBooks = async () => {
    const res = await fetch(`${config.API_URL}/api/books`);
    const data = await res.json();
    setBooks(data);
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const handleChange = (id, value) => {
    setBooks(prev =>
      prev.map(b =>
        b.id === id ? { ...b, stock: value } : b
      )
    );
  };

  const updateStock = async (book) => {
    setLoadingId(book.id);

    try {
      await fetch(`${config.API_URL}/api/admin/books/stock/${book.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: Number(book.stock) })
      });

    } catch (err) {
      console.error(err);
      alert('❌ Update failed');
    }

    setLoadingId(null);
    fetchBooks();
  };

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold mb-6 text-purple-800">
        📦 Stock Manager
      </h2>

      <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
        
        {/* HEADER */}
        <div className="grid grid-cols-4 gap-4 bg-purple-100 p-4 font-bold text-gray-700">
          <div>Book</div>
          <div>Stock</div>
          <div>Available</div>
          <div>Action</div>
        </div>

        {/* LIST */}
        {books.map(book => (
          <div
            key={book.id}
            className="grid grid-cols-4 gap-4 items-center p-4 border-t hover:bg-gray-50 transition"
          >
            {/* Book Title */}
            <div className="font-semibold text-gray-800">
              {book.title_en}
            </div>

            {/* Stock Input */}
            <div>
              <input
                type="number"
                value={book.stock || 0}
                onChange={(e) => handleChange(book.id, e.target.value)}
                className="w-24 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Availability Badge */}
            <div>
              {book.stock > 0 ? (
                <span className="px-3 py-1 bg-green-200 text-green-800 rounded-full text-sm font-bold">
                  ✅ In Stock
                </span>
              ) : (
                <span className="px-3 py-1 bg-red-200 text-red-800 rounded-full text-sm font-bold">
                  ❌ Out of Stock
                </span>
              )}
            </div>

            {/* Save Button */}
            <div>
              <button
                onClick={() => updateStock(book)}
                className="px-5 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50"
                disabled={loadingId === book.id}
              >
                {loadingId === book.id ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ))}

      </div>

      {/* EMPTY STATE */}
      {books.length === 0 && (
        <div className="text-center mt-10 text-gray-500">
          No books found.
        </div>
      )}
    </div>
  );
};

export default StockManager;


import React, { useEffect, useState } from 'react';
import config from '@config';

const StockManager = () => {
  const [books, setBooks] = useState([]);

  const fetchBooks = async () => {
    const res = await fetch(`${config.API_URL}/api/books`);
    const data = await res.json();
    setBooks(data);
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const updateStock = async (id, stock) => {
    await fetch(`${config.API_URL}/api/admin/books/stock/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stock })
    });

    fetchBooks();
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Stock Manager</h2>

      <table className="min-w-full border text-sm">
        <thead>
          <tr>
            <th>Book</th>
            <th>Stock</th>
            <th>Available</th>
            <th>Update</th>
          </tr>
        </thead>

        <tbody>
          {books.map(book => (
            <tr key={book.id}>
              <td>{book.title_en}</td>

              <td>
                <input
                  type="number"
                  defaultValue={book.stock}
                  onChange={(e) =>
                    updateStock(book.id, e.target.value)
                  }
                />
              </td>

              <td>{book.stock > 0 ? '✅' : '❌'}</td>

              <td>Auto</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StockManager;

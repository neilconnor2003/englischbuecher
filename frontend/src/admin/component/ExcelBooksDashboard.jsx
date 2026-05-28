
import React, { useEffect, useState } from 'react';
import config from '@config';

const ExcelBooksDashboard = () => {
  const [books, setBooks] = useState([]);

  const fetchExcelBooks = async () => {
    const res = await fetch(`${config.API_URL}/api/admin/excel-books`, {
      credentials: 'include'
    });
    const data = await res.json();
    setBooks(data);
  };

  useEffect(() => {
    fetchExcelBooks();
  }, []);

  const handleChange = (id, field, value) => {
    setBooks(prev =>
      prev.map(b => b.id === id ? { ...b, [field]: value } : b)
    );
  };

  const saveRow = async (book) => {
    await fetch(`${config.API_URL}/api/admin/excel-books/${book.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(book)
    });

    alert('✅ Saved');
  };

  const uploadExcel = async (e) => {
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    await fetch(`${config.API_URL}/api/admin/upload-excel`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    alert('✅ Uploaded');
    fetchExcelBooks();
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Excel Master Data</h2>

      {/* Upload */}
      <input type="file" accept=".xlsx" onChange={uploadExcel} />

      {/* Table */}
      <div className="mt-6 overflow-auto">
        <table className="min-w-full border text-sm">
          <thead>
            <tr>
              <th>ISBN13</th>
              <th>Title EN</th>
              <th>Price</th>
              <th>Category</th>
              <th>Publisher</th>
              <th>Save</th>
            </tr>
          </thead>

          <tbody>
            {books.map(book => (
              <tr key={book.id}>
                <td>{book.isbn13}</td>

                <td>
                  <input
                    value={book.title_en || ''}
                    onChange={e => handleChange(book.id, 'title_en', e.target.value)}
                  />
                </td>

                <td>
                  <input
                    value={book.price || ''}
                    onChange={e => handleChange(book.id, 'price', e.target.value)}
                  />
                </td>

                <td>
                  <input
                    value={book.category_id || ''}
                    onChange={e => handleChange(book.id, 'category_id', e.target.value)}
                  />
                </td>

                <td>
                  <input
                    value={book.publisher || ''}
                    onChange={e => handleChange(book.id, 'publisher', e.target.value)}
                  />
                </td>

                <td>
                  <button onClick={() => saveRow(book)}>
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>

        </table>
      </div>
    </div>
  );
};

export default ExcelBooksDashboard;

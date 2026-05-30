
import React, { useEffect, useMemo, useState } from 'react';
import config from '@config';

const PriceManager = () => {
  const [books, setBooks] = useState([]);
  const [loadingId, setLoadingId] = useState(null);

  const [filters, setFilters] = useState({
    isbn: '',
    binding: '',
    edition: '',
  });

  const fetchBooks = async () => {
    try {
      const res = await fetch(`${config.API_URL}/api/books`);
      const data = await res.json();
      setBooks(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch books:', err);
      setBooks([]);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, []);

  const handleChange = (id, field, value) => {
    setBooks(prev =>
      prev.map(b =>
        b.id === id ? { ...b, [field]: value } : b
      )
    );
  };

  const updatePrice = async (book) => {
    setLoadingId(book.id);

    try {
      const res = await fetch(`${config.API_URL}/api/admin/books/price/${book.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price: Number(book.price),
          original_price:
            book.original_price !== '' &&
            book.original_price !== null &&
            book.original_price !== undefined
              ? Number(book.original_price)
              : null
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Update failed');
      }

      alert(
        `✅ Updated successfully\nBooks rows: ${data.updatedBooksRows}\nExcel rows: ${data.updatedExcelRows}`
      );
    } catch (err) {
      console.error(err);
      alert(`❌ Update failed: ${err.message}`);
    } finally {
      setLoadingId(null);
      fetchBooks();
    }
  };

  const getDisplayIsbn = (book) => {
    return book.isbn13 || book.isbn10 || book.isbn || '';
  };

  const isbnOptions = useMemo(() => {
    const values = books
      .map(getDisplayIsbn)
      .filter(Boolean);

    return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)));
  }, [books]);

  const bindingOptions = useMemo(() => {
    const values = books
      .map(book => book.binding)
      .filter(Boolean);

    return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)));
  }, [books]);

  const editionOptions = useMemo(() => {
    const values = books
      .map(book => book.edition)
      .filter(Boolean);

    return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)));
  }, [books]);

  const filteredBooks = useMemo(() => {
    const isbnFilter = filters.isbn.trim().toLowerCase();
    const bindingFilter = filters.binding.trim().toLowerCase();
    const editionFilter = filters.edition.trim().toLowerCase();

    return books.filter(book => {
      const isbnValue = String(getDisplayIsbn(book)).toLowerCase();
      const bindingValue = String(book.binding || '').toLowerCase();
      const editionValue = String(book.edition || '').toLowerCase();

      const matchesIsbn = !isbnFilter || isbnValue.includes(isbnFilter);
      const matchesBinding = !bindingFilter || bindingValue.includes(bindingFilter);
      const matchesEdition = !editionFilter || editionValue.includes(editionFilter);

      return matchesIsbn && matchesBinding && matchesEdition;
    });
  }, [books, filters]);

  const clearFilters = () => {
    setFilters({
      isbn: '',
      binding: '',
      edition: '',
    });
  };

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold mb-6 text-purple-800">
        💶 Price Manager
      </h2>

      {/* FILTER BAR */}
      <div className="bg-white shadow-xl rounded-2xl p-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-end gap-4">
          {/* ISBN */}
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Filter by ISBN
            </label>
            <input
              type="text"
              value={filters.isbn}
              onChange={(e) =>
                setFilters(prev => ({ ...prev, isbn: e.target.value }))
              }
              list="isbn-options"
              placeholder="Type ISBN..."
              className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <datalist id="isbn-options">
              {isbnOptions.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </div>

          {/* Binding */}
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Filter by Binding
            </label>
            <input
              type="text"
              value={filters.binding}
              onChange={(e) =>
                setFilters(prev => ({ ...prev, binding: e.target.value }))
              }
              list="binding-options"
              placeholder="Type binding..."
              className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <datalist id="binding-options">
              {bindingOptions.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </div>

          {/* Edition */}
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Filter by Edition
            </label>
            <input
              type="text"
              value={filters.edition}
              onChange={(e) =>
                setFilters(prev => ({ ...prev, edition: e.target.value }))
              }
              list="edition-options"
              placeholder="Type edition..."
              className="w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <datalist id="edition-options">
              {editionOptions.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          </div>

          {/* Clear */}
          <div>
            <button
              type="button"
              onClick={clearFilters}
              className="px-5 py-3 bg-gray-200 text-gray-800 rounded-xl font-semibold hover:bg-gray-300 transition"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-500">
          Showing <span className="font-semibold">{filteredBooks.length}</span> of{' '}
          <span className="font-semibold">{books.length}</span> books
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
        <div className="grid grid-cols-7 gap-4 bg-purple-100 p-4 font-bold text-gray-700">
          <div>Book</div>
          <div>ISBN</div>
          <div>Binding</div>
          <div>Edition</div>
          <div>Price (€)</div>
          <div>Original Price (€)</div>
          <div>Action</div>
        </div>

        {filteredBooks.map(book => (
          <div
            key={book.id}
            className="grid grid-cols-7 gap-4 items-center p-4 border-t hover:bg-gray-50 transition"
          >
            {/* Book */}
            <div className="font-semibold text-gray-800">
              {book.title_en}
            </div>

            {/* ISBN */}
            <div className="text-sm text-gray-700 break-all">
              {getDisplayIsbn(book) || '-'}
            </div>

            {/* Binding */}
            <div className="text-sm text-gray-700">
              {book.binding || '-'}
            </div>

            {/* Edition */}
            <div className="text-sm text-gray-700">
              {book.edition || '-'}
            </div>

            {/* Price */}
            <div>
              <input
                type="number"
                step="0.01"
                value={book.price ?? 0}
                onChange={(e) => handleChange(book.id, 'price', e.target.value)}
                className="w-28 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Original Price */}
            <div>
              <input
                type="number"
                step="0.01"
                value={book.original_price ?? ''}
                onChange={(e) => handleChange(book.id, 'original_price', e.target.value)}
                className="w-28 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            </div>

            {/* Save */}
            <div>
              <button
                onClick={() => updatePrice(book)}
                className="px-5 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50"
                disabled={loadingId === book.id}
              >
                {loadingId === book.id ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredBooks.length === 0 && (
        <div className="text-center mt-10 text-gray-500">
          No matching books found.
        </div>
      )}
    </div>
  );
};

export default PriceManager;

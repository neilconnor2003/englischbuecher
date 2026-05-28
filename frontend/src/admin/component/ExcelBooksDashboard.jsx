
import React, { useEffect, useState } from 'react';
import config from '@config';

const ExcelBooksDashboard = () => {
    const [books, setBooks] = useState([]);
    const [loadingId, setLoadingId] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [selectedBook, setSelectedBook] = useState(null);

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
        setLoadingId(book.id);

        try {
            await fetch(`${config.API_URL}/api/admin/excel-books/${book.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(book)
            });

        } catch (err) {
            console.error(err);
            alert('❌ Save failed');
        }

        setLoadingId(null);
    };

    const uploadExcel = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setUploading(true);

        try {
            /*await fetch(`${config.API_URL}/api/admin/upload-excel`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            alert('✅ Excel uploaded successfully');*/


            const res = await fetch(`${config.API_URL}/api/admin/upload-excel`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            if (!res.ok) throw new Error('Upload failed');

            alert('✅ Uploaded successfully');

            fetchExcelBooks();

        } catch (err) {
            console.error(err);
            alert('❌ Upload failed');
        }

        setUploading(false);
    };

    return (
        <div className="p-8">

            {/* TITLE */}
            <h2 className="text-3xl font-bold mb-6 text-purple-800">
                📊 Excel Master Data
            </h2>

            {/* ✅ UPLOAD CARD */}
            <div className="bg-white shadow-lg rounded-2xl p-6 mb-6">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">
                    Upload New Excel File
                </h3>

                <input
                    type="file"
                    accept=".xlsx"
                    onChange={uploadExcel}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:bg-purple-600 file:text-white hover:file:bg-purple-700"
                />

                {uploading && (
                    <p className="text-purple-600 mt-2">Uploading...</p>
                )}
            </div>

            {/* ✅ TABLE */}
            <div className="bg-white shadow-xl rounded-2xl overflow-hidden">

                {/* HEADER */}
                <div className="grid grid-cols-5 gap-4 p-4 bg-purple-100 font-bold text-gray-700">
                    <div>ISBN</div>
                    <div>Title</div>
                    <div>Price</div>
                    <div>Category</div>
                    <div>Action</div>
                </div>

                {/* ROWS */}
                {books.map(book => (
                    <div
                        key={book.id}
                        className="grid grid-cols-5 gap-4 items-center p-4 border-t hover:bg-gray-50 transition"
                    >

                        {/* ISBN */}
                        <div className="text-gray-600 text-sm">
                            {book.isbn13}
                        </div>

                        {/* TITLE */}
                        <div>
                            <input
                                value={book.title_en || ''}
                                onChange={e => handleChange(book.id, 'title_en', e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                            />
                        </div>

                        {/* PRICE */}
                        <div>
                            <input
                                type="number"
                                value={book.price || ''}
                                onChange={e => handleChange(book.id, 'price', e.target.value)}
                                className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                            />
                        </div>

                        {/* CATEGORY */}
                        <div>
                            <input
                                value={book.category_id || ''}
                                onChange={e => handleChange(book.id, 'category_id', e.target.value)}
                                className="w-20 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                            />
                        </div>

                        {/* SAVE BUTTON */}
                        <div>
                            {/*<button
                                onClick={() => saveRow(book)}
                                disabled={loadingId === book.id}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50"
                            >
                                {loadingId === book.id ? 'Saving...' : 'Save'}
                            </button>*/}

                            <button
                                onClick={() => setSelectedBook(book)}
                                Edit
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition disabled:opacity-50"
                            >
                            </button>

                        </div>

                    </div>
                ))}

            </div>


            {selectedBook && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">

                    <div className="bg-white w-[800px] max-h-[90vh] overflow-y-auto p-6 rounded-2xl shadow-xl">

                        <h2 className="text-xl font-bold mb-4">Edit Book Details</h2>

                        {/* TITLE */}
                        <div className="mb-3">
                            <label>Title</label>
                            <input
                                value={selectedBook.title_en || ''}
                                onChange={(e) =>
                                    setSelectedBook({ ...selectedBook, title_en: e.target.value })
                                }
                                className="w-full border p-2 rounded"
                            />
                        </div>

                        {/* DESCRIPTION EN */}
                        <div className="mb-3">
                            <label>Description (EN)</label>
                            <textarea
                                value={selectedBook.description_en || ''}
                                onChange={(e) =>
                                    setSelectedBook({ ...selectedBook, description_en: e.target.value })
                                }
                                className="w-full border p-2 rounded"
                                rows={4}
                            />
                        </div>

                        {/* DESCRIPTION DE */}
                        <div className="mb-3">
                            <label>Description (DE)</label>
                            <textarea
                                value={selectedBook.description_de || ''}
                                onChange={(e) =>
                                    setSelectedBook({ ...selectedBook, description_de: e.target.value })
                                }
                                className="w-full border p-2 rounded"
                                rows={4}
                            />
                        </div>

                        {/* PUBLISHER */}
                        <div className="mb-3">
                            <label>Publisher</label>
                            <input
                                value={selectedBook.publisher || ''}
                                onChange={(e) =>
                                    setSelectedBook({ ...selectedBook, publisher: e.target.value })
                                }
                                className="w-full border p-2 rounded"
                            />
                        </div>

                        {/* PAGES */}
                        <div className="mb-3">
                            <label>Pages</label>
                            <input
                                value={selectedBook.pages || ''}
                                onChange={(e) =>
                                    setSelectedBook({ ...selectedBook, pages: e.target.value })
                                }
                                className="w-full border p-2 rounded"
                            />
                        </div>

                        {/* SAVE BUTTON */}
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={async () => {
                                    await saveRow(selectedBook);
                                    setSelectedBook(null);
                                }}
                                className="bg-purple-600 text-white px-4 py-2 rounded"
                            >
                                Save
                            </button>

                            <button
                                onClick={() => setSelectedBook(null)}
                                className="bg-gray-300 px-4 py-2 rounded"
                            >
                                Cancel
                            </button>
                        </div>

                    </div>
                </div>
            )}


            {/* EMPTY STATE */}
            {books.length === 0 && (
                <div className="text-center mt-10 text-gray-500">
                    No Excel data found.
                </div>
            )}

        </div>
    );
};

export default ExcelBooksDashboard;

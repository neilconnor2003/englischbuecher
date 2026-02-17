// frontend/src/admin/component/Dashboard.jsx
import React, { useState, useMemo, useEffect } from "react";
import BookModal from "./BookModal";
import DeleteModal from "./DeleteModal";
import Toast from "./Toast";
import BookSkeleton from "./BookSkeleton";
import {
  Package,
  Plus,
  Search,
  Filter,
  Download,
  Grid,
  Table,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  GripVertical,
} from "lucide-react";
import {
  useAddBookMutation,
  useDeleteBookMutation,
  useGetBooksQuery,
  useUpdateBookMutation,
  useGetCategoriesQuery,
} from "../features/book/bookApiSlice";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableBookCard = ({ book, onEdit, onDelete, isSelected, onSelect }) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: book.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const stockStatus = book.stock > 10 ? 'in-stock' : book.stock > 0 ? 'low' : 'out';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-xl shadow-sm hover:shadow-lg transition-all p-4 border ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'}`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onSelect}
          className="mt-1 w-4 h-4 text-blue-600 rounded"
        />
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="w-5 h-5 text-gray-400" />
        </div>
        <img
          src={book.image || '/book-placeholder.png'}
          alt={book.title_en}
          className="w-16 h-20 object-cover rounded-md"
        />
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{book.title_en}</h3>
          <p className="text-sm text-gray-600">{book.author}</p>
          <div className="text-xs text-purple-600 space-y-1">
            <div>ISBN-13: {book.isbn13 || book.isbn}</div>
            {book.isbn10 && <div>ISBN-10: {book.isbn10}</div>}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className={`px-2 py-1 text-xs rounded-full ${stockStatus === 'in-stock' ? 'bg-green-100 text-green-700' :
              stockStatus === 'low' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
              {book.stock} in stock
            </span>
            <span className="text-xs text-gray-500">ID: {book.id}</span>
          </div>
          <div className="flex gap-1 mt-3">
            <button onClick={() => onEdit(book)} className="p-1 hover:bg-gray-100 rounded">
              <Edit className="w-4 h-4 text-blue-600" />
            </button>
            <button onClick={() => onDelete(book)} className="p-1 hover:bg-gray-100 rounded">
              <Trash2 className="w-4 h-4 text-red-600" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { data: books = [], isLoading } = useGetBooksQuery(undefined, { refetchOnMountOrArgChange: true });
  const { data: catData = { flat: [] } } = useGetCategoriesQuery();
  const categories = Array.isArray(catData.flat) ? catData.flat : [];

  const [addBook] = useAddBookMutation();
  const [updateBook] = useUpdateBookMutation();
  const [deleteBook] = useDeleteBookMutation();

  const [viewMode, setViewMode] = useState('card');
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [showFeaturedOnly, setShowFeaturedOnly] = useState(false);
  const [showNewReleasesOnly, setShowNewReleasesOnly] = useState(false);   // ← NEW LINE
  const [currentPage, setCurrentPage] = useState(1);
  const [modalBook, setModalBook] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState(null);
  const [toast, setToast] = useState(null);
  const [selectedBooks, setSelectedBooks] = useState([]);
  const [forceIsbnMode, setForceIsbnMode] = useState(false); // ← THIS IS THE KEY

  const itemsPerPage = viewMode === 'card' ? 12 : 10;
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      const matchesSearch = !searchTerm ||
        book.title_en?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.author?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        book.isbn?.includes(searchTerm) ||
        book.isbn10?.includes(searchTerm) ||
        book.isbn13?.includes(searchTerm);

      const matchesCategory = !categoryFilter || book.category_id === parseInt(categoryFilter);
      const matchesStock = stockFilter === 'all' ||
        (stockFilter === 'low' && book.stock > 0 && book.stock <= 10) ||
        (stockFilter === 'out' && book.stock === 0) ||
        (stockFilter === 'in' && book.stock > 10);

      const matchesFeatured = !showFeaturedOnly || book.is_featured === 1;
      const matchesNewRelease = !showNewReleasesOnly || book.is_new_release === 1;   // ← NEW LINE

      return matchesSearch && matchesCategory && matchesStock && matchesFeatured && matchesNewRelease;
    });
  }, [books, searchTerm, categoryFilter, stockFilter, showFeaturedOnly, showNewReleasesOnly]);

  const totalPages = Math.ceil(filteredBooks.length / itemsPerPage);
  const displayedBooks = filteredBooks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const showToast = (msg, type) => setToast({ message: msg, type });
  const closeToast = () => setToast(null);

  const handleSaveBook = async (bookData) => {
    try {
      if (bookData.id) {
        await updateBook({ id: bookData.id, ...bookData }).unwrap();
        showToast("Book updated!", "success");
      } else {
        await addBook(bookData).unwrap();
        showToast("Book added!", "success");
      }
    } catch (err) {
      showToast("Save failed: " + (err.data?.error || err.message), "error");
    }
    setIsModalOpen(false);
    setModalBook(null);
    setForceIsbnMode(false);
  };

  const handleDelete = async () => {
    try {
      await deleteBook(bookToDelete.id).unwrap();
      setSelectedBooks(prev => prev.filter(id => id !== bookToDelete.id));
      showToast("Book deleted!", "success");
    } catch {
      showToast("Delete failed", "error");
    }
    setIsDeleteModalOpen(false);
  };

  const handleBulkDelete = async () => {
    try {
      for (const id of selectedBooks) await deleteBook(id).unwrap();
      showToast(`${selectedBooks.length} books deleted!`, "success");
      setSelectedBooks([]);
    } catch {
      showToast("Bulk delete failed", "error");
    }
  };

  const toggleSelect = (id) => {
    setSelectedBooks(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedBooks(displayedBooks.map(b => b.id));
  };

  const exportCSV = () => {
    const headers = ["ID", "Title", "Author", "ISBN-13", "ISBN-10", "Price", "Stock", "Category"];
    const rows = filteredBooks.map(b => [
      b.id,
      `"${b.title_en}"`,
      `"${b.author}"`,
      b.isbn13 || b.isbn || '',
      b.isbn10 || '',
      b.price,
      b.stock,
      `"${categories.find(c => c.id === b.category_id)?.name_en || ''}"`
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `books_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-purple-800">Books Dashboard</h1>
            <span className="text-sm text-gray-500">({books.length} total)</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="p-2 rounded-lg hover:bg-gray-100" title="Export CSV">
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              {viewMode === 'card' ? <Table className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
            </button>
            <button
              onClick={() => {
                setModalBook(null);
                setForceIsbnMode(true);  // ← THIS IS THE FIX
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 font-bold"
            >
              <Plus className="w-5 h-5" /> Add Book
            </button>
          </div>
        </div>

        {/* FILTERS */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search title, author, ISBN..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {'—'.repeat(cat.level || 0)} {cat.name_en}
              </option>
            ))}
          </select>
          <select
            value={stockFilter}
            onChange={e => setStockFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Stock</option>
            <option value="in">In Stock (greater than 10)</option>
            <option value="low">Low Stock (1-10)</option>
            <option value="out">Out of Stock</option>
          </select>

          {/* NEW: Featured Toggle */}
          <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-amber-300 rounded-lg">
            <span className="text-sm font-medium text-amber-800">Featured Only</span>
            <button
              onClick={() => setShowFeaturedOnly(!showFeaturedOnly)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showFeaturedOnly ? 'bg-amber-500' : 'bg-gray-300'
                }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showFeaturedOnly ? 'translate-x-6' : 'translate-x-1'
                  }`}
              />
            </button>
          </div>

          {/* NEW: New Releases Toggle */}
          <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-orange-50 to-red-50 border-2 border-red-300 rounded-lg">
            <span className="text-sm font-medium text-red-800">New Releases</span>
            <button
              onClick={() => setShowNewReleasesOnly(!showNewReleasesOnly)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showNewReleasesOnly ? 'bg-red-500' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${showNewReleasesOnly ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Filter className="w-4 h-4" />
            <span>{filteredBooks.length} shown</span>
          </div>
        </div>
      </div>

      {/* BULK ACTIONS */}
      {selectedBooks.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-purple-200 rounded-lg p-4 mb-4 flex items-center justify-between">
          <span className="font-bold text-purple-900">{selectedBooks.length} books selected</span>
          <div className="flex gap-2">
            <button onClick={handleBulkDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">
              Delete Selected
            </button>
            <button onClick={() => setSelectedBooks([])} className="px-4 py-2 border-2 border-purple-600 text-purple-600 rounded-lg hover:bg-purple-100 text-sm font-medium">
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* CONTENT */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <BookSkeleton key={i} />)}
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="text-center py-20">
          <p className="mt-6 text-xl text-gray-500">No books found. Try adjusting your filters or add a new book!</p>
        </div>
      ) : viewMode === 'card' ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter}>
          <SortableContext items={displayedBooks.map(b => b.id)} strategy={verticalListSortingStrategy}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {displayedBooks.map(book => (
                <SortableBookCard
                  key={book.id}
                  book={book}
                  onEdit={(b) => {
                    setModalBook(b);
                    setForceIsbnMode(false);
                    setIsModalOpen(true);
                  }}
                  onDelete={(b) => { setBookToDelete(b); setIsDeleteModalOpen(true); }}
                  isSelected={selectedBooks.includes(book.id)}
                  onSelect={() => toggleSelect(book.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        // TABLE VIEW
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-purple-600 to-blue-600 text-white">
                <tr>
                  <th className="p-4 text-left"><input type="checkbox" onChange={selectAll} checked={selectedBooks.length === displayedBooks.length && displayedBooks.length > 0} /></th>
                  <th className="p-4 text-left">Cover</th>
                  <th className="p-4 text-left">Title</th>
                  <th className="p-4 text-left">Author</th>
                  <th className="p-4 text-left">ISBN-13</th>
                  <th className="p-4 text-left">ISBN-10</th>
                  <th className="p-4 text-left">Price</th>
                  <th className="p-4 text-left">Stock</th>
                  <th className="p-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {displayedBooks.map(book => (
                  <tr key={book.id} className="hover:bg-purple-50 transition">
                    <td className="p-4"><input type="checkbox" checked={selectedBooks.includes(book.id)} onChange={() => toggleSelect(book.id)} /></td>
                    <td className="p-4"><img src={book.image || '/book-placeholder.png'} alt="" className="w-12 h-16 object-cover rounded shadow" /></td>
                    <td className="p-4 font-semibold text-gray-800">{book.title_en}</td>
                    <td className="p-4 text-gray-600">{book.author}</td>
                    <td className="p-4 text-sm font-mono">{book.isbn13 || book.isbn}</td>
                    <td className="p-4 text-sm font-mono text-gray-500">{book.isbn10 || '-'}</td>
                    <td className="p-4 font-bold text-green-600">${book.price}</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 text-xs rounded-full font-bold ${book.stock > 10 ? 'bg-green-100 text-green-800' :
                        book.stock > 0 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                        {book.stock}
                      </span>
                    </td>
                    <td className="p-4">
                      <button onClick={() => {
                        setModalBook(book);
                        setForceIsbnMode(false);
                        setIsModalOpen(true);
                      }} className="text-blue-600 hover:bg-blue-100 p-2 rounded"><Edit className="w-5 h-5" /></button>
                      <button onClick={() => { setBookToDelete(book); setIsDeleteModalOpen(true); }} className="text-red-600 hover:bg-red-100 p-2 rounded ml-1"><Trash2 className="w-5 h-5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-10">
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-6 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-xl hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-bold text-purple-800">Page {currentPage} of {totalPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-6 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-xl hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* MODALS */}
      <BookModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalBook(null);
          setForceIsbnMode(false);
        }}
        book={modalBook}
        onSave={handleSaveBook}
        forceIsbnMode={forceIsbnMode}
      />

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        bookTitle={bookToDelete?.title_en || ""}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
    </div>
  );
};

export default Dashboard;
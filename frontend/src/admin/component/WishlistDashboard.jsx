import React, { useState } from 'react';
import {
  useGetWishlistsQuery,
  useRemoveFromWishlistMutation,
  useRestoreWishlistItemMutation,
  useGetWishlistAuditQuery
} from '../features/wishlist/wishlistAdminApiSlice';
import {
  Heart, Search, Download, Grid, Table,
  ChevronLeft, ChevronRight, Trash2, RefreshCw,
  FileText, Clock, User, Book
} from 'lucide-react';
import { format } from 'date-fns';

const WishlistDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState('table');
  const [selectedItemForAudit, setSelectedItemForAudit] = useState(null);
  const limit = 10;

  const { data, isLoading, isFetching, error } = useGetWishlistsQuery({
    page,
    limit,
    search: searchTerm
  });

  const [removeFromWishlist] = useRemoveFromWishlistMutation();
  const [restoreItem] = useRestoreWishlistItemMutation();
  const { data: auditLogs } = useGetWishlistAuditQuery(
    selectedItemForAudit?.id,
    { skip: !selectedItemForAudit }
  );

  const items = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  if (isLoading || isFetching) {
    return (
      <div className="p-6 flex justify-center items-center h-64">
        <Clock className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-lg">Loading wishlists...</span>
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-center text-red-600">Error loading wishlist data</div>;
  }

  const handleRemove = async (wishlistId) => {
    if (window.confirm('Remove this book from user\'s wishlist?')) {
      await removeFromWishlist(wishlistId);
    }
  };

  const handleRestore = async (wishlistId) => {
    if (window.confirm('Restore this item to wishlist?')) {
      await restoreItem(wishlistId);
    }
  };

  const exportCSV = () => {
    const headers = ["User ID", "Email", "Book Title", "Added On", "Removed On", "Status"];
    const rows = items.map(i => [
      i.user_id,
      i.email,
      `"${i.book_title}"`,
      format(new Date(i.created_at), 'yyyy-MM-dd HH:mm'),
      i.deleted_at ? format(new Date(i.deleted_at), 'yyyy-MM-dd HH:mm') : '-',
      i.deleted_at ? 'Removed' : 'Active'
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wishlist_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const displayedItems = items.slice((page - 1) * limit, page * limit);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Heart className="w-8 h-8 text-pink-600" />
            <h1 className="text-3xl font-bold text-purple-800">Wishlist Management</h1>
            <span className="text-sm text-gray-500">({total} total items)</span>
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
          </div>
        </div>

        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by email, book title, or user ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* CARD VIEW */}
      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayedItems.map(item => {
            const isActive = !item.deleted_at;
            return (
              <div
                key={item.id}
                className={`bg-white rounded-xl shadow-sm hover:shadow-lg transition-all p-5 border ${
                  isActive ? 'border-gray-200' : 'border-red-200 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-xs">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-purple-800 text-sm">{item.email}</p>
                      <p className="text-xs text-gray-500">ID: {item.user_id}</p>
                    </div>
                  </div>
                  <Heart className={`w-6 h-6 ${isActive ? 'text-pink-600 fill-pink-600' : 'text-gray-400'}`} />
                </div>

                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Book className="w-4 h-4 text-purple-600" />
                    <p className="font-medium text-sm line-clamp-2">{item.book_title}</p>
                  </div>
                  <p className="text-xs text-gray-500">Added: {format(new Date(item.created_at), 'MMM d, yyyy')}</p>
                  {item.deleted_at && (
                    <p className="text-xs text-red-600">Removed: {format(new Date(item.deleted_at), 'MMM d, yyyy')}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  {isActive ? (
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-4 h-4" /> Remove
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRestore(item.id)}
                      className="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 flex items-center justify-center gap-1"
                    >
                      <RefreshCw className="w-4 h-4" /> Restore
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedItemForAudit(item)}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Audit Log"
                  >
                    <FileText className="w-4 h-4 text-indigo-600" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                <tr>
                  <th className="p-4 text-left">User</th>
                  <th className="p-4 text-left">Book Title</th>
                  <th className="p-4 text-left">Added On</th>
                  <th className="p-4 text-left">Removed On</th>
                  <th className="p-4 text-left">Status</th>
                  <th className="p-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.length === 0 ? (
                  <tr><td colSpan="6" className="p-8 text-center text-gray-500">No wishlist items found</td></tr>
                ) : (
                  displayedItems.map(item => {
                    const isActive = !item.deleted_at;
                    return (
                      <tr key={item.id} className="hover:bg-purple-50 transition">
                        <td className="p-4">
                          <div>
                            <p className="font-medium">{item.email}</p>
                            <p className="text-xs text-gray-500">ID: {item.user_id}</p>
                          </div>
                        </td>
                        <td className="p-4 font-medium max-w-xs truncate">{item.book_title}</td>
                        <td className="p-4 text-sm">{format(new Date(item.created_at), 'MMM d, yyyy HH:mm')}</td>
                        <td className="p-4 text-sm">
                          {item.deleted_at ? format(new Date(item.deleted_at), 'MMM d, yyyy HH:mm') : '-'}
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {isActive ? 'Active' : 'Removed'}
                          </span>
                        </td>
                        <td className="p-4 flex gap-2">
                          {isActive ? (
                            <button onClick={() => handleRemove(item.id)} className="text-red-600 hover:bg-red-100 p-2 rounded" title="Remove">
                              <Trash2 className="w-5 h-5" />
                            </button>
                          ) : (
                            <button onClick={() => handleRestore(item.id)} className="text-green-600 hover:bg-green-100 p-2 rounded" title="Restore">
                              <RefreshCw className="w-5 h-5" />
                            </button>
                          )}
                          <button onClick={() => setSelectedItemForAudit(item)} className="text-indigo-600 hover:bg-indigo-100 p-2 rounded" title="Audit">
                            <FileText className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-10">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-6 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-xl hover:bg-purple-50 disabled:opacity-50 font-bold"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-bold text-purple-800">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-6 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-xl hover:bg-purple-50 disabled:opacity-50 font-bold"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* AUDIT MODAL */}
      {selectedItemForAudit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-purple-800">
                Wishlist Audit: {selectedItemForAudit.email} → {selectedItemForAudit.book_title}
              </h3>
              <button onClick={() => setSelectedItemForAudit(null)} className="text-red-600 hover:text-red-800">
                Close
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-2 px-3">Action</th>
                    <th className="text-left py-2 px-3">By</th>
                    <th className="text-left py-2 px-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs?.length > 0 ? (
                    auditLogs.map(log => (
                      <tr key={log.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3">{log.action}</td>
                        <td className="py-2 px-3">{log.changed_by_email || 'System'}</td>
                        <td className="py-2 px-3 text-xs">
                          {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="3" className="text-center py-4 text-gray-500">No audit logs</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WishlistDashboard;
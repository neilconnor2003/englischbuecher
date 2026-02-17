
// frontend/src/pages/Admin/Cart/CartDashboard.jsx
import React, { useState } from 'react';
import {
  useGetCartsQuery,
  useGetCartDetailQuery,
  useGetCartShippingQuery
} from '../features/cart/cartAdminApiSlice';
import {
  ShoppingCart, Search, Download, Grid, Table as TableIcon,
  ChevronLeft, ChevronRight, Eye, Euro, Package, User, Clock
} from 'lucide-react';
import { format } from 'date-fns';

const CartDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState('table');
  const [selectedUserId, setSelectedUserId] = useState(null);

  const limit = 12;
  const { data: carts = [], isLoading, isFetching } = useGetCartsQuery();
  const { data: detail } = useGetCartDetailQuery(selectedUserId, { skip: !selectedUserId });

  const filtered = carts.filter(cart =>
    cart.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cart.first_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (cart.last_name?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filtered.length / limit);
  const paginated = filtered.slice((page - 1) * limit, page * limit);

  const exportCSV = () => {
    const headers = ["User ID", "Email", "Name", "Items", "Quantity", "Value EUR", "Last Updated"];
    const rows = filtered.map(c => [
      c.user_id,
      c.email,
      `${c.first_name || ''} ${c.last_name || ''}`.trim(),
      c.items_count,
      c.total_quantity,
      c.cart_value_eur,
      format(new Date(c.last_updated), 'yyyy-MM-dd HH:mm')
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carts_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading || isFetching) {
    return (
      <div className="p-6 flex justify-center items-center h-64">
        <Clock className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-lg">Loading carts...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-8 h-8 text-emerald-600" />
            <h1 className="text-3xl font-bold text-purple-800">Cart Management</h1>
            <span className="text-sm text-gray-500">({filtered.length} active carts)</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="p-2 rounded-lg hover:bg-gray-100" title="Export CSV">
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              {viewMode === 'card' ? <TableIcon className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by email or name..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* CARD VIEW */}
      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {paginated.map(cart => (
            <div
              key={cart.user_id}
              className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all p-5 border border-gray-200 cursor-pointer"
              onClick={() => setSelectedUserId(cart.user_id)}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold">
                    <User className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-purple-800 text-sm">{cart.email}</p>
                    <p className="text-xs text-gray-500">ID: {cart.user_id}</p>
                  </div>
                </div>
                <ShoppingCart className="w-6 h-6 text-emerald-600" />
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Items</span>
                  <span className="font-bold">{cart.items_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Quantity</span>
                  <span className="font-bold">{cart.total_quantity}</span>
                </div>

                {/* Est. Shipping */}
                <div className="flex justify-between">
                  <span className="text-gray-600">Est. Shipping</span>
                  <span className="font-bold">
                    <CartShippingBadge userId={cart.user_id} />
                  </span>
                </div>

                <div className="flex justify-between text-lg font-bold text-emerald-600">
                  <span>Value</span>
                  <span>EUR{cart.cart_value_eur}</span>
                </div>
                <p className="text-xs text-gray-500 pt-2 border-t">
                  Last update: {format(new Date(cart.last_updated), 'MMM d, yyyy HH:mm')}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                <tr>
                  <th className="p-4 text-left">User</th>
                  <th className="p-4 text-left">Items</th>
                  <th className="p-4 text-left">Quantity</th>
                  <th className="p-4 text-left">Value</th>
                  <th className="p-4 text-left">Shipping</th>
                  <th className="p-4 text-left">Last Updated</th>
                  <th className="p-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginated.map(cart => (
                  <tr
                    key={cart.user_id}
                    className="hover:bg-emerald-50 transition cursor-pointer"
                    onClick={() => setSelectedUserId(cart.user_id)}   // ← row clickable
                  >
                    <td className="p-4">
                      <div>
                        <p className="font-medium">{cart.email}</p>
                        <p className="text-xs text-gray-500">
                          {cart.first_name} {cart.last_name}
                        </p>
                      </div>
                    </td>
                    <td className="p-4 font-bold">{cart.items_count}</td>
                    <td className="p-4">{cart.total_quantity}</td>
                    <td className="p-4 font-bold text-emerald-600">EUR{cart.cart_value_eur}</td>

                    {/* Est. Shipping */}
                    <td className="p-4 text-emerald-700 font-semibold">
                      <CartShippingBadge userId={cart.user_id} />
                    </td>

                    <td className="p-4 text-sm">
                      {format(new Date(cart.last_updated), 'MMM d, yyyy HH:mm')}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();  // prevent row click
                          setSelectedUserId(cart.user_id);
                        }}
                        className="text-emerald-600 hover:bg-emerald-100 p-2 rounded transition"
                        title="View Cart Details"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
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
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-6 py-3 bg-white border-2 border-emerald-600 text-emerald-600 rounded-xl hover:bg-emerald-50 disabled:opacity-50 font-bold"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-bold text-purple-800">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-6 py-3 bg-white border-2 border-emerald-600 text-emerald-600 rounded-xl hover:bg-emerald-50 disabled:opacity-50 font-bold"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedUserId && detail && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-screen overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-emerald-700">
                Cart Details: {detail.user?.email || 'Unknown User'}
              </h3>
              <button
                onClick={() => setSelectedUserId(null)}
                className="text-red-600 hover:text-red-800 text-3xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-emerald-50 p-4 rounded-lg text-center">
                <Package className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Total Quantity</p>
                <p className="text-3xl font-bold">
                  {detail.items.reduce((sum, i) => sum + Number(i.quantity), 0)}
                </p>
              </div>
              <div className="bg-teal-50 p-4 rounded-lg text-center">
                <Euro className="w-10 h-10 text-teal-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Total Value</p>
                <p className="text-3xl font-bold">
                  EUR{Number(detail.items.reduce((sum, i) => sum + Number(i.line_total), 0)).toFixed(2)}
                </p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg text-center">
                <ShoppingCart className="w-10 h-10 text-purple-600 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Unique Books</p>
                <p className="text-3xl font-bold">{detail.items.length}</p>
              </div>

              {/* Shipping summary (live) */}
              <AdminShippingCard userId={selectedUserId} />
            </div>

            {/* Items List */}
            <div className="space-y-4">
              {detail.items.map(item => (
                <div key={item.book_id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-16 h-20 object-cover rounded shadow"
                      onError={(e) => { e.target.src = '/fallback-book.jpg'; }}
                    />
                  ) : (
                    <div className="w-16 h-20 bg-gray-200 border-2 border-dashed rounded flex items-center justify-center">
                      <Package className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{item.title || 'Unknown Book'}</p>
                    <p className="text-sm text-gray-600">by {item.author || 'Unknown'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">EUR{Number(item.price).toFixed(2)}</p>
                    <p className="text-sm text-gray-600">× {item.quantity}</p>
                    <p className="text-xl font-bold text-emerald-600">
                      EUR{Number(item.line_total).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default CartDashboard;

/* ---------- Child components ---------- */

// Small badge component (safe to use inside lists)
function CartShippingBadge({ userId }) {
  const { data, isFetching } = useGetCartShippingQuery(userId);
  if (isFetching) return <span>…</span>;
  if (!data?.amount_eur) return <span>—</span>;
  return <span>EUR{Number(data.amount_eur).toFixed(2)}</span>;
}

function AdminShippingCard({ userId }) {
  const { data, isFetching } = useGetCartShippingQuery(userId);
  const dims = data?.dims;
  return (
    <div className="bg-amber-50 p-4 rounded-lg text-center">
      <Package className="w-10 h-10 text-amber-600 mx-auto mb-2" />
      <p className="text-sm text-gray-600">Est. Shipping</p>
      <p className="text-3xl font-bold">
        {isFetching ? '…' : (data?.amount_eur ? `EUR${Number(data.amount_eur).toFixed(2)}` : '—')}
      </p>
      {data?.provider && (
        <p className="text-xs text-gray-600 mt-1">
          {data.provider} · {data.service || '—'}
        </p>
      )}
      {dims && (
        <p className="text-xs text-gray-500 mt-1">
          Parcel: {dims.length_cm}×{dims.width_cm}×{dims.height_cm} cm
        </p>
      )}
    </div>
  );
}

// frontend/src/admin/pages/OrdersDashboard.jsx
import React, { useState, useMemo } from "react";
import BookModal from "../component/BookModal";
import DeleteModal from "../component/DeleteModal";
import Toast from "../component/Toast";
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
  User,
  DollarSign,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import {
  useGetOrdersQuery,
  useAddOrderMutation,
  useUpdateOrderMutation,
  useDeleteOrderMutation,
} from "../features/order/orderApiSlice";
import { useGetUsersQuery } from "../features/users/usersApiSlice";
import { format } from "date-fns";

const statusConfig = {
  pending: { color: "bg-yellow-100 text-yellow-800", icon: Clock },
  processing: { color: "bg-blue-100 text-blue-800", icon: Clock },
  shipped: { color: "bg-purple-100 text-purple-800", icon: Package },
  delivered: { color: "bg-green-100 text-green-800", icon: CheckCircle },
  cancelled: { color: "bg-red-100 text-red-800", icon: XCircle },
};

const OrdersDashboard = () => {
  // === HOOKS MUST BE AT TOP (NO EARLY RETURN) ===
  const { data: orders = [], isLoading: ordersLoading } = useGetOrdersQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  const { data: usersResponse = {}, isLoading: usersLoading } = useGetUsersQuery({ page: 1, limit: 100 });
  const users = Array.isArray(usersResponse.users) ? usersResponse.users : [];

  const [addOrder] = useAddOrderMutation();
  const [updateOrder] = useUpdateOrderMutation();
  const [deleteOrder] = useDeleteOrderMutation();

  const [viewMode, setViewMode] = useState('card');
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [modalOrder, setModalOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [toast, setToast] = useState(null);
  const [selectedOrders, setSelectedOrders] = useState([]);

  const itemsPerPage = viewMode === 'card' ? 12 : 10;

  // === MOVE ALL useMemo HERE (BEFORE ANY return) ===
  const enrichedOrders = useMemo(() => {
    if (!orders || !users) return [];
    return orders.map(order => {
      let items = [];
      let address = {};
      let payment = {};

      try {
        items = typeof order.order_items === 'string'
          ? JSON.parse(order.order_items)
          : order.order_items || [];
        address = typeof order.shipping_address === 'string'
          ? JSON.parse(order.shipping_address)
          : order.shipping_address || {};
        payment = order.payment_result
          ? (typeof order.payment_result === 'string' ? JSON.parse(order.payment_result) : order.payment_result)
          : {};
      } catch (e) {
        console.warn("Parse error:", e);
      }

      const user = users.find(u => u.id === order.user_id) || null;

      return {
        ...order,
        order_items_parsed: items,
        shipping_address_parsed: address,
        payment_result_parsed: payment,
        user,
      };
    });
  }, [orders, users]);

  const filteredOrders = useMemo(() => {
    return enrichedOrders.filter(order => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        order.id.toString().includes(searchTerm) ||
        order.user?.email?.toLowerCase().includes(searchLower) ||
        order.user?.first_name?.toLowerCase().includes(searchLower) ||
        order.user?.last_name?.toLowerCase().includes(searchLower);

      const matchesStatus = !statusFilter || order.status === statusFilter;
      const matchesPayment = paymentFilter === 'all' ||
        (paymentFilter === 'paid' && order.is_paid) ||
        (paymentFilter === 'unpaid' && !order.is_paid);

      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [enrichedOrders, searchTerm, statusFilter, paymentFilter]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const displayedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // === NOW SAFE TO RETURN ===
  if (ordersLoading || usersLoading) {
    return <div className="p-6 text-center">Loading orders and users...</div>;
  }

  // === REST OF YOUR CODE (UNCHANGED) ===
  const showToast = (msg, type) => setToast({ message: msg, type });
  const closeToast = () => setToast(null);

  const handleSaveOrder = async (orderData) => {
    try {
      if (orderData.id) {
        await updateOrder({ id: orderData.id, ...orderData }).unwrap();
        showToast("Order updated!", "success");
      } else {
        await addOrder(orderData).unwrap();
        showToast("Order added!", "success");
      }
    } catch (err) {
      showToast("Save failed: " + (err.data?.error || err.message), "error");
    }
    setIsModalOpen(false);
    setModalOrder(null);
  };

  const handleDelete = async () => {
    try {
      await deleteOrder(orderToDelete.id).unwrap();
      setSelectedOrders(prev => prev.filter(id => id !== orderToDelete.id));
      showToast("Order deleted!", "success");
    } catch {
      showToast("Delete failed", "error");
    }
    setIsDeleteModalOpen(false);
  };

  const toggleSelect = (id) => {
    setSelectedOrders(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelectedOrders(displayedOrders.map(o => o.id));
  };

  const exportCSV = () => {
    const headers = ["ID", "User", "Email", "Total", "Status", "Paid", "Date", "Items", "Address"];
    const rows = filteredOrders.map(o => [
      o.id,
      `"${o.user?.first_name || ''} ${o.user?.last_name || ''}"`.trim(),
      o.user?.email || '',
      o.total,
      o.status,
      o.is_paid ? 'Yes' : 'No',
      format(new Date(o.created_at), 'yyyy-MM-dd HH:mm'),
      o.order_items_parsed.length,
      `"${o.shipping_address_parsed.street || ''}, ${o.shipping_address_parsed.city || ''}"`.trim()
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusIcon = (status) => {
    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;
    return <Icon className="w-4 h-4" />;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Package className="w-8 h-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-purple-800">Orders Dashboard</h1>
            <span className="text-sm text-gray-500">({orders.length} total)</span>
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
                setModalOrder(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 font-bold"
            >
              <Plus className="w-5 h-5" /> Add Order
            </button>
          </div>
        </div>

        {/* FILTERS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search ID, user, email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Status</option>
            {Object.keys(statusConfig).map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <select
            value={paymentFilter}
            onChange={e => setPaymentFilter(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All Payment</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Filter className="w-4 h-4" />
            <span>{filteredOrders.length} shown</span>
          </div>
        </div>
      </div>

      {/* BULK ACTIONS */}
      {selectedOrders.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4 mb-4 flex items-center justify-between">
          <span className="font-bold text-purple-900">{selectedOrders.length} orders selected</span>
          <button
            onClick={() => setSelectedOrders([])}
            className="px-4 py-2 border-2 border-purple-600 text-purple-600 rounded-lg hover:bg-purple-100 text-sm font-medium"
          >
            Clear
          </button>
        </div>
      )}

      {/* CARD VIEW */}
      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayedOrders.map(order => {
            const StatusIcon = statusConfig[order.status]?.icon || Clock;
            return (
              <div
                key={order.id}
                className={`bg-white rounded-xl shadow-sm hover:shadow-lg transition-all p-5 border ${selectedOrders.includes(order.id) ? 'ring-2 ring-purple-500 border-purple-500' : 'border-gray-200'
                  }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedOrders.includes(order.id)}
                    onChange={() => toggleSelect(order.id)}
                    className="mt-1 w-4 h-4 text-purple-600 rounded"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-lg text-purple-800">#{order.id}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full font-bold flex items-center gap-1 ${statusConfig[order.status]?.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {order.status}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <p className="flex items-center gap-1 text-gray-600">
                        <User className="w-4 h-4" /> {order.user?.first_name || 'Guest'} {order.user?.last_name || ''}
                      </p>
                      <p className="text-gray-500 text-xs">{order.user?.email || 'N/A'}</p>
                      <p className="flex items-center gap-1 font-bold text-green-600">
                        <DollarSign className="w-4 h-4" /> {order.total.toFixed(2)}
                      </p>
                      <p className="flex items-center gap-1 text-gray-600">
                        <Calendar className="w-4 h-4" /> {format(new Date(order.created_at), 'MMM d, yyyy')}
                      </p>
                      <p className="flex items-center gap-1 text-gray-600">
                        <Package className="w-4 h-4" /> {order.order_items_parsed.length} items
                      </p>
                    </div>
                    <div className="flex gap-1 mt-3">
                      <button
                        onClick={() => {
                          setModalOrder(order);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded"
                      >
                        <Edit className="w-4 h-4 text-blue-600" />
                      </button>
                      <button
                        onClick={() => {
                          setOrderToDelete(order);
                          setIsDeleteModalOpen(true);
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>
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
                  <th className="p-4 text-left"><input type="checkbox" onChange={selectAll} checked={selectedOrders.length === displayedOrders.length && displayedOrders.length > 0} /></th>
                  <th className="p-4 text-left">ID</th>
                  <th className="p-4 text-left">User</th>
                  <th className="p-4 text-left">Total</th>
                  <th className="p-4 text-left">Status</th>
                  <th className="p-4 text-left">Paid</th>
                  <th className="p-4 text-left">Date</th>
                  <th className="p-4 text-left">Items</th>
                  <th className="p-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {displayedOrders.map(order => {
                  const StatusIcon = statusConfig[order.status]?.icon || Clock;
                  return (
                    <tr key={order.id} className="hover:bg-purple-50 transition">
                      <td className="p-4"><input type="checkbox" checked={selectedOrders.includes(order.id)} onChange={() => toggleSelect(order.id)} /></td>
                      <td className="p-4 font-bold text-purple-800">#{order.id}</td>
                      <td className="p-4">
                        <div>
                          <p className="font-medium">{order.user?.first_name || 'Guest'} {order.user?.last_name || ''}</p>
                          <p className="text-xs text-gray-500">{order.user?.email || 'N/A'}</p>
                        </div>
                      </td>
                      <td className="p-4 font-bold text-green-600">${order.total.toFixed(2)}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 text-xs rounded-full font-bold flex items-center gap-1 w-fit ${statusConfig[order.status]?.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {order.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {order.is_paid ? (
                          <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-600" />
                        )}
                      </td>
                      <td className="p-4 text-sm">{format(new Date(order.created_at), 'MMM d, yyyy HH:mm')}</td>
                      <td className="p-4 text-center">{order.order_items_parsed.length}</td>
                      <td className="p-4">
                        <button
                          onClick={() => {
                            setModalOrder(order);
                            setIsModalOpen(true);
                          }}
                          className="text-blue-600 hover:bg-blue-100 p-2 rounded"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            setOrderToDelete(order);
                            setIsDeleteModalOpen(true);
                          }}
                          className="text-red-600 hover:bg-red-100 p-2 rounded ml-1"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
            className="px-6 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-xl hover:bg-purple-50 disabled:opacity-50 font-bold"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-bold text-purple-800">Page {currentPage} of {totalPages}</span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-6 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-xl hover:bg-purple-50 disabled:opacity-50 font-bold"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* MODAL */}
      <BookModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setModalOrder(null);
        }}
        book={modalOrder}
        onSave={handleSaveOrder}
        fields={[
          { name: 'user_id', label: 'User ID', type: 'number', required: true },
          { name: 'total', label: 'Total', type: 'number', required: true },
          { name: 'status', label: 'Status', type: 'select', required: true, options: Object.keys(statusConfig).map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })) },
          { name: 'tracking_number', label: 'Tracking Number', type: 'text' },
          { name: 'payment_method', label: 'Payment Method', type: 'text' },
          { name: 'is_paid', label: 'Paid', type: 'select', options: [{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }] },
        ]}
      />

      <DeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        bookTitle={`Order #${orderToDelete?.id}`}
      />

      {toast && <Toast message={toast.message} type={toast.type} onClose={closeToast} />}
    </div>
  );
};

export default OrdersDashboard;
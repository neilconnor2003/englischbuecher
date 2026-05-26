
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import config from "../../config";
import {
  Wallet,
  Search,
  Filter,
  Users,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  X
} from "lucide-react";

const WalletDashboard = () => {
  const api = useMemo(() => axios.create({
    baseURL: `${config.API_URL}/api`,
    withCredentials: true,
  }), []);

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [balanceFilter, setBalanceFilter] = useState("all"); // all | positive | zero | negative
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const [selectedUser, setSelectedUser] = useState(null);
  const [txLoading, setTxLoading] = useState(false);
  const [tx, setTx] = useState([]);

  // Quick credit form inside modal
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");


  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newReason, setNewReason] = useState('');
  const [adding, setAdding] = useState(false);


  const [emailSuggestions, setEmailSuggestions] = useState([]);
  const [selectedPreview, setSelectedPreview] = useState(null);



  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data } = await api.get("/admin/wallet/users");
      setUsers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      alert("Failed to load wallet users");
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchTransactions = async (userId) => {
    setTxLoading(true);
    try {
      const { data } = await api.get(`/admin/wallet/users/${userId}/transactions`);
      setTx(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      alert("Failed to load wallet transactions");
    } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);


  useEffect(() => {
    const q = newEmail.trim();
    if (q.length < 3) {
      setEmailSuggestions([]);
      setSelectedPreview(null);
      return;
    }

    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/admin/wallet/user-lookup?email=${encodeURIComponent(q)}`);
        setEmailSuggestions(Array.isArray(data) ? data : []);
      } catch (e) {
        setEmailSuggestions([]);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [newEmail, api]);


  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const email = (u.email || "").toLowerCase();
      const name = `${u.first_name || ""} ${u.last_name || ""}`.trim().toLowerCase();
      const q = searchTerm.trim().toLowerCase();

      const matchesSearch =
        !q || email.includes(q) || name.includes(q);

      const bal = Number(u.balance || 0);

      const matchesBalance =
        balanceFilter === "all" ||
        (balanceFilter === "positive" && bal > 0) ||
        (balanceFilter === "zero" && bal === 0) ||
        (balanceFilter === "negative" && bal < 0);

      return matchesSearch && matchesBalance;
    });
  }, [users, searchTerm, balanceFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
  const displayedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const openUser = async (u) => {
    setSelectedUser(u);
    setTx([]);
    setCreditAmount("");
    setCreditReason("");
    await fetchTransactions(u.id);
  };

  const closeModal = () => {
    setSelectedUser(null);
    setTx([]);
  };

  const addCredit = async () => {
    if (!selectedUser?.email) return;
    const amt = Number(creditAmount);

    if (!Number.isFinite(amt) || amt <= 0) {
      alert("Enter a valid amount");
      return;
    }

    try {
      await api.post("/wallet/add", {
        email: selectedUser.email,
        amount: amt,
        reason: creditReason || "Admin credit",
      });

      // Refresh both list and user transactions
      await fetchUsers();
      await fetchTransactions(selectedUser.id);

      setCreditAmount("");
      setCreditReason("");
      alert("Wallet updated ✅");
    } catch (e) {
      console.error(e);
      alert("Credit failed");
    }
  };

  const handleAddWallet = async () => {
    if (!newEmail || !newAmount) {
      alert("Email and amount required");
      return;
    }

    const amt = Number(newAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      alert("Amount must be greater than 0");
      return;
    }

    setAdding(true);

    try {
      await api.post('/wallet/add', {
        email: newEmail,
        amount: Number(newAmount),
        reason: newReason || "Admin credit"
      });

      alert("Wallet updated ✅");

      // ✅ Refresh users (so new credit appears instantly)
      fetchUsers();

      // ✅ Reset form
      setNewEmail('');
      setNewAmount('');
      setNewReason('');
      setIsAddModalOpen(false);

    } catch (err) {
      console.error(err);
      alert("Failed to add wallet credit");
    } finally {
      setAdding(false);
    }
  };


  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Wallet className="w-8 h-8 text-purple-700" />
            <h1 className="text-3xl font-bold text-purple-800">Wallet Dashboard</h1>
            <span className="text-sm text-gray-500">({users.length} users)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              className="p-2 rounded-lg hover:bg-gray-100"
              title="Refresh"
            >
              <RefreshCcw className="w-5 h-5" />
            </button>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 font-bold"
            >
              ➕ Add Wallet Credit
            </button>

          </div>
        </div>

        {/* FILTERS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search name or email..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          <select
            value={balanceFilter}
            onChange={e => { setBalanceFilter(e.target.value); setCurrentPage(1); }}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">All balances</option>
            <option value="positive">Balance &gt; 0</option>
            <option value="zero">Balance = 0</option>
            <option value="negative">Balance &lt; 0</option>
          </select>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Filter className="w-4 h-4" />
            <span>{filteredUsers.length} shown</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users className="w-4 h-4" />
            <span>{displayedUsers.length} on this page</span>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      {loadingUsers ? (
        <div className="text-center py-16 text-gray-500">Loading wallet users…</div>
      ) : filteredUsers.length === 0 ? (
        <div className="text-center py-20">
          <p className="mt-6 text-xl text-gray-500">No wallet users found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayedUsers.map(u => {
            const bal = Number(u.balance || 0);
            const balColor =
              bal > 0 ? "bg-green-100 text-green-800" :
                bal < 0 ? "bg-red-100 text-red-800" :
                  "bg-gray-100 text-gray-800";

            const last = u.last_activity ? new Date(u.last_activity).toLocaleString() : "—";

            return (
              <button
                key={u.id}
                onClick={() => openUser(u)}
                className="text-left bg-white rounded-xl shadow-sm hover:shadow-lg transition-all p-4 border border-gray-200"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">
                      {(u.first_name || u.last_name) ? `${u.first_name || ""} ${u.last_name || ""}`.trim() : u.email}
                    </div>
                    <div className="text-sm text-gray-600 truncate">{u.email}</div>
                    <div className="text-xs text-gray-500 mt-2">Last activity: {last}</div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-3 py-1 text-xs rounded-full font-bold ${balColor}`}>
                      €{bal.toFixed(2)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {Number(u.tx_count || 0)} tx
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
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

          <span className="text-lg font-bold text-purple-800">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-6 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-xl hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed font-bold"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* MODAL */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <div className="font-bold text-lg text-purple-800">
                  Wallet — {selectedUser.email}
                </div>
                <div className="text-sm text-gray-600">
                  Balance: €{Number(selectedUser.balance || 0).toFixed(2)} · {Number(selectedUser.tx_count || 0)} transactions
                </div>
              </div>
              <button onClick={closeModal} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick credit */}
            <div className="p-4 border-b bg-purple-50">
              <div className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                <PlusCircle className="w-5 h-5" /> Credit wallet
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="number"
                  placeholder="Amount (€)"
                  value={creditAmount}
                  onChange={e => setCreditAmount(e.target.value)}
                  className="border p-2 rounded"
                />
                <input
                  type="text"
                  placeholder="Reason (optional)"
                  value={creditReason}
                  onChange={e => setCreditReason(e.target.value)}
                  className="border p-2 rounded"
                />
                <button
                  onClick={addCredit}
                  className="bg-green-600 text-white rounded px-3 font-bold"
                >
                  Add credit
                </button>
              </div>
            </div>

            {/* Transactions */}
            <div className="p-4">
              {txLoading ? (
                <div className="text-center py-10 text-gray-500">Loading transactions…</div>
              ) : tx.length === 0 ? (
                <div className="text-center py-10 text-gray-500">No transactions found.</div>
              ) : (
                <div className="border rounded-xl overflow-hidden">
                  {tx.map(row => {
                    const amt = Number(row.amount || 0);
                    const isCredit = row.type === "CREDIT";
                    return (
                      <div key={row.id} className="flex justify-between items-center p-3 border-b last:border-b-0">
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 truncate">{row.reason || "—"}</div>
                          <div className="text-xs text-gray-500">
                            {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                          </div>
                        </div>
                        <div className={`font-bold ${isCredit ? "text-green-600" : "text-red-600"}`}>
                          {isCredit ? "+" : "-"}€{amt.toFixed(2)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {
        isAddModalOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">

              <h2 className="text-xl font-bold mb-4 text-purple-800">
                Add Wallet Credit
              </h2>

              <div className="space-y-3">

                <input
                  type="email"
                  placeholder="User Email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="border p-2 w-full rounded"
                />

                {emailSuggestions.length > 0 && (
                  <div className="border rounded bg-white max-h-48 overflow-auto">
                    {emailSuggestions.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-purple-50"
                        onClick={() => {
                          setNewEmail(u.email);
                          setSelectedPreview(u);
                          setEmailSuggestions([]);
                        }}
                      >
                        <div className="font-semibold">{(u.first_name || '')} {(u.last_name || '')}</div>
                        <div className="text-sm text-gray-600">{u.email}</div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedPreview && (
                  <div className="p-3 bg-purple-50 rounded border border-purple-100">
                    <div className="font-semibold text-purple-900">
                      {(selectedPreview.first_name || '')} {(selectedPreview.last_name || '')}
                    </div>
                    <div className="text-sm text-gray-700">{selectedPreview.email}</div>
                    {"balance" in selectedPreview && (
                      <div className="text-sm mt-1">
                        Current balance: <strong>€{Number(selectedPreview.balance || 0).toFixed(2)}</strong>
                      </div>
                    )}
                  </div>
                )}


                <input
                  type="number"
                  placeholder="Amount (€)"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  className="border p-2 w-full rounded"
                />

                <input
                  type="text"
                  placeholder="Reason (optional)"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  className="border p-2 w-full rounded"
                />

                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 border rounded"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleAddWallet}
                    disabled={adding}
                    className="px-4 py-2 bg-green-600 text-white rounded font-bold"
                  >
                    {adding ? 'Saving...' : 'Add Credit'}
                  </button>
                </div>

              </div>
            </div>
          </div>
        )
      }

    </div>
  );
};

export default WalletDashboard;

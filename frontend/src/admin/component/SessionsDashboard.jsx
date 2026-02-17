// frontend/src/admin/component/SessionsDashboard.jsx
import React, { useState, useMemo, useCallback } from 'react';
import {
  useGetSessionsQuery,
  useDeleteSessionMutation,
} from '../features/sessions/sessionsApiSlice';
import {
  Activity,
  Search,
  Download,
  Table,
  Grid,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Clock,
  User,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

const SessionsDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState('table'); // 'card' or 'table'
  const limit = 10;

  // === ALL HOOKS AT TOP — NO CONDITIONS ===
  const { data, isLoading, isFetching, error } = useGetSessionsQuery(
    { page, limit, search: searchTerm },
    { skip: false } // ensure it always runs
  );

  const [deleteSession] = useDeleteSessionMutation();

  const sessions = data?.sessions || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  // === ENRICH SESSIONS (UPDATED) ===
  const enrichedSessions = useMemo(() => {
    return sessions.map(session => {
      let userId = 'Unknown';
      let userEmail = 'N/A';
      let isActive = false;

      try {
        const parsed = JSON.parse(session.data || '{}');

        // === YOUR ACTUAL FORMAT: { user_id: 2, email: "neil@..." } ===
        userId = parsed.user_id || parsed.id || parsed.passport?.user?.id || 'Unknown';
        userEmail = parsed.email || parsed.passport?.user?.email || 'N/A';

        isActive = Date.now() < session.expires * 1000;
      } catch (e) {
        console.warn('Failed to parse session data:', e);
      }

      return {
        ...session,
        user_id_parsed: userId,
        user_email_parsed: userEmail,
        is_active: isActive,
        expires_at: new Date(session.expires * 1000),
        created_at_estimated: new Date(session.expires * 1000 - 86400000),
      };
    });
  }, [sessions]);

  // === FILTER SESSIONS (CLIENT-SIDE) ===
  const filteredSessions = useMemo(() => {
    if (!searchTerm) return enrichedSessions;
    const lower = searchTerm.toLowerCase();
    return enrichedSessions.filter(s =>
      s.session_id.toLowerCase().includes(lower) ||
      String(s.user_id_parsed).toLowerCase().includes(lower) ||
      s.user_email_parsed.toLowerCase().includes(lower)
    );
  }, [enrichedSessions, searchTerm]);

  const totalFiltered = filteredSessions.length;
  const itemsPerPage = viewMode === 'card' ? 12 : 10;
  const totalPagesFiltered = Math.ceil(totalFiltered / itemsPerPage);
  const displayed = filteredSessions.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  // === CALLBACKS (MEMOIZED) ===
  const handleDelete = useCallback(async (sessionId) => {
    if (window.confirm('Delete this session? User will be logged out.')) {
      try {
        await deleteSession(sessionId).unwrap();
      } catch (err) {
        alert('Failed to delete session');
      }
    }
  }, [deleteSession]);

  const handlePageChange = useCallback((newPage) => {
    setPage(Math.max(1, Math.min(newPage, totalPagesFiltered)));
  }, [totalPagesFiltered]);

  const exportCSV = useCallback(() => {
    const headers = ["Session ID", "User ID", "Email", "Status", "Expires", "Created"];
    const rows = enrichedSessions.map(s => [
      s.session_id,
      s.user_id_parsed,
      s.user_email_parsed,
      s.is_active ? 'Active' : 'Expired',
      format(s.expires_at, 'yyyy-MM-dd HH:mm'),
      format(s.created_at_estimated, 'yyyy-MM-dd HH:mm')
    ].map(v => `"${v}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sessions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [enrichedSessions]);

  // === EARLY RETURN AFTER ALL HOOKS ===
  if (isLoading || isFetching) {
    return (
      <div className="p-6 flex justify-center items-center h-64">
        <Clock className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-lg">Loading sessions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-600">Error loading sessions</p>
      </div>
    );
  }

  // === RENDER ===
  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-purple-800">Active Sessions</h1>
            <span className="text-sm text-gray-500">({total} total)</span>
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
        {/* SEARCH */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by session ID, user ID, or email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* CARD VIEW */}
      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayed.length === 0 ? (
            <p className="col-span-full text-center text-gray-500 py-8">No sessions found</p>
          ) : (
            displayed.map(session => (
              <div
                key={session.session_id}
                className={`bg-white rounded-xl shadow-sm hover:shadow-lg transition-all p-5 border ${session.is_active ? 'border-green-200' : 'border-red-200 opacity-75'
                  }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-mono text-xs text-gray-600 break-all">
                      {session.session_id.slice(0, 16)}...
                    </p>
                    <p className="text-sm font-medium text-purple-800 mt-1">
                      User ID: {session.user_id_parsed}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full font-bold ${session.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                    }`}>
                    {session.is_active ? 'Active' : 'Expired'}
                  </span>
                </div>
                <div className="space-y-1 text-sm mb-3">
                  <p className="flex items-center gap-1 text-gray-600">
                    <User className="w-4 h-4" /> {session.user_email_parsed}
                  </p>
                  <p className="flex items-center gap-1 text-gray-600">
                    <Clock className="w-4 h-4" />
                    Expires {formatDistanceToNow(session.expires_at, { addSuffix: true })}
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => handleDelete(session.session_id)}
                    className="p-1.5 hover:bg-red-100 rounded text-red-600"
                    title="End Session"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                <tr>
                  <th className="p-4 text-left">Session ID</th>
                  <th className="p-4 text-left">User</th>
                  <th className="p-4 text-left">Status</th>
                  <th className="p-4 text-left">Expires</th>
                  <th className="p-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {displayed.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-500">
                      No sessions found
                    </td>
                  </tr>
                ) : (
                  displayed.map(session => (
                    <tr key={session.session_id} className="hover:bg-purple-50 transition">
                      <td className="p-4 font-mono text-xs break-all">
                        {session.session_id}
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="font-medium">ID: {session.user_id_parsed}</p>
                          <p className="text-xs text-gray-500">{session.user_email_parsed}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 text-xs rounded-full font-bold ${session.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                          }`}>
                          {session.is_active ? 'Active' : 'Expired'}
                        </span>
                      </td>
                      <td className="p-4 text-sm">
                        {format(session.expires_at, 'MMM d, yyyy HH:mm')}
                        <br />
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(session.expires_at, { addSuffix: true })}
                        </span>
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => handleDelete(session.session_id)}
                          className="text-red-600 hover:bg-red-100 p-2 rounded"
                          title="End Session"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PAGINATION */}
      {totalPagesFiltered > 1 && (
        <div className="flex justify-center items-center gap-4 mt-10">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            className="px-6 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-xl hover:bg-purple-50 disabled:opacity-50 font-bold"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-lg font-bold text-purple-800">
            Page {page} of {totalPagesFiltered}
          </span>
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page === totalPagesFiltered}
            className="px-6 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-xl hover:bg-purple-50 disabled:opacity-50 font-bold"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default SessionsDashboard;
// frontend/src/admin/component/UsersDashboard.jsx
import React, { useState, useMemo } from 'react';
import {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useGetUserAuditQuery,
  useReactivateUserMutation
} from '../features/users/usersApiSlice';
import EditUserModal from '../features/users/EditUserModal';
import {
  Users,
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
  FileText,
  RefreshCw,
  UserCheck,
  UserX,
  Clock,
} from 'lucide-react';
import { ACTIVE_SENTINEL } from '@/constants.js';
import { format } from 'date-fns';

const roleConfig = {
  admin: { color: 'bg-purple-100 text-purple-800', icon: UserCheck },
  user: { color: 'bg-green-100 text-green-800', icon: UserCheck },
};

const UsersDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserForAudit, setSelectedUserForAudit] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'card' or 'table'
  const limit = 10;

  const { data, isLoading, isFetching, error } = useGetUsersQuery({ page, limit, search: searchTerm });
  const [createUser] = useCreateUserMutation();
  const [updateUser] = useUpdateUserMutation();
  const [deleteUser] = useDeleteUserMutation();
  const [reactivateUser] = useReactivateUserMutation();
  const { data: auditLogs } = useGetUserAuditQuery(selectedUserForAudit?.id, { skip: !selectedUserForAudit });

  const users = data?.users || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);
  const itemsPerPage = viewMode === 'card' ? 12 : 10;
  const displayedUsers = users.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  // === SAFE LOADING ===
  if (isLoading || isFetching) {
    return (
      <div className="p-6 flex justify-center items-center h-64">
        <Clock className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-lg">Loading users...</span>
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-center text-red-600">Error loading users</div>;
  }

  const handleAdd = () => {
    setSelectedUser(null);
    setIsModalOpen(true);
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  const handleDelete = async (userId) => {
    if (window.confirm('Delete this user?')) {
      await deleteUser(userId);
    }
  };

  const handleReactivate = async (userId) => {
    if (window.confirm('Reactivate this user?')) {
      try {
        await reactivateUser(userId).unwrap();
        alert('User reactivated successfully');
      } catch (err) {
        alert('Failed to reactivate: ' + (err?.data?.error || 'Server error'));
      }
    }
  };

  const handleSave = async (userData) => {
    try {
      if (selectedUser) {
        await updateUser({ id: selectedUser.id, ...userData }).unwrap();
      } else {
        await createUser(userData).unwrap();
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('handleSave error:', err);
      alert('Failed to save: ' + (err?.data?.error || 'Server error'));
    }
  };

  const exportCSV = () => {
    const headers = ["ID", "Email", "Name", "Role", "Status", "Created"];
    const rows = users.map(u => [
      u.id,
      u.email,
      `${u.first_name} ${u.last_name}`,
      u.role,
      u.deleted_at === ACTIVE_SENTINEL ? 'Active' : 'Deleted',
      format(new Date(u.created_at), 'yyyy-MM-dd')
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-purple-800">Users Management</h1>
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
            <button
              onClick={handleAdd}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 font-bold"
            >
              <Plus className="w-5 h-5" /> Add User
            </button>
          </div>
        </div>

        {/* SEARCH */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by email or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* CARD VIEW */}
      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {displayedUsers.map(user => {
            const RoleIcon = roleConfig[user.role]?.icon || UserCheck;
            const isActive = user.deleted_at === ACTIVE_SENTINEL;
            return (
              <div
                key={user.id}
                className={`bg-white rounded-xl shadow-sm hover:shadow-lg transition-all p-5 border ${isActive ? 'border-gray-200' : 'border-red-200 opacity-75'
                  }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold">
                      {user.first_name[0]}{user.last_name[0]}
                    </div>
                    <div>
                      <p className="font-bold text-purple-800">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full font-bold flex items-center gap-1 ${roleConfig[user.role]?.color}`}>
                    <RoleIcon className="w-3 h-3" />
                    {user.role}
                  </span>
                </div>

                <div className="space-y-1 text-sm mb-3">
                  <p className="flex items-center gap-1 text-gray-600">
                    {isActive ? (
                      <>
                        <UserCheck className="w-4 h-4 text-green-600" /> Active
                      </>
                    ) : (
                      <>
                        <UserX className="w-4 h-4 text-red-600" /> Deleted
                      </>
                    )}
                  </p>
                  <p className="text-gray-500 text-xs">
                    Joined: {format(new Date(user.created_at), 'MMM d, yyyy')}
                  </p>
                </div>

                <div className="flex gap-1">
                  {isActive ? (
                    <>
                      <button
                        onClick={() => handleEdit(user)}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-blue-600" />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                      <button
                        onClick={() => setSelectedUserForAudit(user)}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title="Audit"
                      >
                        <FileText className="w-4 h-4 text-indigo-600" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleReactivate(user.id)}
                      className="p-1.5 hover:bg-green-100 rounded"
                      title="Reactivate"
                    >
                      <RefreshCw className="w-4 h-4 text-green-600" />
                    </button>
                  )}
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
                  <th className="p-4 text-left">Email</th>
                  <th className="p-4 text-left">Name</th>
                  <th className="p-4 text-left">Role</th>
                  <th className="p-4 text-left">Status</th>
                  <th className="p-4 text-left">Created</th>
                  <th className="p-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-500">No users found</td>
                  </tr>
                ) : (
                  displayedUsers.map(user => {
                    const RoleIcon = roleConfig[user.role]?.icon || UserCheck;
                    const isActive = user.deleted_at === ACTIVE_SENTINEL;
                    return (
                      <tr key={user.id} className="hover:bg-purple-50 transition">
                        <td className="p-4 text-sm">{user.email}</td>
                        <td className="p-4">
                          <div>
                            <p className="font-medium">{user.first_name} {user.last_name}</p>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 text-xs rounded-full font-bold flex items-center gap-1 w-fit ${roleConfig[user.role]?.color}`}>
                            <RoleIcon className="w-3 h-3" />
                            {user.role}
                          </span>
                        </td>
                        <td className="p-4">
                          {isActive ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <UserCheck className="w-4 h-4" /> Active
                            </span>
                          ) : (
                            <span className="text-red-600 flex items-center gap-1">
                              <UserX className="w-4 h-4" /> Deleted
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-sm">{format(new Date(user.created_at), 'MMM d, yyyy')}</td>
                        <td className="p-4">
                          {isActive ? (
                            <>
                              <button
                                onClick={() => handleEdit(user)}
                                className="text-blue-600 hover:bg-blue-100 p-2 rounded"
                                title="Edit"
                              >
                                <Edit className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => handleDelete(user.id)}
                                className="text-red-600 hover:bg-red-100 p-2 rounded ml-1"
                                title="Delete"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                              <button
                                onClick={() => setSelectedUserForAudit(user)}
                                className="text-indigo-600 hover:bg-indigo-100 p-2 rounded ml-1"
                                title="Audit"
                              >
                                <FileText className="w-5 h-5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleReactivate(user.id)}
                              className="text-green-600 hover:bg-green-100 p-2 rounded"
                              title="Reactivate"
                            >
                              <RefreshCw className="w-5 h-5" />
                            </button>
                          )}
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

      {/* MODAL */}
      {isModalOpen && (
        <EditUserModal
          user={selectedUser}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSave}
        />
      )}

      {/* AUDIT MODAL */}
      {selectedUserForAudit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-96 overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-purple-800">
                Audit Log: {selectedUserForAudit.email}
              </h3>
              <button
                onClick={() => setSelectedUserForAudit(null)}
                className="text-red-600 hover:text-red-800"
              >
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
                        <td className="py-2 px-3">{log.changed_by_role || 'user'}</td>
                        <td className="py-2 px-3 text-xs">
                          {format(new Date(log.created_at), 'MMM d, yyyy HH:mm')}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="text-center py-4 text-gray-500">No audit logs</td>
                    </tr>
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

export default UsersDashboard;
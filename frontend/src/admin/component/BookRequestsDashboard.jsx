
import React, { useState } from 'react';
import { useGetBookRequestsQuery } from '../features/bookRequests/bookRequestsApiSlice';
import { FileText, Search, Download, Clock } from 'lucide-react';
import { format } from 'date-fns';

const BookRequestsDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading, isFetching, error } = useGetBookRequestsQuery({ page, limit, search: searchTerm });
  const requests = data?.requests || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  if (isLoading || isFetching) {
    return (
      <div className="p-6 flex justify-center items-center h-64">
        <Clock className="w-8 h-8 text-purple-600 animate-spin" />
        <span className="ml-2 text-lg">Loading book requests...</span>
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-center text-red-600">Error loading book requests</div>;
  }

  const exportCSV = () => {
    const headers = ["ID", "Title", "ISBN-13", "ISBN-10", "Requester", "Email", "Status", "Created"];
    const rows = requests.map(r => [
      r.id,
      r.title || '',
      r.isbn13 || '',
      r.isbn10 || '',
      r.requester_name || '',
      r.requester_email || '',
      r.status,
      format(new Date(r.created_at), 'yyyy-MM-dd')
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `book_requests_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-purple-600" />
            <h1 className="text-3xl font-bold text-purple-800">Book Requests</h1>
            <span className="text-sm text-gray-500">({total} total)</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="p-2 rounded-lg hover:bg-gray-100" title="Export CSV">
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SEARCH */}
        <div className="mt-4 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
          />
        </div>
      </div>

      {/* TABLE VIEW */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
              <tr>
                <th className="p-4 text-left">Title</th>
                <th className="p-4 text-left">ISBN-13</th>
                <th className="p-4 text-left">Requester</th>
                <th className="p-4 text-left">Email</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-left">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500">No requests found</td>
                </tr>
              ) : (
                requests.map(r => (
                  <tr key={r.id} className="hover:bg-purple-50 transition">
                    <td className="p-4">{r.title || '-'}</td>
                    <td className="p-4">{r.isbn13 || '-'}</td>
                    <td className="p-4">{r.requester_name || 'User'}</td>
                    <td className="p-4">{r.requester_email || '-'}</td>
                    <td className="p-4 font-bold">{r.status}</td>
                    <td className="p-4">{format(new Date(r.created_at), 'MMM d, yyyy')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-10">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-6 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-xl hover:bg-purple-50 disabled:opacity-50 font-bold"
          >
            Prev
          </button>
          <span className="text-lg font-bold text-purple-800">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-6 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-xl hover:bg-purple-50 disabled:opacity-50 font-bold"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default BookRequestsDashboard;

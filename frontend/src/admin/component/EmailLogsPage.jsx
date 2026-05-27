
import React, { useEffect, useState } from 'react';
import {
    Mail,
    Search,
    Filter,
    Eye,
    X,
    AlertCircle,
    CheckCircle,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL;

export default function EmailLogsPage() {
    const [rows, setRows] = useState([]);
    const [selected, setSelected] = useState(null);
    const [status, setStatus] = useState('');
    const [type, setType] = useState('');
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);

    async function loadLogs() {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (status) params.append('status', status);
            if (type) params.append('type', type);
            if (search) params.append('search', search);

            const res = await fetch(`${API}/api/admin/email-logs?${params.toString()}`, {
                credentials: 'include'
            });

            const data = await res.json();
            setRows(data.rows || []);
        } catch (err) {
            console.error('Failed to load email logs', err);
        } finally {
            setLoading(false);
        }
    }

    async function openEmail(id) {
        try {
            const res = await fetch(`${API}/api/admin/email-logs/${id}`, {
                credentials: 'include'
            });
            const data = await res.json();
            setSelected(data);
        } catch (err) {
            console.error('Failed to load email detail', err);
        }
    }

    /*useEffect(() => {
        loadLogs();
    }, []);*/


    useEffect(() => {
        loadLogs();
    }, [status, type]);


    return (
        <div className="p-6 max-w-7xl mx-auto">

            {/* HEADER */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <div className="flex items-center gap-3">
                    <Mail className="w-8 h-8 text-purple-600" />
                    <h1 className="text-3xl font-bold text-purple-800">Email Logs</h1>
                    <span className="text-gray-500 text-sm">({rows.length} entries)</span>
                </div>

                {/* FILTERS */}
                <div className="mt-4 flex flex-wrap gap-3 items-center">

                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                            className="pl-9 pr-3 py-2 border rounded-lg"
                            placeholder="Search email / subject / error"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="border px-3 py-2 rounded-lg"
                    >
                        <option value="">All Statuses</option>
                        <option value="sent">Sent</option>
                        <option value="failed">Failed</option>
                    </select>

                    <select
                        value={type}
                        onChange={(e) => setType(e.target.value)}
                        className="border px-3 py-2 rounded-lg"
                    >
                        <option value="">All Types</option>
                        <option value="Welcome">Welcome</option>
                        <option value="Welcome-Resend">Welcome-Resend</option>
                        <option value="PWDReset">PWDReset</option>
                        <option value="Invoice">Invoice</option>
                        <option value="WalletCredit">WalletCredit</option>
                    </select>

                    <button
                        onClick={loadLogs}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                        Apply
                    </button>
                </div>
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                            <tr>
                                <th className="p-4 text-left">To</th>
                                <th className="p-4 text-left">Subject</th>
                                <th className="p-4 text-left">Type</th>
                                <th className="p-4 text-left">Status</th>
                                <th className="p-4 text-left">Created</th>
                                <th className="p-4 text-left">Action</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="text-center p-6">Loading...</td>
                                </tr>
                            ) : rows.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center p-6 text-gray-500">
                                        No emails found
                                    </td>
                                </tr>
                            ) : (
                                rows.map(row => (
                                    <tr key={row.id} className="hover:bg-purple-50">
                                        <td className="p-4">{row.to_email}</td>
                                        <td className="p-4">{row.subject}</td>
                                        <td className="p-4">{row.type}</td>

                                        <td className="p-4">
                                            {row.status === 'failed' ? (
                                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs flex items-center gap-1">
                                                    <AlertCircle className="w-3 h-3" /> Failed
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs flex items-center gap-1">
                                                    <CheckCircle className="w-3 h-3" /> Sent
                                                </span>
                                            )}
                                        </td>

                                        <td className="p-4">
                                            {new Date(row.created_at).toLocaleString()}
                                        </td>

                                        <td className="p-4">
                                            <button
                                                onClick={() => openEmail(row.id)}
                                                className="p-2 rounded hover:bg-gray-100"
                                            >
                                                <Eye className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ✅ MODAL POPUP */}
            {selected && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur flex items-center justify-center z-50">

                    <div className="bg-white w-[90%] max-w-4xl rounded-xl shadow-xl p-6 relative">

                        {/* CLOSE */}
                        <button
                            onClick={() => setSelected(null)}
                            className="absolute top-3 right-3 p-1 hover:bg-gray-100 rounded"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <h2 className="text-xl font-bold text-purple-800 mb-2">
                            Email #{selected.id}
                        </h2>

                        <p><strong>To:</strong> {selected.to_email}</p>
                        <p><strong>Subject:</strong> {selected.subject}</p>
                        <p><strong>Type:</strong> {selected.type}</p>
                        <p><strong>Status:</strong> {selected.status}</p>

                        {selected.error && (
                            <p className="text-red-600">
                                <strong>Error:</strong> {selected.error}
                            </p>
                        )}

                        {/* EMAIL PREVIEW */}
                        <div className="mt-4">
                            <h3 className="font-semibold mb-2">Preview</h3>

                            {selected.html ? (
                                <iframe
                                    title="email-preview"
                                    className="w-full h-[500px] border rounded"
                                    srcDoc={selected.html}
                                />
                            ) : (
                                <p>No HTML stored</p>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}

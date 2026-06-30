import React, { useEffect, useState } from 'react';
import {
    Cookie,
    Search,
    User,
    ShieldCheck,
    ShieldOff,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL;

export default function CookieConsentLogPage() {
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [analyticsFilter, setAnalyticsFilter] = useState('');
    const [loading, setLoading] = useState(false);
    const limit = 25;

    async function loadLogs() {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit });
            if (analyticsFilter) params.append('analytics', analyticsFilter);

            const res = await fetch(`${API}/api/admin/cookie-consent?${params.toString()}`, {
                credentials: 'include'
            });
            const data = await res.json();
            setRows(data.rows || []);
            setTotal(data.total || 0);
        } catch (err) {
            console.error('Failed to load cookie consent log', err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadLogs();
    }, [page, analyticsFilter]);

    const totalPages = Math.max(Math.ceil(total / limit), 1);

    return (
        <div className="p-6 max-w-7xl mx-auto">

            {/* HEADER */}
            <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
                <div className="flex items-center gap-3">
                    <Cookie className="w-8 h-8 text-purple-600" />
                    <h1 className="text-3xl font-bold text-purple-800">Cookie Consent Log</h1>
                    <span className="text-gray-500 text-sm">({total} entries)</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                    Every consent decision — accept, decline, or custom settings — from logged-in users and anonymous visitors. Append-only audit trail for GDPR compliance.
                </p>

                {/* FILTERS */}
                <div className="mt-4 flex flex-wrap gap-3 items-center">
                    <select
                        value={analyticsFilter}
                        onChange={(e) => { setPage(1); setAnalyticsFilter(e.target.value); }}
                        className="border px-3 py-2 rounded-lg"
                    >
                        <option value="">All decisions</option>
                        <option value="true">Analytics accepted</option>
                        <option value="false">Analytics declined</option>
                    </select>
                </div>
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gradient-to-r from-purple-600 to-pink-600 text-white">
                            <tr>
                                <th className="p-4 text-left">User / Visitor</th>
                                <th className="p-4 text-left">Essential</th>
                                <th className="p-4 text-left">Analytics</th>
                                <th className="p-4 text-left">Source</th>
                                <th className="p-4 text-left">IP Address</th>
                                <th className="p-4 text-left">Date</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {loading ? (
                                <tr><td colSpan="6" className="text-center p-6">Loading...</td></tr>
                            ) : rows.length === 0 ? (
                                <tr><td colSpan="6" className="text-center p-6 text-gray-500">No consent records found</td></tr>
                            ) : (
                                rows.map(row => (
                                    <tr key={row.id} className="hover:bg-purple-50">
                                        <td className="p-4">
                                            {row.user_id ? (
                                                <div className="flex items-center gap-2">
                                                    <User className="w-4 h-4 text-purple-500" />
                                                    <div>
                                                        <div className="font-medium">{row.first_name} {row.last_name}</div>
                                                        <div className="text-xs text-gray-400">{row.email}</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-sm">
                                                    Guest ({row.consent_id?.slice(0, 8)}…)
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                                                Always on
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {row.analytics ? (
                                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs flex items-center gap-1 w-fit">
                                                    <ShieldCheck className="w-3 h-3" /> Accepted
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs flex items-center gap-1 w-fit">
                                                    <ShieldOff className="w-3 h-3" /> Declined
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm capitalize">{row.source?.replace('_', ' ')}</td>
                                        <td className="p-4 text-sm text-gray-500">{row.ip_address}</td>
                                        <td className="p-4 text-sm text-gray-500">{new Date(row.created_at).toLocaleString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* PAGINATION */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t">
                        <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                        <div className="flex gap-2">
                            <button
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                                className="px-3 py-1.5 border rounded-lg disabled:opacity-40"
                            >
                                Previous
                            </button>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="px-3 py-1.5 border rounded-lg disabled:opacity-40"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

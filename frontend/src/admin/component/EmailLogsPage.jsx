
import React, { useEffect, useState } from 'react';

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

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <h1>Email Logs</h1>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input
          placeholder="Search email / subject / error"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="sent">sent</option>
          <option value="failed">failed</option>
        </select>

        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All Types</option>
          <option value="Welcome">Welcome</option>
          <option value="Welcome-Resend">Welcome-Resend</option>
          <option value="PWDReset">PWDReset</option>
          <option value="Invoice">Invoice</option>
          <option value="WalletCredit">WalletCredit</option>
        </select>

        <button onClick={loadLogs}>Filter</button>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table width="100%" cellPadding="10" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">ID</th>
              <th align="left">To</th>
              <th align="left">Subject</th>
              <th align="left">Type</th>
              <th align="left">Status</th>
              <th align="left">Created</th>
              <th align="left">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderTop: '1px solid #ddd' }}>
                <td>{row.id}</td>
                <td>{row.to_email}</td>
                <td>{row.subject}</td>
                <td>{row.type}</td>
                <td style={{ color: row.status === 'failed' ? 'red' : 'green' }}>
                  {row.status}
                </td>
                <td>{new Date(row.created_at).toLocaleString()}</td>
                <td>
                  <button onClick={() => openEmail(row.id)}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selected && (
        <div
          style={{
            marginTop: '24px',
            border: '1px solid #ddd',
            borderRadius: '12px',
            padding: '16px',
            background: '#fff'
          }}
        >
          <h2>Email #{selected.id}</h2>
          <p><strong>To:</strong> {selected.to_email}</p>
          <p><strong>Subject:</strong> {selected.subject}</p>
          <p><strong>Type:</strong> {selected.type}</p>
          <p><strong>Status:</strong> {selected.status}</p>
          {selected.error && <p><strong>Error:</strong> {selected.error}</p>}

          <div style={{ marginTop: '16px' }}>
            <h3>HTML Preview</h3>
            {selected.html ? (
              <iframe
                title="email-preview"
                style={{ width: '100%', height: '600px', border: '1px solid #ccc' }}
                srcDoc={selected.html}
              />
            ) : (
              <p>No HTML stored.</p>
            )}
          </div>

          <button onClick={() => setSelected(null)} style={{ marginTop: '12px' }}>
            Close
          </button>
        </div>
      )}
    </div>
  );
}

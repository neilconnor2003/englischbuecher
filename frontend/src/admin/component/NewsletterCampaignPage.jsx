// frontend/src/admin/component/NewsletterCampaignPage.jsx
import React, { useEffect, useState } from 'react';
import { Mail, Users, Send, Eye, AlertCircle, CheckCircle } from 'lucide-react';

const API = import.meta.env.VITE_API_URL;

export default function NewsletterCampaignPage() {
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState({
    subject_en: '', subject_de: '', body_en: '', body_de: '', language_filter: ''
  });
  const [preview, setPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/admin/newsletter/subscribers`, { credentials: 'include' })
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const targetCount = stats
    ? form.language_filter
      ? stats.byLanguage?.find(b => b.language === form.language_filter)?.count || 0
      : stats.total
    : 0;

  const handleSend = async () => {
    if (!confirmed) { setError('Please confirm before sending'); return; }
    if (!form.subject_en || !form.body_en) { setError('English subject and body are required'); return; }
    setSending(true); setError(''); setResult(null);
    try {
      const res = await fetch(`${API}/api/admin/newsletter/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) setResult(data);
      else setError(data.error || 'Failed');
    } catch (err) {
      setError('Network error');
    } finally {
      setSending(false); setConfirmed(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* HEADER */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Mail className="w-8 h-8 text-purple-600" />
          <h1 className="text-3xl font-bold text-purple-800">Newsletter Campaign</h1>
        </div>
        <p className="text-sm text-gray-500">Send a campaign to your active newsletter subscribers.</p>

        {stats && (
          <div className="mt-4 flex flex-wrap gap-4">
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
              <Users className="w-4 h-4 text-purple-600" />
              <span className="font-bold text-purple-800">{stats.total}</span>
              <span className="text-sm text-gray-500">active subscribers</span>
            </div>
            {stats.byLanguage?.map(b => (
              <div key={b.language} className="flex items-center gap-2 bg-gray-50 border rounded-lg px-4 py-2">
                <span className="text-sm font-medium text-gray-700">{b.language.toUpperCase()}: {b.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {result ? (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-green-700 mb-2">Campaign Sent!</h2>
          <p className="text-gray-600">Sent: <strong>{result.sent}</strong> &nbsp;·&nbsp; Failed: <strong>{result.failed}</strong> &nbsp;·&nbsp; Total: <strong>{result.total}</strong></p>
          <button onClick={() => { setResult(null); setForm({ subject_en:'', subject_de:'', body_en:'', body_de:'', language_filter:'' }); }}
            className="mt-6 px-6 py-2 bg-purple-600 text-white rounded-lg font-medium">
            Send Another
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg p-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* English */}
            <div className="space-y-3">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">🇬🇧 English <span className="text-red-500 text-xs">required</span></h3>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Subject</label>
                <input
                  value={form.subject_en}
                  onChange={e => setForm(f => ({ ...f, subject_en: e.target.value }))}
                  className="mt-1 w-full border rounded-lg p-2 text-sm"
                  placeholder="Your June picks are here!"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Body</label>
                <textarea
                  value={form.body_en}
                  onChange={e => setForm(f => ({ ...f, body_en: e.target.value }))}
                  rows={10}
                  className="mt-1 w-full border rounded-lg p-2 text-sm font-mono"
                  placeholder="Hi there,&#10;&#10;Check out this month's picks..."
                />
              </div>
            </div>

            {/* German */}
            <div className="space-y-3">
              <h3 className="font-bold text-gray-700">🇩🇪 Deutsch <span className="text-xs text-gray-400">(optional – falls back to EN)</span></h3>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Betreff</label>
                <input
                  value={form.subject_de}
                  onChange={e => setForm(f => ({ ...f, subject_de: e.target.value }))}
                  className="mt-1 w-full border rounded-lg p-2 text-sm"
                  placeholder="Deine Juni-Highlights sind da!"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Text</label>
                <textarea
                  value={form.body_de}
                  onChange={e => setForm(f => ({ ...f, body_de: e.target.value }))}
                  rows={10}
                  className="mt-1 w-full border rounded-lg p-2 text-sm font-mono"
                  placeholder="Hallo,&#10;&#10;Schau dir diesen Monat unsere Highlights an..."
                />
              </div>
            </div>
          </div>

          {/* Audience filter + send */}
          <div className="border-t pt-4 flex flex-wrap items-center gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Send to</label>
              <select
                value={form.language_filter}
                onChange={e => setForm(f => ({ ...f, language_filter: e.target.value }))}
                className="mt-1 block border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">All subscribers ({stats?.total || 0})</option>
                <option value="de">German subscribers only</option>
                <option value="en">English subscribers only</option>
              </select>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-3">
              <button
                onClick={() => setPreview(p => !p)}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Eye className="w-4 h-4" /> {preview ? 'Hide preview' : 'Preview EN'}
              </button>

              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
                I confirm sending to <strong className="text-purple-700 mx-1">{targetCount}</strong> subscribers
              </label>

              <button
                onClick={handleSend}
                disabled={sending || !form.subject_en || !form.body_en}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Sending…' : `Send Campaign`}
              </button>
            </div>
          </div>

          {/* Preview */}
          {preview && form.body_en && (
            <div className="mt-6 border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-500 mb-3">Email Preview (EN)</h4>
              <div className="border rounded-xl p-6 bg-gray-50">
                <div className="bg-gradient-to-r from-purple-900 to-purple-700 text-white text-center p-6 rounded-t-xl">
                  <div className="text-xs font-bold uppercase tracking-widest text-purple-300 mb-2">EnglischBücher</div>
                  <h2 className="text-xl font-bold">📚 {form.subject_en}</h2>
                </div>
                <div className="bg-white border border-t-0 rounded-b-xl p-6">
                  <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{form.body_en}</div>
                  <p className="text-xs text-gray-400 text-center mt-6 pt-4 border-t">Unsubscribe</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

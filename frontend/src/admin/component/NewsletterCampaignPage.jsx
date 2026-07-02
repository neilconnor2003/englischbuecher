// frontend/src/admin/component/NewsletterCampaignPage.jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Mail, Users, Send, Eye, EyeOff, AlertCircle, CheckCircle,
  Bold, Italic, Underline, Link, List, Heading1, Heading2,
  AlignLeft, AlignCenter, Quote, Minus, Type
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL;

// ── Lightweight rich text editor using contenteditable ──────
function RichEditor({ value, onChange, placeholder }) {
  const editorRef = useRef(null);
  const isUserEdit = useRef(false);

  // Sync external value into DOM only on mount or programmatic reset
  useEffect(() => {
    if (editorRef.current && !isUserEdit.current) {
      editorRef.current.innerHTML = value || '';
    }
    isUserEdit.current = false;
  }, [value]);

  const exec = useCallback((cmd, val = null) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    isUserEdit.current = true;
    onChange(editorRef.current?.innerHTML || '');
  }, [onChange]);

  const handleInput = () => {
    isUserEdit.current = true;
    onChange(editorRef.current?.innerHTML || '');
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) exec('createLink', url);
  };

  const tools = [
    { icon: <Bold size={15} />, label: 'Bold', action: () => exec('bold') },
    { icon: <Italic size={15} />, label: 'Italic', action: () => exec('italic') },
    { icon: <Underline size={15} />, label: 'Underline', action: () => exec('underline') },
    { divider: true },
    { icon: <Heading1 size={15} />, label: 'Heading 1', action: () => exec('formatBlock', 'h2') },
    { icon: <Heading2 size={15} />, label: 'Heading 2', action: () => exec('formatBlock', 'h3') },
    { icon: <Type size={15} />, label: 'Paragraph', action: () => exec('formatBlock', 'p') },
    { divider: true },
    { icon: <List size={15} />, label: 'Bullet list', action: () => exec('insertUnorderedList') },
    { icon: <Quote size={15} />, label: 'Blockquote', action: () => exec('formatBlock', 'blockquote') },
    { icon: <Minus size={15} />, label: 'Divider', action: () => exec('insertHorizontalRule') },
    { divider: true },
    { icon: <Link size={15} />, label: 'Insert link', action: insertLink },
    { icon: <AlignLeft size={15} />, label: 'Align left', action: () => exec('justifyLeft') },
    { icon: <AlignCenter size={15} />, label: 'Align center', action: () => exec('justifyCenter') },
  ];

  return (
    <div className="border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-purple-500">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 bg-gray-50 border-b">
        {tools.map((t, i) =>
          t.divider ? (
            <div key={i} className="w-px h-5 bg-gray-300 mx-1" />
          ) : (
            <button
              key={i}
              type="button"
              title={t.label}
              onMouseDown={e => { e.preventDefault(); t.action(); }}
              className="p-1.5 rounded hover:bg-purple-100 hover:text-purple-700 text-gray-600 transition-colors"
            >
              {t.icon}
            </button>
          )
        )}
      </div>

      {/* Editor area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder}
        className="rich-editor-area min-h-[220px] p-4 text-sm text-gray-800 focus:outline-none"
        style={{ lineHeight: 1.7 }}
      />
    </div>
  );
}

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
  const [activeTab, setActiveTab] = useState('en'); // 'en' | 'de'

  useEffect(() => {
    fetch(`${API}/api/admin/newsletter/subscribers`, { credentials: 'include' })
      .then(r => r.json()).then(setStats).catch(() => {});
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
    } catch { setError('Network error'); }
    finally { setSending(false); setConfirmed(false); }
  };

  const resetForm = () => {
    setResult(null);
    setForm({ subject_en: '', subject_de: '', body_en: '', body_de: '', language_filter: '' });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <style>{`
        .rich-editor-area:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        .rich-editor-area h2 { font-size: 1.3em; font-weight: 700; margin: 12px 0 6px; }
        .rich-editor-area h3 { font-size: 1.1em; font-weight: 700; margin: 10px 0 4px; }
        .rich-editor-area ul  { list-style: disc; padding-left: 20px; margin: 6px 0; }
        .rich-editor-area blockquote { border-left: 3px solid #7c3aed; padding-left: 12px; color: #6b7280; margin: 8px 0; }
        .rich-editor-area a  { color: #7c3aed; text-decoration: underline; }
        .rich-editor-area hr { border: none; border-top: 1px solid #e5e7eb; margin: 12px 0; }
        .rich-editor-area p  { margin: 4px 0; }
      `}</style>

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Mail className="w-8 h-8 text-purple-600" />
          <h1 className="text-3xl font-bold text-purple-800">Newsletter Campaign</h1>
        </div>
        <p className="text-sm text-gray-500">Compose and send a campaign to your active subscribers.</p>
        {stats && (
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
              <Users className="w-4 h-4 text-purple-600" />
              <span className="font-bold text-purple-800">{stats.total}</span>
              <span className="text-sm text-gray-500">active subscribers</span>
            </div>
            {stats.byLanguage?.map(b => (
              <div key={b.language} className="flex items-center gap-2 bg-gray-50 border rounded-lg px-3 py-2 text-sm font-medium text-gray-700">
                {b.language === 'de' ? '🇩🇪' : '🇬🇧'} {b.language.toUpperCase()}: {b.count}
              </div>
            ))}
          </div>
        )}
      </div>

      {result ? (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-green-700 mb-2">Campaign Sent!</h2>
          <p className="text-gray-600">
            Sent: <strong>{result.sent}</strong> &nbsp;·&nbsp;
            Failed: <strong>{result.failed}</strong> &nbsp;·&nbsp;
            Total: <strong>{result.total}</strong>
          </p>
          <button onClick={resetForm}
            className="mt-6 px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700">
            Send Another
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border-b border-red-200 p-4 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
            </div>
          )}

          {/* Language tabs */}
          <div className="flex border-b">
            {[
              { key: 'en', label: '🇬🇧 English', required: true },
              { key: 'de', label: '🇩🇪 Deutsch', required: false },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.key
                    ? 'border-purple-600 text-purple-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {tab.required && <span className="ml-1 text-red-500 text-xs">required</span>}
                {tab.key === 'de' && !form.body_de && (
                  <span className="ml-1 text-gray-400 text-xs">(falls back to EN)</span>
                )}
              </button>
            ))}
          </div>

          <div className="p-6 space-y-4">
            {activeTab === 'en' ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Subject *</label>
                  <input
                    value={form.subject_en}
                    onChange={e => setForm(f => ({ ...f, subject_en: e.target.value }))}
                    className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Your June book picks are here!"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Body *</label>
                  <RichEditor
                    value={form.body_en}
                    onChange={v => setForm(f => ({ ...f, body_en: v }))}
                    placeholder="Hi there, check out our latest picks..."
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Betreff</label>
                  <input
                    value={form.subject_de}
                    onChange={e => setForm(f => ({ ...f, subject_de: e.target.value }))}
                    className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Deine Juni-Buchempfehlungen sind da!"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Text</label>
                  <RichEditor
                    value={form.body_de}
                    onChange={v => setForm(f => ({ ...f, body_de: v }))}
                    placeholder="Hallo, schau dir unsere neuesten Empfehlungen an..."
                  />
                </div>
              </>
            )}

            {/* Audience + send controls */}
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Send to</label>
                <select
                  value={form.language_filter}
                  onChange={e => setForm(f => ({ ...f, language_filter: e.target.value }))}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All subscribers ({stats?.total || 0})</option>
                  <option value="en">🇬🇧 English only</option>
                  <option value="de">🇩🇪 German only</option>
                </select>
              </div>

              <div className="flex-1" />

              <button
                type="button"
                onClick={() => setPreview(p => !p)}
                className="flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {preview ? <EyeOff size={15} /> : <Eye size={15} />}
                {preview ? 'Hide preview' : 'Preview'}
              </button>

              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={confirmed}
                  onChange={e => setConfirmed(e.target.checked)} />
                Confirm sending to <strong className="text-purple-700 mx-1">{targetCount}</strong> subscribers
              </label>

              <button
                onClick={handleSend}
                disabled={sending || !form.subject_en || !form.body_en}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-medium disabled:opacity-50 hover:opacity-90"
              >
                <Send className="w-4 h-4" />
                {sending ? 'Sending…' : 'Send Campaign'}
              </button>
            </div>
          </div>

          {/* Preview panel */}
          {preview && (
            <div className="border-t p-6 bg-gray-50">
              <h4 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wide">
                Email Preview — {activeTab === 'de' && form.body_de ? 'DE' : 'EN'}
              </h4>
              <div className="max-w-xl mx-auto rounded-xl overflow-hidden border shadow-sm">
                <div className="bg-gradient-to-r from-purple-900 to-purple-700 text-white text-center p-6">
                  <div className="text-xs font-bold uppercase tracking-widest text-purple-300 mb-2">EnglischBücher</div>
                  <h2 className="text-lg font-bold">📚 {activeTab === 'de' && form.subject_de ? form.subject_de : form.subject_en}</h2>
                </div>
                <div className="bg-white p-6">
                  <div
                    className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: (activeTab === 'de' && form.body_de ? form.body_de : form.body_en) || '<p style="color:#9ca3af">Nothing to preview yet…</p>'
                    }}
                  />
                  <p className="text-xs text-gray-400 text-center mt-6 pt-4 border-t">
                    <a href="#" className="text-gray-400">Unsubscribe</a>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

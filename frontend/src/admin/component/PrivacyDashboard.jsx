
import React, { useEffect, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useGetPrivacyQuery, useUpdatePrivacyMutation } from '../features/privacy/privacyApiSlice';

const SECTIONS = [
  'intro',
  'collection',
  'cookies',
  'analytics',
  'payment',
  'rights',
  'security',
];

const PrivacyDashboard = () => {
  const { data: p = {}, isLoading } = useGetPrivacyQuery();
  const [updatePrivacy, { isLoading: saving }] = useUpdatePrivacyMutation();

  // One state object containing ALL fields backend expects
  const [form, setForm] = useState({
    // formatted sections
    intro_en: '', intro_de: '',
    collection_en: '', collection_de: '',
    cookies_en: '', cookies_de: '',
    analytics_en: '', analytics_de: '',
    payment_en: '', payment_de: '',
    rights_en: '', rights_de: '',
    security_en: '', security_de: '',

    // controller fields (plain text)
    controller_name_en: '',
    controller_name_de: '',
    controller_address_en: '',
    controller_address_de: '',
    controller_email: '',
    last_updated: '',
  });

  useEffect(() => {
    // Populate from API (so nothing is undefined)
    setForm({
      intro_en: p.intro_en || '',
      intro_de: p.intro_de || '',
      collection_en: p.collection_en || '',
      collection_de: p.collection_de || '',
      cookies_en: p.cookies_en || '',
      cookies_de: p.cookies_de || '',
      analytics_en: p.analytics_en || '',
      analytics_de: p.analytics_de || '',
      payment_en: p.payment_en || '',
      payment_de: p.payment_de || '',
      rights_en: p.rights_en || '',
      rights_de: p.rights_de || '',
      security_en: p.security_en || '',
      security_de: p.security_de || '',

      controller_name_en: p.controller_name_en || '',
      controller_name_de: p.controller_name_de || '',
      controller_address_en: p.controller_address_en || '',
      controller_address_de: p.controller_address_de || '',
      controller_email: p.controller_email || '',
      last_updated: p.last_updated || '',
    });
  }, [p]);

  // ✅ Correct: update the specific key
  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Ensure nothing is undefined (backend will convert "" to null if it wants)
    const payload = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v ?? ''])
    );

    try {
      await updatePrivacy(payload).unwrap();
      alert('Datenschutzerklärung erfolgreich gespeichert!');
    } catch (err) {
      alert('Fehler: ' + (err?.data?.error || err?.message || 'Unknown error'));
      // eslint-disable-next-line no-console
      console.error(err);
    }
  };

  if (isLoading) return <div>Lade...</div>;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <h1>Datenschutzerklärung bearbeiten</h1>

      <form onSubmit={handleSubmit}>
        <h2>Verantwortlicher (plain fields)</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div>
            <label>Controller Name (EN)</label>
            <input value={form.controller_name_en} onChange={(e) => setField('controller_name_en', e.target.value)} style={{ width: '100%' }} />
          </div>
          <div>
            <label>Controller Name (DE)</label>
            <input value={form.controller_name_de} onChange={(e) => setField('controller_name_de', e.target.value)} style={{ width: '100%' }} />
          </div>

          <div>
            <label>Controller Address (EN)</label>
            <textarea value={form.controller_address_en} onChange={(e) => setField('controller_address_en', e.target.value)} rows={3} style={{ width: '100%' }} />
          </div>
          <div>
            <label>Controller Address (DE)</label>
            <textarea value={form.controller_address_de} onChange={(e) => setField('controller_address_de', e.target.value)} rows={3} style={{ width: '100%' }} />
          </div>

          <div>
            <label>Controller Email</label>
            <input value={form.controller_email} onChange={(e) => setField('controller_email', e.target.value)} style={{ width: '100%' }} />
          </div>

          <div>
            <label>Last Updated (text)</label>
            <input value={form.last_updated} onChange={(e) => setField('last_updated', e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>

        <hr />

        {SECTIONS.map((s) => (
          <div key={s} style={{ marginTop: 32 }}>
            <h2>{s.toUpperCase()}</h2>

            <h4>Deutsch</h4>
            <ReactQuill value={form[`${s}_de`]} onChange={(v) => setField(`${s}_de`, v)} />

            <h4 style={{ marginTop: 16 }}>English</h4>
            <ReactQuill value={form[`${s}_en`]} onChange={(v) => setField(`${s}_en`, v)} />
          </div>
        ))}

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="bg-purple-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50">
            {saving ? 'Speichert...' : 'Alles speichern'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default PrivacyDashboard;

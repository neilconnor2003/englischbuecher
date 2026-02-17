// frontend/src/admin/components/PrivacyDashboard.jsx
import React from 'react';
import { useGetPrivacyQuery, useUpdatePrivacyMutation } from '../features/privacy/privacyApiSlice';

const PrivacyDashboard = () => {
  const { data: p = {}, isLoading } = useGetPrivacyQuery();
  const [updatePrivacy, { isLoading: saving }] = useUpdatePrivacyMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    try {
      await updatePrivacy(data).unwrap();
      alert('Datenschutzerklärung erfolgreich gespeichert!');
    } catch (err) {
      alert('Fehler: ' + (err.data?.error || err.message));
    }
  };

  if (isLoading) return <div className="p-10 text-center">Lade...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8 text-purple-700">Datenschutzerklärung bearbeiten</h1>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-6 text-purple-600">Einleitung & Verantwortlicher</h2>
          <textarea name="intro_de" defaultValue={p.intro_de} rows="4" className="w-full p-3 border rounded mb-4" placeholder="Einleitung (DE)" required />
          <textarea name="intro_en" defaultValue={p.intro_en} rows="4" className="w-full p-3 border rounded mb-4" placeholder="Intro (EN)" />
          
          <div className="grid grid-cols-2 gap-6">
            <input name="controller_name_de" defaultValue={p.controller_name_de || 'Max Mustermann'} placeholder="Name (DE)" className="w-full p-3 border rounded" required />
            <input name="controller_name_en" defaultValue={p.controller_name_en || 'Max Mustermann'} placeholder="Name (EN)" className="w-full p-3 border rounded" />
            <textarea name="controller_address_de" defaultValue={p.controller_address_de || 'Musterstraße 123, 80331 München'} rows="2" className="w-full p-3 border rounded" required />
            <textarea name="controller_address_en" defaultValue={p.controller_address_en || 'Musterstraße 123, 80331 Munich'} rows="2" className="w-full p-3 border rounded" />
            <input name="controller_email" type="email" defaultValue={p.controller_email || 'datenschutz@dein-englisch-buecher.de'} className="w-full p-3 border rounded col-span-2" required />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <h3 className="text-xl font-semibold text-purple-600 mb-3">2. Datenerfassung</h3>
            <textarea name="collection_de" defaultValue={p.collection_de} rows="6" className="w-full p-3 border rounded" required />
            <textarea name="collection_en" defaultValue={p.collection_en} rows="6" className="w-full p-3 border rounded mt-3" />
          </div>

          <div>
            <h3 className="text-xl font-semibold text-purple-600 mb-3">3. Cookies</h3>
            <textarea name="cookies_de" defaultValue={p.cookies_de} rows="5" className="w-full p-3 border rounded" required />
            <textarea name="cookies_en" defaultValue={p.cookies_en} rows="5" className="w-full p-3 border rounded mt-3" />
          </div>

          <div>
            <h3 className="text-xl font-semibold text-purple-600 mb-3">4. Analyse- & Zahlungstools</h3>
            <textarea name="analytics_de" defaultValue={p.analytics_de} rows="4" className="w-full p-3 border rounded" placeholder="Google Analytics (DE)" />
            <textarea name="analytics_en" defaultValue={p.analytics_en} rows="4" className="w-full p-3 border rounded mt-3" placeholder="Google Analytics (EN)" />
            <textarea name="payment_de" defaultValue={p.payment_de} rows="4" className="w-full p-3 border rounded mt-4" placeholder="Stripe/PayPal (DE)" />
            <textarea name="payment_en" defaultValue={p.payment_en} rows="4" className="w-full p-3 border rounded mt-3" placeholder="Stripe/PayPal (EN)" />
          </div>

          <div>
            <h3 className="text-xl font-semibold text-purple-600 mb-3">5. Betroffenenrechte</h3>
            <textarea name="rights_de" defaultValue={p.rights_de} rows="6" className="w-full p-3 border rounded" required />
            <textarea name="rights_en" defaultValue={p.rights_en} rows="6" className="w-full p-3 border rounded mt-3" />
          </div>

          <div>
            <h3 className="text-xl font-semibold text-purple-600 mb-3">6. Datensicherheit</h3>
            <textarea name="security_de" defaultValue={p.security_de} rows="4" className="w-full p-3 border rounded" required />
            <textarea name="security_en" defaultValue={p.security_en} rows="4" className="w-full p-3 border rounded mt-3" />
          </div>

          <div>
            <label className="block font-medium mb-2">Stand der Datenschutzerklärung</label>
            <input name="last_updated" defaultValue={p.last_updated || 'November 2025'} className="w-full p-3 border rounded" />
          </div>
        </div>

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
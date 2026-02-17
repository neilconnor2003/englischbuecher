// frontend/src/admin/components/ImprintDashboard.jsx
import React from 'react';
import { useGetImprintQuery, useUpdateImprintMutation } from '../features/imprint/imprintApiSlice';

const ImprintDashboard = () => {
  const { data: imprint = {}, isLoading } = useGetImprintQuery();
  const [updateImprint, { isLoading: isUpdating }] = useUpdateImprintMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    try {
      await updateImprint(data).unwrap();
      alert('Impressum erfolgreich gespeichert!');
    } catch (err) {
      alert('Fehler beim Speichern: ' + (err.data?.error || err.message));
    }
  };

  if (isLoading) return <div className="p-10 text-center">Lade...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8 text-purple-700">Impressum bearbeiten</h1>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-6 text-purple-600">Unternehmen</h2>
          <div className="grid grid-cols-2 gap-6">
            <input name="company_name_en" defaultValue={imprint.company_name_en || 'Dein Englisch Bücher'} placeholder="Firmenname (EN)" className="w-full px-4 py-2 border rounded" required />
            <input name="company_name_de" defaultValue={imprint.company_name_de || 'Dein Englisch Bücher'} placeholder="Firmenname (DE)" className="w-full px-4 py-2 border rounded" required />
            <input name="owner_name_en" defaultValue={imprint.owner_name_en || 'Max Mustermann'} placeholder="Inhaber (EN)" className="w-full px-4 py-2 border rounded" required />
            <input name="owner_name_de" defaultValue={imprint.owner_name_de || 'Max Mustermann'} placeholder="Inhaber (DE)" className="w-full px-4 py-2 border rounded" required />
            <input name="address_street_en" defaultValue={imprint.address_street_en || 'Musterstraße 123'} placeholder="Straße (EN)" className="w-full px-4 py-2 border rounded" required />
            <input name="address_street_de" defaultValue={imprint.address_street_de || 'Musterstraße 123'} placeholder="Straße (DE)" className="w-full px-4 py-2 border rounded" required />
            <input name="address_city_en" defaultValue={imprint.address_city_en || '80331 Munich'} placeholder="Stadt (EN)" className="w-full px-4 py-2 border rounded" required />
            <input name="address_city_de" defaultValue={imprint.address_city_de || '80331 München'} placeholder="Stadt (DE)" className="w-full px-4 py-2 border rounded" required />
            <input name="phone" type="tel" defaultValue={imprint.phone || '+498912345678'} placeholder="Telefon" className="w-full px-4 py-2 border rounded" required />
            <input name="email" type="email" defaultValue={imprint.email || 'info@dein-englisch-buecher.de'} placeholder="E-Mail" className="w-full px-4 py-2 border rounded" required />
            <input name="website" defaultValue={imprint.website || 'dein-englisch-buecher.de'} placeholder="Website" className="w-full px-4 py-2 border rounded" required />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-6 text-purple-600">Steuer & Register</h2>
          <div className="grid grid-cols-2 gap-6">
            <input name="tax_id" defaultValue={imprint.tax_id || 'DE123456789'} placeholder="USt-IdNr." className="w-full px-4 py-2 border rounded" required />
            <input name="tax_number" defaultValue={imprint.tax_number || '123/456/78901'} placeholder="Steuernummer" className="w-full px-4 py-2 border rounded" />
            <input name="register_court_en" defaultValue={imprint.register_court_en || 'District Court Munich'} placeholder="Registergericht (EN)" className="w-full px-4 py-2 border rounded" />
            <input name="register_court_de" defaultValue={imprint.register_court_de || 'Amtsgericht München'} placeholder="Registergericht (DE)" className="w-full px-4 py-2 border rounded" required />
            <input name="register_number" defaultValue={imprint.register_number || 'HRB 123456'} placeholder="Registernummer" className="w-full px-4 py-2 border rounded" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-6 text-purple-600">Verantwortlich & Haftungsausschluss</h2>
          <div className="grid grid-cols-2 gap-6">
            <textarea name="responsible_person_en" defaultValue={imprint.responsible_person_en || 'Max Mustermann, Musterstraße 123, 80331 Munich'} rows="3" placeholder="Verantwortlich §55 RStV (EN)" className="w-full px-4 py-2 border rounded"></textarea>
            <textarea name="responsible_person_de" defaultValue={imprint.responsible_person_de || 'Max Mustermann, Musterstraße 123, 80331 München'} rows="3" placeholder="Verantwortlich §55 RStV (DE)" className="w-full px-4 py-2 border rounded"></textarea>
            <textarea name="disclaimer_en" defaultValue={imprint.disclaimer_en || 'The content of our pages has been created with the utmost care...'} rows="6" placeholder="Haftungsausschluss (EN)" className="w-full px-4 py-2 border rounded"></textarea>
            <textarea name="disclaimer_de" defaultValue={imprint.disclaimer_de || 'Der Inhalt unserer Seiten wurde mit größter Sorgfalt erstellt...'} rows="6" placeholder="Haftungsausschluss (DE)" className="w-full px-4 py-2 border rounded"></textarea>
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={isUpdating} className="bg-purple-600 text-white px-8 py-3 rounded-lg font-bold hover:bg-purple-700 disabled:opacity-50">
            {isUpdating ? 'Speichert...' : 'Alle Änderungen speichern'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ImprintDashboard;
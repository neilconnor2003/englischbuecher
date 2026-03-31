
import React, { useEffect, useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { useGetPrivacyQuery, useUpdatePrivacyMutation } from '../features/privacy/privacyApiSlice';

const PrivacyDashboard = () => {
  const { data: p = {}, isLoading } = useGetPrivacyQuery();
  const [updatePrivacy, { isLoading: saving }] = useUpdatePrivacyMutation();

  const fields = [
    'intro', 'collection', 'cookies', 'analytics',
    'payment', 'rights', 'security'
  ];

  const [content, setContent] = useState({});

  useEffect(() => {
    const initial = {};
    fields.forEach(f => {
      initial[`${f}_en`] = p[`${f}_en`] || '';
      initial[`${f}_de`] = p[`${f}_de`] || '';
    });
    setContent(initial);
  }, [p]);

  const handleChange = (key, value) => {
    setContent(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await updatePrivacy(content).unwrap();
      alert('Datenschutzerklärung erfolgreich gespeichert!');
    } catch (err) {
      alert(err.data?.error || err.message);
    }
  };

  if (isLoading) return <div>Lade...</div>;

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 1200, margin: '0 auto' }}>
      <h1>Datenschutzerklärung bearbeiten</h1>

      {fields.map(section => (
        <div key={section} style={{ marginBottom: 48 }}>
          <h2>{section.toUpperCase()}</h2>

          <h4>Deutsch</h4>
          <ReactQuill
            value={content[`${section}_de`] || ''}
            onChange={(v) => handleChange(`${section}_de`, v)}
          />

          <h4 style={{ marginTop: 20 }}>English</h4>
          <ReactQuill
            value={content[`${section}_en`] || ''}
            onChange={(v) => handleChange(`${section}_en`, v)}
          />
        </div>
      ))}

      <button type="submit" disabled={saving}>
        {saving ? 'Speichert…' : 'Alles speichern'}
      </button>
    </form>
  );
};

export default PrivacyDashboard;

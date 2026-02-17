// frontend/src/admin/components/FAQDashboard.jsx
import React, { useState, useEffect } from 'react';
import {
  useGetAdminFaqsQuery,
  useAddFaqMutation,
  useUpdateFaqMutation,
  useDeleteFaqMutation
} from '../features/faq/faqApiSlice';

const FAQDashboard = () => {
  const { data: faqs = [], isLoading, refetch } = useGetAdminFaqsQuery();
  const [addFaq] = useAddFaqMutation();
  const [updateFaq] = useUpdateFaqMutation();
  const [deleteFaq] = useDeleteFaqMutation();

  // Local state for instant UI + debounced save
  const [localFaqs, setLocalFaqs] = useState([]);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    setLocalFaqs(faqs);
  }, [faqs]);

  // Debounced auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      localFaqs.forEach(async (faq) => {
        if (faq._dirty) {
          setSavingId(faq.id);
          try {
            await updateFaq({
              id: faq.id,
              question_de: faq.question_de,
              question_en: faq.question_en,
              answer_de: faq.answer_de,
              answer_en: faq.answer_en,
              sort_order: faq.sort_order || 0,
              is_visible: faq.is_visible ? 1 : 0
            }).unwrap();
            setLocalFaqs(prev => prev.map(f => f.id === faq.id ? { ...f, _dirty: false } : f));
          } catch (err) {
            alert('Speichern fehlgeschlagen für FAQ ' + faq.id);
          } finally {
            setSavingId(null);
          }
        }
      });
    }, 800); // saves 800ms after you stop typing

    return () => clearTimeout(timer);
  }, [localFaqs, updateFaq]);

  const handleChange = (id, field, value) => {
    setLocalFaqs(prev => prev.map(faq =>
      faq.id === id ? { ...faq, [field]: value, _dirty: true } : faq
    ));
  };

  const handleAdd = async () => {
    try {
      const newFaq = {
        question_de: 'Neue Frage',
        question_en: 'New Question',
        answer_de: '<p>Hier steht die Antwort...</p>',
        answer_en: '<p>Here is the answer...</p>',
        sort_order: localFaqs.length
      };
      const result = await addFaq(newFaq).unwrap();
      refetch(); // refresh list with new ID
    } catch (err) {
      alert('Fehler beim Hinzufügen');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Diese FAQ wirklich löschen?')) return;
    await deleteFaq(id);
    refetch();
  };

  if (isLoading) return <div className="p-20 text-center">Lade...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-purple-700">FAQ verwalten</h1>
        <button onClick={handleAdd} className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700">
          + Neue FAQ hinzufügen
        </button>
      </div>

      {localFaqs.length === 0 ? (
        <p className="text-center text-gray-500 py-20">Noch keine FAQs. Klicke oben auf "+ Neue FAQ hinzufügen"</p>
      ) : (
        <div className="space-y-8">
          {localFaqs.map((faq) => (
            <div key={faq.id} className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
              <div className="grid grid-cols-2 gap-8 mb-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Frage (Deutsch)</label>
                  <input
                    value={faq.question_de || ''}
                    onChange={(e) => handleChange(faq.id, 'question_de', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="z.B. Wie lange dauert der Versand?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Question (English)</label>
                  <input
                    value={faq.question_en || ''}
                    onChange={(e) => handleChange(faq.id, 'question_en', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Antwort (Deutsch)</label>
                  <textarea
                    rows="6"
                    value={faq.answer_de || ''}
                    onChange={(e) => handleChange(faq.id, 'answer_de', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="Verwende &lt;p&gt;, &lt;ul&gt;, &lt;strong&gt; für Formatierung..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Answer (English)</label>
                  <textarea
                    rows="6"
                    value={faq.answer_en || ''}
                    onChange={(e) => handleChange(faq.id, 'answer_en', e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between mt-6 pt-6 border-t">
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={faq.is_visible === 1 || faq.is_visible === true}
                      onChange={(e) => handleChange(faq.id, 'is_visible', e.target.checked)}
                      className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                    />
                    <span className="font-medium">Sichtbar auf der Website</span>
                  </label>
                  {savingId === faq.id && <span className="text-sm text-purple-600">Speichert...</span>}
                  {savingId !== faq.id && faq._dirty && <span className="text-sm text-green-600">Wird gespeichert...</span>}
                </div>

                <button
                  onClick={() => handleDelete(faq.id)}
                  className="text-red-600 hover:text-red-800 font-medium"
                >
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FAQDashboard;
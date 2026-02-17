// frontend/src/admin/components/ContactUsDashboard.jsx
import React from 'react';
import { useGetContactQuery, useUpdateContactMutation } from '../features/contact/contactApiSlice';
import { useTranslation } from 'react-i18next';

const ContactUsDashboard = () => {
  const { t } = useTranslation();
  const { data: contact = {}, isLoading } = useGetContactQuery();
  const [updateContact, { isLoading: isUpdating }] = useUpdateContactMutation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      await updateContact(formData).unwrap();
      alert('Contact page updated successfully!');
    } catch (err) {
      alert('Failed to save: ' + (err.data?.error || err.message));
    }
  };

  if (isLoading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8 text-purple-700">Contact Us Page Editor</h1>
      
      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-6 text-purple-600">Hero Section</h2>
          
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Title (EN)</label>
              <input name="title_en" defaultValue={contact.title_en} className="w-full px-4 py-2 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Title (DE)</label>
              <input name="title_de" defaultValue={contact.title_de} className="w-full px-4 py-2 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Subtitle (EN)</label>
              <textarea name="subtitle_en" defaultValue={contact.subtitle_en} rows="3" className="w-full px-4 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Subtitle (DE)</label>
              <textarea name="subtitle_de" defaultValue={contact.subtitle_de} rows="3" className="w-full px-4 py-2 border rounded-lg" />
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium mb-2">Hero Background Image</label>
            {contact.hero_image_url && (
              <img src={contact.hero_image_url} alt="Current hero" className="w-full h-64 object-cover rounded-lg mb-4" />
            )}
            <input type="file" name="hero_image" accept="image/*" className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-purple-600 file:text-white hover:file:bg-purple-700" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-semibold mb-6 text-purple-600">Contact Info</h2>
          
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input name="email" type="email" defaultValue={contact.email} className="w-full px-4 py-2 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Phone</label>
              <input name="phone" defaultValue={contact.phone} className="w-full px-4 py-2 border rounded-lg" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Phone Hours (EN)</label>
              <input name="phone_hours_en" defaultValue={contact.phone_hours_en} className="w-full px-4 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Phone Hours (DE)</label>
              <input name="phone_hours_de" defaultValue={contact.phone_hours_de} className="w-full px-4 py-2 border rounded-lg" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Response Time (EN)</label>
              <textarea name="response_time_en" defaultValue={contact.response_time_en} rows="3" className="w-full px-4 py-2 border rounded-lg" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Response Time (DE)</label>
              <textarea name="response_time_de" defaultValue={contact.response_time_de} rows="3" className="w-full px-4 py-2 border rounded-lg" />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isUpdating}
            className="bg-purple-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
          >
            {isUpdating ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ContactUsDashboard;
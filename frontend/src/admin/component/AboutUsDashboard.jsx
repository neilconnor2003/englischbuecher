// frontend/src/admin/components/AboutUsDashboard.jsx
import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  useGetAboutQuery,
  useUpdateAboutMutation,
} from '../features/about/aboutApiSlice';
import { Upload, message, Spin } from 'antd';
import { UploadOutlined } from '@ant-design/icons';

const AboutUsDashboard = () => {
  const { data: about, isLoading } = useGetAboutQuery();
  const [updateAbout, { isLoading: isUpdating }] = useUpdateAboutMutation();

  const { register, handleSubmit, setValue, watch } = useForm();

  const heroImage = watch('hero_image');
  const storyImage = watch('story_image');

  useEffect(() => {
    if (about) {
      setValue('title_en', about.title_en || '');
      setValue('title_de', about.title_de || '');
      setValue('subtitle_en', about.subtitle_en || '');
      setValue('subtitle_de', about.subtitle_de || '');
      setValue('mission_en', about.mission_en || '');
      setValue('mission_de', about.mission_de || '');
      setValue('story_en', about.story_en || '');
      setValue('story_de', about.story_de || '');
      setValue('values_quality_en', about.values_quality_en || '');
      setValue('values_quality_de', about.values_quality_de || '');
      setValue('values_service_en', about.values_service_en || '');
      setValue('values_service_de', about.values_service_de || '');
      setValue('values_speed_en', about.values_speed_en || '');
      setValue('values_speed_de', about.values_speed_de || '');
      setValue('team_en', about.team_en || '');
      setValue('team_de', about.team_de || '');
    }
  }, [about, setValue]);

  const onSubmit = async (data) => {
    const formData = new FormData();

    // Append text fields
    Object.keys(data).forEach((key) => {
      if (data[key] && typeof data[key] === 'string') {
        formData.append(key, data[key]);
      }
    });

    // Append images if new ones selected
    if (heroImage?.[0]) formData.append('hero_image', heroImage[0]);
    if (storyImage?.[0]) formData.append('story_image', storyImage[0]);

    try {
      await updateAbout(formData).unwrap();
      message.success('About Us page updated successfully!');
    } catch (err) {
      message.error('Failed to update About Us page');
      console.error(err);
    }
  };

  if (isLoading) return <div className="p-10 text-center"><Spin size="large" /></div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">About Us Page Editor</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-10 max-w-5xl">

        {/* Hero Section */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-6 text-purple-700">Hero Section</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block font-medium text-gray-700 mb-2">Title (English)</label>
              <input {...register('title_en')} className="w-full p-3 border rounded-lg" placeholder="About Us" />
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-2">Title (German)</label>
              <input {...register('title_de')} className="w-full p-3 border rounded-lg" placeholder="Über uns" />
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-2">Subtitle (English)</label>
              <textarea {...register('subtitle_en')} rows={2} className="w-full p-3 border rounded-lg" placeholder="Your #1 destination..." />
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-2">Subtitle (German)</label>
              <textarea {...register('subtitle_de')} rows={2} className="w-full p-3 border rounded-lg" placeholder="Deine Nr. 1 Adresse..." />
            </div>
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-3">Hero Background Image</label>
            {about?.hero_image_url && (
              <img src={about.hero_image_url} alt="Hero" className="w-full h-64 object-cover rounded-lg mb-4 shadow" />
            )}
            <Upload
              accept="image/*"
              maxCount={1}
              beforeUpload={() => false}
              onChange={(info) => setValue('hero_image', info.fileList.map(f => f.originFileObj))}
            >
              <button type="button" className="px-5 py-3 border border-purple-600 text-purple-600 rounded-lg flex items-center gap-2 hover:bg-purple-50">
                <UploadOutlined /> Upload New Hero Image
              </button>
            </Upload>
          </div>
        </section>

        {/* Mission */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-6 text-purple-700">Mission Statement</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block font-medium text-gray-700 mb-2">Mission (English)</label>
              <textarea {...register('mission_en')} rows={4} className="w-full p-3 border rounded-lg" />
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-2">Mission (German)</label>
              <textarea {...register('mission_de')} rows={4} className="w-full p-3 border rounded-lg" />
            </div>
          </div>
        </section>

        {/* Story */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-6 text-purple-700">Our Story</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block font-medium text-gray-700 mb-2">Story Text (English)</label>
              <textarea {...register('story_en')} rows={6} className="w-full p-3 border rounded-lg" />
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-2">Story Text (German)</label>
              <textarea {...register('story_de')} rows={6} className="w-full p-3 border rounded-lg" />
            </div>
          </div>

          <div>
            <label className="block font-medium text-gray-700 mb-3">Story Image (right side)</label>
            {about?.story_image_url && (
              <img src={about.story_image_url} alt="Story" className="w-full max-w-md h-64 object-cover rounded-lg mb-4 shadow" />
            )}
            <Upload
              accept="image/*"
              maxCount={1}
              beforeUpload={() => false}
              onChange={(info) => setValue('story_image', info.fileList.map(f => f.originFileObj))}
            >
              <button type="button" className="px-5 py-3 border border-purple-600 text-purple-600 rounded-lg flex items-center gap-2 hover:bg-purple-50">
                <UploadOutlined /> Upload Story Image
              </button>
            </Upload>
          </div>
        </section>

        {/* Values */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-6 text-purple-700">Our Values (3 Cards)</h2>
          <div className="space-y-8">
            {['quality', 'service', 'speed'].map((val) => (
              <div key={val} className="border-l-4 border-purple-600 pl-6">
                <h3 className="text-xl font-semibold capitalize mb-4">{val === 'quality' ? 'Top Selection' : val === 'service' ? 'Best Service' : 'Lightning-Fast Shipping'}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block font-medium text-gray-700 mb-2">Title (EN)</label>
                    <input {...register(`values_${val}_en`)} className="w-full p-3 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700 mb-2">Title (DE)</label>
                    <input {...register(`values_${val}_de`)} className="w-full-full p-3 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700 mb-2">Text (EN)</label>
                    <textarea {...register(`values_${val}_text_en`)} rows={3} className="w-full p-3 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block font-medium text-gray-700 mb-2">Text (DE)</label>
                    <textarea {...register(`values_${val}_text_de`)} rows={3} className="w-full p-3 border rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Team */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-semibold mb-6 text-purple-700">Team Section</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block font-medium text-gray-700 mb-2">Team Text (English)</label>
              <textarea {...register('team_en')} rows={4} className="w-full p-3 border rounded-lg" />
            </div>
            <div>
              <label className="block font-medium text-gray-700 mb-2">Team Text (German)</label>
              <textarea {...register('team_de')} rows={4} className="w-full p-3 border rounded-lg" />
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className="text-center pt-6">
          <button
            type="submit"
            disabled={isUpdating}
            className="px-10 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-lg font-semibold rounded-lg shadow-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-70"
          >
            {isUpdating ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AboutUsDashboard;
// frontend/src/admin/component/HeroBannerDashboard.jsx
import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import {
  useGetHeroBannersQuery,
  useUpdateHeroBannersMutation,
} from '../features/hero/heroBannerApiSlice';

import { Upload, message, Button } from 'antd';
import { UploadOutlined } from '@ant-design/icons';   // ← THIS LINE WAS MISSING

import { Plus, Trash2, GripVertical } from 'lucide-react';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableBannerItem = ({ banner, index, onRemove, register, setValue, watch }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: banner.id || `new-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-xl shadow-lg p-6 mb-6 border-2 ${isDragging ? 'border-blue-500' : 'border-gray-200'
        }`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-purple-700">Banner #{index + 1}</h3>
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block font-medium mb-2">Image</label>
          {watch(`banners.${index}.image_url`) && (
            <img
              src={watch(`banners.${index}.image_url`)}
              alt="Preview"
              className="w-full h-48 object-cover rounded-lg shadow mb-3"
            />
          )}
          <Upload
            accept="image/*"
            maxCount={1}
            beforeUpload={() => false}
            onChange={(info) => {
              if (info.fileList.length > 0) {
                const file = info.fileList[0].originFileObj;
                setValue(`banners.${index}.image`, file);
                setValue(`banners.${index}.image_url`, URL.createObjectURL(file));
              }
            }}
          >
            <Button icon={<UploadOutlined />}>Upload New Image</Button>
          </Upload>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm font-medium">Active</label>
          <input
            type="checkbox"
            {...register(`banners.${index}.is_active`)}
            defaultChecked={banner.is_active}
            className="w-5 h-5 text-green-600 rounded"
          />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <input
              {...register(`banners.${index}.title_en`)}
              placeholder="Title (EN)"
              className="p-3 border rounded-lg"
            />
            <input
              {...register(`banners.${index}.title_de`)}
              placeholder="Title (DE)"
              className="p-3 border rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <textarea
              {...register(`banners.${index}.subtitle_en`)}
              placeholder="Subtitle (EN)"
              rows={2}
              className="p-3 border rounded-lg"
            />
            <textarea
              {...register(`banners.${index}.subtitle_de`)}
              placeholder="Subtitle (DE)"
              rows={2}
              className="p-3 border rounded-lg"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              {...register(`banners.${index}.button_text_en`)}
              placeholder="Button Text (EN)"
              className="p-3 border rounded-lg"
            />
            <input
              {...register(`banners.${index}.button_text_de`)}
              placeholder="Button Text (DE)"
              className="p-3 border rounded-lg"
            />
          </div>

          <input
            {...register(`banners.${index}.button_link`)}
            placeholder="Button Link (e.g. /books/123)"
            className="w-full p-3 border rounded-lg"
          />
        </div>
      </div>
    </div>
  );
};

const HeroBannerDashboard = () => {
  const { data: rawBanners = [], isLoading } = useGetHeroBannersQuery();
  const [updateHeroBanners] = useUpdateHeroBannersMutation();   // ← MATCH THE NAME!

  const { register, handleSubmit, control, setValue, watch } = useForm({
    defaultValues: { banners: [] },
  });

  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'banners',
  });

  const [banners, setBanners] = useState([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  // Initialize form when data loads
  React.useEffect(() => {
    if (rawBanners && rawBanners.length > 0) {
      setBanners(rawBanners);
      //setValue('banners', rawBanners.map(b => ({ ...b, image: null })));
      setValue('banners', rawBanners.map(b => ({
        ...b,
        image: null,
        is_active: b.is_active // make sure it's boolean
      })));
    }
  }, [rawBanners, setValue]);

  const onSubmit = async (data) => {
    const formData = new FormData();

    data.banners.forEach((banner, index) => {
      formData.append(`banners[${index}]id`, banner.id || '');
      formData.append(`banners[${index}]title_en`, banner.title_en || '');
      formData.append(`banners[${index}]title_de`, banner.title_de || '');
      formData.append(`banners[${index}]subtitle_en`, banner.subtitle_en || '');
      formData.append(`banners[${index}]subtitle_de`, banner.subtitle_de || '');
      formData.append(`banners[${index}]button_text_en`, banner.button_text_en || '');
      formData.append(`banners[${index}]button_text_de`, banner.button_text_de || '');
      formData.append(`banners[${index}]button_link`, banner.button_link || '');
      formData.append(`banners[${index}]image_path`, banner.image_path || '');
      formData.append(`banners[${index}]is_active`, banner.is_active ? 'true' : 'false');

      // ← ONLY APPEND IMAGE IF IT EXISTS AND IS A FILE
      if (banner.image instanceof File) {
        formData.append('image', banner.image);  // ← plain 'image' field
      }
    });

    try {
      await updateHeroBanners(formData).unwrap();
      message.success('All hero banners saved & order updated!');
    } catch (err) {
      console.error('Save failed:', err);
      message.error('Failed to save banners');
    }
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setBanners((items) => {
        const oldIndex = items.findIndex((i) => (i.id || `new-${items.indexOf(i)}`) === active.id);
        const newIndex = items.findIndex((i) => (i.id || `new-${items.indexOf(i)}`) === over.id);
        const newOrder = arrayMove(items, oldIndex, newIndex);
        setValue('banners', newOrder.map(b => ({ ...b, image: null })));
        return newOrder;
      });
    }
  };

  if (isLoading) return <div className="p-6 text-center">Loading banners...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-purple-800">Hero Banner Manager</h1>
        <button
          type="button"
          onClick={() => {
            const newBanner = {
              title_en: 'New Amazing Offer',
              title_de: 'Neues tolles Angebot',
              subtitle_en: 'Limited time only!',
              subtitle_de: 'Nur für kurze Zeit!',
              button_text_en: 'Shop Now',
              button_text_de: 'Jetzt shoppen',
              button_link: '/books',
            };
            append(newBanner);
            setBanners(prev => [...prev, newBanner]);
          }}
          className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:shadow-lg font-bold"
        >
          <Plus className="w-5 h-5" /> Add New Banner
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={banners.map((b, i) => b.id || `new-${i}`)} strategy={verticalListSortingStrategy}>
            {banners.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                <p className="text-xl">No banners yet. Click "Add New Banner" to start!</p>
              </div>
            ) : (
              banners.map((banner, index) => (
                <SortableBannerItem
                  key={banner.id || `new-${index}`}
                  banner={banner}
                  index={index}
                  onRemove={remove}
                  register={register}
                  setValue={setValue}
                  watch={watch}
                />
              ))
            )}
          </SortableContext>
        </DndContext>

        {banners.length > 0 && (
          <div className="flex justify-end mt-8">
            <button
              type="submit"
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-lg font-bold rounded-xl hover:shadow-2xl transition"
            >
              Save All Banners & Order
            </button>
          </div>
        )}
      </form>
    </div>
  );
};

export default HeroBannerDashboard;
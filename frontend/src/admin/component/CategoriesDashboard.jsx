// frontend/src/admin/pages/CategoriesDashboard.jsx
import React, { useState, useEffect } from 'react';
import {
  useGetCategoriesQuery,
  useAddCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation
} from '../features/book/bookApiSlice';
import { Upload, Image, Trash2, Edit, Download, Plus, Eye, EyeOff, GripVertical, ChevronDown, ChevronRight } from 'lucide-react';
import config from '@config';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const SortableCategoryItem = ({ category, level = 0, isExpanded, onToggle, onEdit, onDelete, onToggleVisibility }) => {
  const hasChildren = category.children && category.children.length > 0;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-2">
      {/* MAIN CARD */}
      <div
        className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-all p-4 border ${
          isDragging ? 'border-purple-400 ring-2 ring-purple-300' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center gap-3">
          {/* EXPAND BUTTON */}
          {hasChildren && (
            <button
              onClick={() => onToggle(category.id)}
              className="p-1 hover:bg-gray-100 rounded"
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          )}
          {!hasChildren && <div className="w-6" />}

          {/* DRAG HANDLE */}
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
            <GripVertical className="w-5 h-5 text-gray-400" />
          </div>

          {/* ICON */}
          {category.icon_path ? (
            <img
              src={`${config.API_URL}${category.icon_path}`}
              alt=""
              className="w-10 h-10 object-contain rounded"
            />
          ) : (
            <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
              <span className="text-xs font-bold text-gray-500">{category.name_en[0]}</span>
            </div>
          )}

          {/* CONTENT */}
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-purple-800">{category.name_en}</h3>
              <span className="text-xs text-gray-500">ID: {category.id}</span>
            </div>
            {category.name_de && <p className="text-sm text-gray-600">{category.name_de}</p>}
            <p className="text-xs text-purple-600">/{category.slug}</p>

            {/* BREADCRUMBS */}
            {level > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {Array(level).fill('→').join(' ')} Parent Level {level}
              </p>
            )}
          </div>

          {/* VISIBILITY */}
          <button
            onClick={() => onToggleVisibility(category)}
            className="p-1.5 hover:bg-gray-100 rounded"
          >
            {category.is_visible == 1 ? (
              <Eye className="w-4 h-4 text-green-600" />
            ) : (
              <EyeOff className="w-4 h-4 text-red-500" />
            )}
          </button>

          {/* ACTIONS */}
          <button onClick={() => onEdit(category)} className="p-1.5 hover:bg-gray-100 rounded">
            <Edit className="w-4 h-4 text-blue-600" />
          </button>
          <button onClick={() => onDelete(category)} className="p-1.5 hover:bg-gray-100 rounded">
            <Trash2 className="w-4 h-4 text-red-600" />
          </button>
        </div>
      </div>

      {/* CHILDREN (INDENTED + COLLAPSIBLE) */}
      {hasChildren && isExpanded && (
        <div style={{ marginLeft: `${(level + 1) * 32}px` }} className="mt-2">
          {category.children.map(child => (
            <SortableCategoryItem
              key={child.id}
              category={child}
              level={level + 1}
              isExpanded={child.isExpanded || false}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleVisibility={onToggleVisibility}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const CategoriesDashboard = () => {
  const { data = { hierarchy: [] }, isLoading, refetch } = useGetCategoriesQuery();
  const [addCategory] = useAddCategoryMutation();
  const [updateCategory] = useUpdateCategoryMutation();
  const [deleteCategory] = useDeleteCategoryMutation();

  const [expanded, setExpanded] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [flatWithLevel, setFlatWithLevel] = useState([]);

  const [formData, setFormData] = useState({
    name_en: '',
    name_de: '',
    slug: '',
    parent_id: '',
    icon: null,
    is_visible: true
  });
  const [preview, setPreview] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Add isExpanded to hierarchy
  const addExpandedFlag = (nodes) => {
    return nodes.map(node => ({
      ...node,
      isExpanded: expanded[node.id] || false,
      children: node.children ? addExpandedFlag(node.children) : []
    }));
  };

  const hierarchyWithExpand = data.hierarchy ? addExpandedFlag(data.hierarchy) : [];

  const toggleExpand = (id) => {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Simple reordering — backend sync optional
    // For now: just UI
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData(prev => ({ ...prev, icon: file }));
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    const data = new FormData();
    data.append('name_en', formData.name_en.trim() || 'Untitled');
    data.append('name_de', formData.name_de.trim() || '');
    data.append('slug', formData.slug.trim() || formData.name_en.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
    data.append('parent_id', formData.parent_id || '');
    data.append('is_visible', formData.is_visible ? 1 : 0);
    if (formData.icon && typeof formData.icon !== 'string') {
      data.append('icon', formData.icon);
    }

    try {
      if (selectedCategory?.id) {
        await updateCategory({ id: selectedCategory.id, body: data }).unwrap();
      } else {
        await addCategory(data).unwrap();
      }
      refetch();
      handleClose();
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setSelectedCategory(null);
    setFormData({ name_en: '', name_de: '', slug: '', parent_id: '', icon: null, is_visible: true });
    setPreview(null);
  };

  const handleEdit = (cat) => {
    setSelectedCategory(cat);
    setFormData({
      name_en: cat.name_en || '',
      name_de: cat.name_de || '',
      slug: cat.slug || '',
      parent_id: cat.parent_id || '',
      icon: cat.icon_path || null,
      is_visible: cat.is_visible == 1
    });
    setPreview(cat.icon_path ? `${config.API_URL}${cat.icon_path}` : null);
    setIsModalOpen(true);
  };

  const toggleVisibility = async (cat) => {
    const form = new FormData();
    form.append('is_visible', cat.is_visible == 1 ? 0 : 1);
    await updateCategory({ id: cat.id, body: form }).unwrap();
    refetch();
  };

  const handleDelete = async (cat) => {
    if (window.confirm(`Delete "${cat.name_en}" and all subcategories?`)) {
      await deleteCategory(cat.id).unwrap();
      refetch();
    }
  };

  const handleExportCSV = () => {
    const headers = ['ID', 'Name (EN)', 'Name (DE)', 'Slug', 'Parent ID', 'Visible'];
    const rows = (data.flat || []).map(cat => [
      cat.id,
      cat.name_en,
      cat.name_de,
      cat.slug,
      cat.parent_id || '',
      cat.is_visible ? 'Yes' : 'No'
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'categories.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="p-6 text-center">Loading...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-purple-800">Category Tree</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Plus size={18} /> Add Root
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download size={18} /> Export
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={hierarchyWithExpand.map(c => c.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {hierarchyWithExpand.length === 0 ? (
              <p className="text-center text-gray-500 py-12">No categories. Add one!</p>
            ) : (
              hierarchyWithExpand.map(root => (
                <SortableCategoryItem
                  key={root.id}
                  category={root}
                  level={0}
                  isExpanded={root.isExpanded}
                  onToggle={toggleExpand}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleVisibility={toggleVisibility}
                />
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-purple-800 mb-5">
              {selectedCategory ? 'Edit' : 'Add'} Category
            </h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Name (EN)"
                value={formData.name_en}
                onChange={e => setFormData({ ...formData, name_en: e.target.value })}
                className="w-full px-4 py-2.5 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="text"
                placeholder="Name (DE)"
                value={formData.name_de}
                onChange={e => setFormData({ ...formData, name_de: e.target.value })}
                className="w-full px-4 py-2.5 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="text"
                placeholder="Slug"
                value={formData.slug}
                onChange={e => setFormData({ ...formData, slug: e.target.value })}
                className="w-full px-4 py-2.5 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
              />

              <select
                value={formData.parent_id}
                onChange={e => setFormData({ ...formData, parent_id: e.target.value })}
                className="w-full px-4 py-2.5 border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                <option value="">None (Root)</option>
                {(data.flat || []).filter(c => c.id !== selectedCategory?.id).map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {'—'.repeat(cat.level || 0)} {cat.name_en}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.is_visible}
                  onChange={e => setFormData({ ...formData, is_visible: e.target.checked })}
                  className="w-5 h-5 text-purple-600 rounded"
                />
                <label className="text-sm font-medium">Visible</label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Icon</label>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-purple-300 rounded-lg cursor-pointer hover:border-purple-500 bg-purple-50">
                  {preview ? (
                    <img src={preview} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                  ) : (
                    <div className="flex flex-col items-center pt-5 pb-6">
                      <Upload size={32} className="text-purple-500 mb-2" />
                      <p className="text-sm text-purple-600">Upload</p>
                    </div>
                  )}
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                </label>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={handleSave} className="flex-1 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium">
                Save
              </button>
              <button onClick={handleClose} className="flex-1 py-2.5 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 font-medium">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriesDashboard;
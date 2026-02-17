
import React, { useState } from 'react';
import {
  useGetAuthorsQuery,
  useAddAuthorMutation,
  useUpdateAuthorMutation,
  useDeleteAuthorMutation,
  // useUploadAuthorPhotoMutation, // no longer needed with AntD Upload customRequest
} from '../features/authors/authorsApiSlice';

import {
  Plus,
  Edit,
  Trash2,
  Search,
  Upload as UploadIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { Upload as AntUpload, message } from 'antd';
import axios from 'axios';
import config from '@config';

/* ------------------------------ Avatar ------------------------------ */
/** Deterministic color from string (author name) */
const colorFromString = (s = '') => {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = s.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 70% 45%)`;
};

/** Make initials from a full name */
const initialsFromName = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

/** Simple avatar (square with rounded corners) */
const Avatar = ({ name, size = 80, className = '' }) => {
  const initials = initialsFromName(name);
  const bg = colorFromString(name);
  const style = {
    width: size,
    height: size,
    backgroundColor: bg,
  };
  return (
    <div
      className={`inline-flex items-center justify-center rounded-lg border text-white font-bold select-none ${className}`}
      style={style}
      aria-label={name}
      title={name}
    >
      <span style={{ fontSize: Math.max(12, Math.floor(size * 0.35)) }}>{initials}</span>
    </div>
  );
};
/* -------------------------------------------------------------------- */

// ---------- MODAL FOR ADD / EDIT AUTHOR ----------
const AuthorModal = ({ isOpen, onClose, onSave, author }) => {
  const [name, setName] = useState(author?.name || '');
  const [bio, setBio] = useState(author?.bio || '');
  const [photo, setPhoto] = useState(author?.photo || '');

  // Sync fields when the selected author or open state changes
  React.useEffect(() => {
    if (isOpen) {
      setName(author?.name || '');
      setBio(author?.bio || '');
      setPhoto(author?.photo || '');
    } else {
      // Clear on close (so "Add Author" starts empty next time)
      setName('');
      setBio('');
      setPhoto('');
    }
  }, [author, isOpen]);

  // AntD Upload: same approach as ProfilePage.jsx
  const beforeUpload = (file) => {
    const isImage = file.type?.startsWith('image/');
    if (!isImage) {
      message.error('Please upload an image file');
      return AntUpload.LIST_IGNORE;
    }
    const isLt2M = file.size / 1024 / 1024 < 2; // 2MB to match server
    if (!isLt2M) {
      message.error('Image must be smaller than 2 MB');
      return AntUpload.LIST_IGNORE;
    }
    return true;
  };

  const customAuthorPhotoUpload = async ({ file, onSuccess, onError }) => {
    try {
      const formData = new FormData();
      formData.append('photo', file);


      // Prefer the current form value; fallback to the existing author's name
      const nameForFile = (name || author?.name || 'author').trim();


      // Call backend directly – mirrors ProfilePage
      const { data } = await axios.post(
        `${config.API_URL}/api/upload-author-photo`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          withCredentials: true,
          // Server reads req.query.name or req.body.name – we’ll use query params:
          params: { name: nameForFile } // <-- this sets req.query.name
        }
      );

      // Server returns { url: "/uploads/authors/filename.ext" }
      if (data?.url) {
        setPhoto(data.url);
        message.success('Author photo updated!');
      } else {
        message.warning('Upload succeeded but no URL returned');
      }
      onSuccess?.(data, file);
    } catch (err) {
      console.error('Author photo upload failed:', err);
      message.error('Failed to upload author photo');
      onError?.(err);
    }
  };

  // Build absolute preview URL for relative uploads
  const previewPhoto =
    photo && (photo.startsWith('/uploads') ? `${config.API_URL}${photo}` : photo);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-2xl rounded-xl p-6 shadow-xl">
        <h2 className="text-2xl font-bold text-purple-800 mb-4">
          {author ? 'Edit Author' : 'Add Author'}
        </h2>

        <div className="grid gap-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              className="w-full border rounded-lg p-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Author name"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium mb-1">Biography</label>
            <textarea
              className="w-full border rounded-lg p-2 min-h-[120px]"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Short biography"
            />
          </div>

          {/* Photo */}
          <div>
            <label className="block text-sm font-medium mb-1">Photo</label>

            {/* Manual URL input still allowed */}
            <div className="flex gap-2 mb-2">
              <input
                className="flex-1 border rounded-lg p-2"
                value={photo}
                onChange={(e) => setPhoto(e.target.value)}
                placeholder="/uploads/authors/photo.jpg"
              />
            </div>

            {/* AntD Upload – same flow as ProfilePage */}
            <AntUpload
              showUploadList={false}
              accept="image/*"
              beforeUpload={beforeUpload}
              customRequest={customAuthorPhotoUpload}
            >
              <button
                type="button"
                className="px-3 py-2 border rounded-lg cursor-pointer text-sm flex items-center gap-2 hover:bg-gray-50"
              >
                <UploadIcon className="w-4 h-4" />
                Upload
              </button>
            </AntUpload>

            {/* Preview image + avatar fallback */}
            <div className="mt-3 flex items-center gap-3">
              {previewPhoto && (
                <img
                  src={previewPhoto}
                  alt="Author"
                  className="h-24 w-24 object-cover rounded-lg border"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              {/* Always render avatar for a consistent identity marker */}
              <Avatar name={name || author?.name || 'Author'} size={96} />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button className="px-4 py-2 rounded-lg border" onClick={onClose}>
            Cancel
          </button>

          <button
            className="px-4 py-2 rounded-lg text-white bg-gradient-to-r from-purple-600 to-pink-600 font-bold"
            onClick={() => onSave({ id: author?.id, name: name.trim(), bio, photo })}
            disabled={!name.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------- MAIN DASHBOARD ----------
const AuthorsDashboard = () => {
  const { data: authors = [], isLoading } = useGetAuthorsQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  const [addAuthor] = useAddAuthorMutation();
  const [updateAuthor] = useUpdateAuthorMutation();
  const [deleteAuthor] = useDeleteAuthorMutation();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const limit = 18;

  const filtered = authors.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const pageItems = filtered.slice((page - 1) * limit, page * limit);

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const onSave = async (data) => {
    if (data.id) await updateAuthor(data).unwrap();
    else await addAuthor(data).unwrap();

    setIsOpen(false);
    setEditing(null);
  };

  if (isLoading) return <div className="p-6 text-center">Loading authors…</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-purple-800">Authors</h1>
            <span className="text-sm text-gray-500">({authors.length} total)</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />

              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search author…"
                className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <button
              onClick={() => {
                setEditing(null);
                setIsOpen(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-bold"
            >
              <Plus className="w-5 h-5" /> Add Author
            </button>
          </div>
        </div>
      </div>

      {/* GRID OF AUTHORS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-6">
        {pageItems.map((a) => {
          const photoUrl = a.photo
            ? (a.photo.startsWith('/uploads') ? `${config.API_URL}${a.photo}` : a.photo)
            : '';

          return (
            <div
              key={a.id}
              className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all p-5 border border-gray-200"
            >
              <div className="flex gap-4">
                {/* Photo or colored avatar */}
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={a.name}
                    className="w-20 h-20 object-cover rounded-lg border"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}

                {!photoUrl && <Avatar name={a.name} size={80} className="shrink-0" />}

                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-lg text-purple-800">{a.name}</h3>

                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditing(a);
                          setIsOpen(true);
                        }}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4 text-blue-600" />
                      </button>

                      <button
                        onClick={() => deleteAuthor(a.id)}
                        className="p-1.5 hover:bg-gray-100 rounded"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mt-1 line-clamp-3 break-all">
                    {a.bio || <span className="italic text-gray-400">No bio</span>}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* PAGINATION */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-10">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-6 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-xl hover:bg-purple-50 disabled:opacity-50 font-bold"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <span className="text-lg font-bold text-purple-800">
            Page {page} of {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-6 py-3 bg-white border-2 border-purple-600 text-purple-600 rounded-xl hover:bg-purple-50 disabled:opacity-50 font-bold"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* MODAL */}
      <AuthorModal
        key={editing?.id ?? 'new'}
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          setEditing(null);
        }}
        onSave={onSave}
        author={editing}
      />
    </div>
  );
};

export default AuthorsDashboard;

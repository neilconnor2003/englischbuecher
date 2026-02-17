// frontend/src/admin/features/book/bookApiSlice.jsx
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import config from '../../../config';

export const bookApi = createApi({
  reducerPath: 'bookApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${config.API_URL}/api`,
    credentials: 'include',
  }),
  tagTypes: ['Books', 'Categories'],
  endpoints: (builder) => ({
    getCategories: builder.query({
      query: () => 'categories',
      providesTags: ['Categories'],
      transformResponse: (response) => {
        const flat = Array.isArray(response) ? response : [];
        const map = {};
        const roots = [];

        flat.forEach(cat => {
          const id = Number(cat.id);
          map[id] = { ...cat, id, children: [] };
        });

        flat.forEach(cat => {
          const id = Number(cat.id);
          const parentId = cat.parent_id === null ? null : Number(cat.parent_id);
          if (parentId === null) {
            roots.push(map[id]);
          } else if (map[parentId]) {
            map[parentId].children.push(map[id]);
          }
        });

        return {
          flat,
          hierarchy: roots,
          visibleRoots: roots.filter(r => r.is_visible == 1),
          all: flat
        };
      }
    }),

    getBooks: builder.query({
      query: () => 'books',
      transformResponse: (response) => (Array.isArray(response) ? response.map(book => ({ ...book, id: book.id })) : []),
      providesTags: ['Books'],
    }),

    getBookByISBN: builder.query({
      query: (isbn) => ({
        url: `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`,
        method: 'GET',
        credentials: 'omit',
      }),
      transformResponse: (response, meta, isbn) => {
        const bookData = response[`ISBN:${isbn}`];
        if (!bookData) return null;
        return {
          title: bookData.title || '',
          authors: bookData.authors?.map(a => a.name) || [],
          publisher: bookData.publishers?.[0]?.name || '',
          description: bookData.notes?.value || bookData.excerpts?.[0]?.text || '',
          cover: bookData.cover || {},
          pages: bookData.number_of_pages || null,
          publish_date: bookData.publish_date || null,
        };
      },
    }),

    getFeaturedBooks: builder.query({
      query: () => 'books/featured',  // ← NO SLASH AT THE BEGINNING
      providesTags: ['Books'],
    }),

    // ADD BOOK — ALL FIELDS
    addBook: builder.mutation({
      query: (newBook) => ({
        url: 'books',
        method: 'POST',
        body: {
          title_en: newBook.title_en || 'Untitled',
          title_de: newBook.title_de || newBook.title_en || 'Unbenannt',
          author: newBook.author || 'Unknown Author',
          isbn: newBook.isbn13 || newBook.isbn10 || null,
          isbn13: newBook.isbn13 || null,
          isbn10: newBook.isbn10 || null,
          price: parseFloat(newBook.price) || null,
          original_price: newBook.original_price ? parseFloat(newBook.original_price) : null,
          stock: parseInt(newBook.stock, 10) || 10,
          category_id: parseInt(newBook.category_id, 10) || 1,
          slug: newBook.slug || newBook.title_en?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'untitled',
          publisher: newBook.publisher || '',
          pages: newBook.pages ? parseInt(newBook.pages, 10) : null,
          publish_date: newBook.publish_date || null,
          description_en: newBook.description_en || '',
          description_de: newBook.description_de || newBook.description_en || '',
          meta_title_en: newBook.meta_title_en || newBook.title_en || '',
          meta_title_de: newBook.meta_title_de || newBook.title_de || '',
          meta_description_en: newBook.meta_description_en || '',
          meta_description_de: newBook.meta_description_de || '',
          image: newBook.image || null,
          images: newBook.images || null,
          dimensions: newBook.dimensions || null,
          format: newBook.format || 'Paperback',
          language: newBook.language || 'EN',
          edition: newBook.edition || null,
          binding: newBook.binding || null,
          translator: newBook.translator || null,
          series_name: newBook.series_name || null,
          series_volume: newBook.series_volume || null,
          reading_age: newBook.reading_age || null,
          tags: newBook.tags || null,

          // NUMBERS — WITH BULLETPROOF PARSING
          sale_price: newBook.sale_price ? parseFloat(newBook.sale_price) : null,
          weight_grams: newBook.weight_grams ? parseInt(newBook.weight_grams) : null,
          rating: parseFloat(newBook.rating) || 0,
          review_count: parseInt(newBook.review_count) || 0,
          popularity_score: parseFloat(newBook.popularity_score) || 0,

          // CHECKBOXES → 1 or 0
          is_featured: newBook.is_featured ? 1 : 0,
          is_new_release: newBook.is_new_release ? 1 : 0,
          is_bestseller: newBook.is_bestseller ? 1 : 0,
        },
      }),
      invalidatesTags: ['Books'],
    }),

    // UPDATE BOOK — FIXED TYPO HERE
    updateBook: builder.mutation({
      query: ({ id, ...updatedBook }) => ({
        url: `books/${id}`,
        method: 'PUT',
        body: {
          title_en: updatedBook.title_en || 'Untitled',
          title_de: updatedBook.title_de || updatedBook.title_en || 'Unbenannt',
          author: updatedBook.author || 'Unknown Author',
          isbn: updatedBook.isbn13 || updatedBook.isbn10 || null,
          isbn13: updatedBook.isbn13 || null,
          isbn10: updatedBook.isbn10 || null,
          price: parseFloat(updatedBook.price) || null,
          original_price: updatedBook.original_price ? parseFloat(updatedBook.original_price) : null, // ← FIXED
          stock: parseInt(updatedBook.stock, 10) || 10,
          category_id: parseInt(updatedBook.category_id, 10) || 1,
          slug: updatedBook.slug || updatedBook.title_en?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'untitled',
          publisher: updatedBook.publisher || '',
          pages: updatedBook.pages ? parseInt(updatedBook.pages, 10) : null,
          publish_date: updatedBook.publish_date || null,
          description_en: updatedBook.description_en || '',
          description_de: updatedBook.description_de || updatedBook.description_en || '',
          meta_title_en: updatedBook.meta_title_en || updatedBook.title_en || '',
          meta_title_de: updatedBook.meta_title_de || updatedBook.title_de || '',
          meta_description_en: updatedBook.meta_description_en || '',
          meta_description_de: updatedBook.meta_description_de || '',
          image: updatedBook.image || null,
          images: updatedBook.images || null,
          dimensions: updatedBook.dimensions || null,
          format: updatedBook.format || 'Paperback',
          language: updatedBook.language || 'EN',
          edition: updatedBook.edition || null,
          binding: updatedBook.binding || null,
          translator: updatedBook.translator || null,
          series_name: updatedBook.series_name || null,
          series_volume: updatedBook.series_volume || null,
          reading_age: updatedBook.reading_age || null,
          tags: updatedBook.tags || null,
          sale_price: updatedBook.sale_price ? parseFloat(updatedBook.sale_price) : null,
          weight_grams: updatedBook.weight_grams ? parseInt(updatedBook.weight_grams) : null,
          rating: parseFloat(updatedBook.rating) || 0,
          review_count: parseInt(updatedBook.review_count) || 0,
          popularity_score: parseFloat(updatedBook.popularity_score) || 0,
          is_featured: updatedBook.is_featured ? 1 : 0,
          is_new_release: updatedBook.is_new_release ? 1 : 0,
          is_bestseller: updatedBook.is_bestseller ? 1 : 0,
        },
      }),
      invalidatesTags: ['Books'],
    }),

    deleteBook: builder.mutation({
      query: (id) => ({
        url: `books/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Books'],
    }),

    addCategory: builder.mutation({
      query: (data) => ({
        url: 'categories',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Categories'],
    }),

    updateCategory: builder.mutation({
      query: ({ id, body }) => ({
        url: `categories/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Categories'],
    }),

    deleteCategory: builder.mutation({
      query: (id) => ({
        url: `categories/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Categories'],
    }),
  }),
});

export const {
  useGetBooksQuery,
  useGetCategoriesQuery,
  useGetBookByISBNQuery,
  useAddBookMutation,
  useUpdateBookMutation,
  useDeleteBookMutation,
  useAddCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useGetFeaturedBooksQuery,
} = bookApi;
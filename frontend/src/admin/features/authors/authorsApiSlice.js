
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import config from '../../../config';

export const authorsApi = createApi({
  reducerPath: 'authorsApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${config.API_URL}/api`,
    credentials: 'include',
  }),
  tagTypes: ['Authors'],
  endpoints: (builder) => ({
    getAuthors: builder.query({
      query: () => `/authors`,
      providesTags: (result) =>
        result?.length
          ? [...result.map((a) => ({ type: 'Authors', id: a.id })), { type: 'Authors', id: 'LIST' }]
          : [{ type: 'Authors', id: 'LIST' }],
    }),

    addAuthor: builder.mutation({
      query: (body) => ({
        url: `/authors`,
        method: 'POST',
        body,
      }),
      invalidatesTags: [{ type: 'Authors', id: 'LIST' }],
    }),

    updateAuthor: builder.mutation({
      query: ({ id, ...patch }) => ({
        url: `/authors/${id}`,
        method: 'PUT',
        body: patch,
      }),
      invalidatesTags: (_, __, { id }) => [
        { type: 'Authors', id },
        { type: 'Authors', id: 'LIST' },
      ],
    }),

    deleteAuthor: builder.mutation({
      query: (id) => ({
        url: `/authors/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Authors', id: 'LIST' }],
    }),

    uploadAuthorPhoto: builder.mutation({
      query: (formData) => ({
        url: `/upload-author-photo`,
        method: 'POST',
        body: formData,
      }),
    }),
  }),
});

export const {
  useGetAuthorsQuery,
  useAddAuthorMutation,
  useUpdateAuthorMutation,
  useDeleteAuthorMutation,
  useUploadAuthorPhotoMutation,
} = authorsApi;

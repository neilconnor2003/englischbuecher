// src/admin/features/about/aboutApiSlice.js
import { apiSlice } from '../../../app/api/apiSlice';

export const aboutApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAbout: builder.query({
      query: () => '/api/about',
      providesTags: ['About'],
    }),
    updateAbout: builder.mutation({
      query: (formData) => ({
        url: '/api/about',
        method: 'PATCH',
        body: formData,
      }),
      invalidatesTags: ['About'],
    }),
  }),
});

export const { useGetAboutQuery, useUpdateAboutMutation } = aboutApiSlice;
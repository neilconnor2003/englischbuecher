// frontend/src/admin/features/contact/contactApiSlice.js
import { apiSlice } from '../../../app/api/apiSlice';

export const contactApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getContact: builder.query({
      query: () => '/api/contact',
      providesTags: ['Contact'],
    }),
    updateContact: builder.mutation({
      query: (formData) => ({
        url: '/api/contact',
        method: 'PATCH',
        body: formData,
      }),
      invalidatesTags: ['Contact'],
    }),
  }),
});

export const { useGetContactQuery, useUpdateContactMutation } = contactApiSlice;
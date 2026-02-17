// frontend/src/admin/features/imprint/imprintApiSlice.js
import { apiSlice } from '../../../app/api/apiSlice';

export const imprintApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getImprint: builder.query({
      query: () => '/api/imprint',
      providesTags: ['Imprint'],
    }),
    updateImprint: builder.mutation({
      query: (data) => ({
        url: '/api/imprint',
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['Imprint'],
    }),
  }),
});

export const { useGetImprintQuery, useUpdateImprintMutation } = imprintApiSlice;
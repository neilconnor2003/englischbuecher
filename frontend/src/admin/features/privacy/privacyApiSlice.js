// frontend/src/admin/features/privacy/privacyApiSlice.js
import { apiSlice } from '../../../app/api/apiSlice';

export const privacyApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPrivacy: builder.query({ query: () => '/api/privacy', providesTags: ['Privacy'] }),
    updatePrivacy: builder.mutation({
      query: (data) => ({ url: '/api/privacy', method: 'PATCH', body: data }),
      invalidatesTags: ['Privacy'],
    }),
  }),
});

export const { useGetPrivacyQuery, useUpdatePrivacyMutation } = privacyApiSlice;
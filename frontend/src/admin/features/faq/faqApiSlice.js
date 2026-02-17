// frontend/src/admin/features/faq/faqApiSlice.js
import { apiSlice } from '../../../app/api/apiSlice';

export const faqApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getFaqs: builder.query({ query: () => '/api/faq', providesTags: ['FAQ'] }),
    getAdminFaqs: builder.query({ query: () => '/api/faq/admin', providesTags: ['FAQ'] }),
    addFaq: builder.mutation({ query: (data) => ({ url: '/api/faq', method: 'POST', body: data }), invalidatesTags: ['FAQ'] }),
    updateFaq: builder.mutation({ query: ({ id, ...data }) => ({ url: `/api/faq/${id}`, method: 'PUT', body: data }), invalidatesTags: ['FAQ'] }),
    deleteFaq: builder.mutation({ query: (id) => ({ url: `/api/faq/${id}`, method: 'DELETE' }), invalidatesTags: ['FAQ'] }),
  }),
});

export const {
  useGetFaqsQuery,
  useGetAdminFaqsQuery,
  useAddFaqMutation,
  useUpdateFaqMutation,
  useDeleteFaqMutation,
} = faqApiSlice;
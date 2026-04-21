// frontend/src/admin/features/order/orderApiSlice.js
import { apiSlice } from '../../../app/api/apiSlice';

export const orderApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getOrders: builder.query({
      query: () => '/api/orders',
      providesTags: ['Order'],
    }),
    addOrder: builder.mutation({
      query: (order) => ({
        url: '/api/orders',
        method: 'POST',
        body: order,
      }),
      invalidatesTags: ['Order'],
    }),
    updateOrder: builder.mutation({
      query: ({ id, ...order }) => ({
        url: `/api/orders/${id}`,
        method: 'PUT',
        body: order,
      }),
      invalidatesTags: ['Order'],
    }),
    deleteOrder: builder.mutation({
      query: (id) => ({
        url: `/api/orders/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Order'],
    }),
    createDpdLabel: builder.mutation({
      query: (orderId) => ({
        url: `${import.meta.env.VITE_API_URL}/api/orders/${orderId}/create-dpd-label`,
        method: 'POST',
      }),
      invalidatesTags: ['Order'],
    }),
  }),
});

export const {
  useGetOrdersQuery,
  useAddOrderMutation,
  useUpdateOrderMutation,
  useDeleteOrderMutation,
  useCreateDpdLabelMutation
} = orderApiSlice;
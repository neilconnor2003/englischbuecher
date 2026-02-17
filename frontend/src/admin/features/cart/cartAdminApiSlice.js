
// frontend/src/features/cart/cartAdminApiSlice.js
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const cartAdminApiSlice = createApi({
  reducerPath: 'cartAdminApi',
  baseQuery: fetchBaseQuery({ baseUrl: 'http://localhost:3001' }),
  tagTypes: ['Cart', 'CartShipping'],
  endpoints: (builder) => ({
    getCarts: builder.query({
      query: () => '/api/admin/cart',
      transformResponse: (res) => res.carts || [],
      providesTags: ['Cart'],
    }),
    getCartDetail: builder.query({
      query: (userId) => `/api/admin/cart/${userId}`,
      providesTags: (result, error, userId) => [{ type: 'Cart', id: userId }],
    }),
    getCartShipping: builder.query({
      // Returns: { amount_eur, provider, service, dims, weight_grams }
      query: (userId) => `/api/admin/cart/${userId}/shipping`,
      keepUnusedDataFor: 30, // align with server-side TTL
      providesTags: (result, error, userId) => [{ type: 'CartShipping', id: userId }],
    }),
  }),
});

export const {
  useGetCartsQuery,
  useGetCartDetailQuery,
  useGetCartShippingQuery
} = cartAdminApiSlice;

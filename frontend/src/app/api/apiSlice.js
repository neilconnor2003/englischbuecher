// frontend/src/app/api/apiSlice.js
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import config from '@config';

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: config.API_URL,
    credentials: 'include',
  }),
  tagTypes: ['User', 'Book', 'Category', 'HeroBanner', 'Order'],
  endpoints: () => ({}),
});
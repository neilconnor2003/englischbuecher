// frontend/src/admin/features/hero/heroBannerApiSlice.js
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import config from '@config';

export const heroBannerApi = createApi({
  reducerPath: 'heroBannerApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${config.API_URL}/api/hero-banner`,
    credentials: 'include',
  }),
  tagTypes: ['HeroBanners'], // plural
  endpoints: (builder) => ({
    // GET all banners (returns array)
    getHeroBanners: builder.query({
      query: () => '',
      providesTags: ['HeroBanners'],
      transformResponse: (response) => {
        // Ensure it's always an array
        return Array.isArray(response) ? response : (response ? [response] : []);
      },
    }),

    // Update all banners + order
    updateHeroBanners: builder.mutation({
      query: (formData) => ({
        url: '/update-all',
        method: 'POST',
        body: formData,
      }),
      invalidatesTags: ['HeroBanners'],
    }),

    // Optional: delete single banner
    deleteHeroBanner: builder.mutation({
      query: (id) => ({
        url: `/delete/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['HeroBanners'],
    }),
  }),
});

// EXPORT THE NEW HOOKS
export const {
  useGetHeroBannersQuery,
  useUpdateHeroBannersMutation,
  useDeleteHeroBannerMutation,
} = heroBannerApi;
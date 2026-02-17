// frontend/src/admin/features/wishlist/wishlistAdminApiSlice.js
import { apiSlice } from '../../../app/api/apiSlice';

export const wishlistAdminApiSlice = apiSlice.injectEndpoints({
  endpoints: builder => ({
    getWishlists: builder.query({
      query: ({ page = 1, limit = 10, search = '' }) => ({
        url: '/admin/wishlist',
        params: { page, limit, search }
      }),
      providesTags: ['Wishlist']
    }),
    removeFromWishlist: builder.mutation({
      query: (id) => ({
        url: `/admin/wishlist/${id}`,
        method: 'DELETE'
      }),
      invalidatesTags: ['Wishlist']
    }),
    restoreWishlistItem: builder.mutation({
      query: (id) => ({
        url: `/admin/wishlist/${id}/restore`,
        method: 'POST'
      }),
      invalidatesTags: ['Wishlist']
    }),
    getWishlistAudit: builder.query({
      query: (id) => `/admin/wishlist/${id}/audit`
    })
  })
});

export const {
  useGetWishlistsQuery,
  useRemoveFromWishlistMutation,
  useRestoreWishlistItemMutation,
  useGetWishlistAuditQuery
} = wishlistAdminApiSlice;
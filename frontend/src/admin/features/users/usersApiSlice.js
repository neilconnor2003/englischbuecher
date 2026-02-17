// frontend/src/admin/features/users/usersApiSlice.js
import { apiSlice } from '../../../app/api/apiSlice';

export const usersApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query({
      query: ({ page = 1, limit = 10, search = '' }) => ({
        url: '/api/admin/users',
        params: { page, limit, search },
      }),
      providesTags: (result) =>
        result?.users
          ? [
            ...result.users.map(({ id }) => ({ type: 'User', id })),
            { type: 'User', id: 'LIST' },
          ]
          : [{ type: 'User', id: 'LIST' }],
      // ENSURE WE ALWAYS RETURN { users: [...] }
      transformResponse: (response) => {
        return {
          users: Array.isArray(response.users) ? response.users : [],
          pagination: response.pagination || { total: 0, page: 1, limit: 10 }
        };
      },
    }),

    // ... rest of your mutations (unchanged)
    createUser: builder.mutation({
      query: (data) => ({
        url: '/api/admin/users',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ dressed: 'User', id: 'LIST' }],
    }),
    updateUser: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/api/admin/users/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'User', id }],
    }),
    deleteUser: builder.mutation({
      query: (id) => ({
        url: `/api/admin/users/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'User', id }],
    }),
    getUserAudit: builder.query({
      query: (id) => `/api/admin/users/${id}/audit`,
      providesTags: (result, error, id) => [{ type: 'UserAudit', id }],
    }),
    getUserProfile: builder.query({
      query: () => '/api/user/profile',
    }),
    updateUserProfile: builder.mutation({
      query: (data) => ({
        url: '/api/user/profile',
        method: 'PUT',
        body: data,
      }),
    }),
    deactivateAccount: builder.mutation({
      query: () => ({
        url: '/api/user/profile',
        method: 'DELETE',
      }),
    }),
    reactivateUser: builder.mutation({
      query: (id) => ({
        url: `/admin/users/${id}/reactivate`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'User', id }, 'User'],
    }),
  }),
});

export const {
  useGetUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useGetUserAuditQuery,
  useGetUserProfileQuery,
  useUpdateUserProfileMutation,
  useDeactivateAccountMutation,
  useReactivateUserMutation,
} = usersApiSlice;
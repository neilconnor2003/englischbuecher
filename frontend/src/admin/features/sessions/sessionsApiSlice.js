// frontend/src/admin/features/sessions/sessionsApiSlice.js
import { apiSlice } from '../../../app/api/apiSlice';

export const sessionsApiSlice = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSessions: builder.query({
      query: ({ page = 1, limit = 10, search = '' }) => ({
        url: '/api/admin/sessions',
        params: { page, limit, search },
      }),
      providesTags: (result) =>
        result?.sessions
          ? [
              ...result.sessions.map(({ session_id }) => ({ type: 'Session', id: session_id })),
              { type: 'Session', id: 'LIST' },
            ]
          : [{ type: 'Session', id: 'LIST' }],
      transformResponse: (response) => ({
        sessions: response.sessions || [],
        total: response.total || 0,
      }),
    }),
    deleteSession: builder.mutation({
      query: (sessionId) => ({
        url: `/api/admin/sessions/${sessionId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, sessionId) => [
        { type: 'Session', id: sessionId },
        { type: 'Session', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetSessionsQuery,
  useDeleteSessionMutation,
} = sessionsApiSlice;
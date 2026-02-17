
// frontend/src/admin/features/bookRequests/bookRequestsApiSlice.js
import { apiSlice } from '../../../app/api/apiSlice';

export const bookRequestsApiSlice = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        getBookRequests: builder.query({
            query: ({ page, limit, search }) => ({
                // ✅ FIX path: must include /api
                url: `/api/admin/book-requests?page=${page}&limit=${limit}&search=${encodeURIComponent(search || '')}`,
            }),
        }),
    }),
    overrideExisting: true, // optional but safe for HMR
});

// ✅ Explicit export of the generated hook:
export const useGetBookRequestsQuery =
    bookRequestsApiSlice.endpoints.getBookRequests.useQuery;

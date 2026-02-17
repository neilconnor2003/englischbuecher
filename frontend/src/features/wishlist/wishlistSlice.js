// src/features/wishlist/wishlistSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import config from '../../config';

// Toggle wishlist (your existing one — perfect)
export const toggleWishlist = createAsyncThunk(
  'wishlist/toggle',
  async (bookId, { rejectWithValue }) => {
    try {
      const response = await axios.post(
        `${config.API_URL}/api/wishlist/toggle`,
        { book_id: bookId },
        { withCredentials: true }
      );
      return { bookId, added: response.data.added };
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

// Fetch full wishlist (used on /wishlist page + after every toggle)
export const fetchWishlist = createAsyncThunk(
  'wishlist/fetch',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${config.API_URL}/api/wishlist`, {
        withCredentials: true,
      });
      return response.data.books; // ← must be full book objects
    } catch (err) {
      return rejectWithValue(err.response?.data || err.message);
    }
  }
);

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState: {
    items: [],        // ← now: [{ id: 5, book: {…} }, …]
    loading: false,
    error: null,
  },
  reducers: {
    setWishlist: (state, action) => {
      state.items = action.payload.map(book => ({ id: book.id, book }));
    },
  },
  extraReducers: (builder) => {
    builder
      // === TOGGLE (optimistic + accurate) ===
      .addCase(toggleWishlist.fulfilled, (state, action) => {
        const { bookId, added } = action.payload;
        if (added) {
          // If we don't have the full book yet, just add ID — fetchWishlist will fix it
          if (!state.items.some(i => i.id === bookId)) {
            state.items.push({ id: bookId, book: null });
          }
        } else {
          state.items = state.items.filter(i => i.id !== bookId);
        }
      })

      // === FETCH FULL WISHLIST (most important) ===
      .addCase(fetchWishlist.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchWishlist.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        // Overwrite with fresh data from server (full books!)
        state.items = action.payload.map(book => ({
          id: book.id,
          book: book,
        }));
      })
      .addCase(fetchWishlist.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to load wishlist';
      });
  },
});

export const { setWishlist } = wishlistSlice.actions;
export default wishlistSlice.reducer;
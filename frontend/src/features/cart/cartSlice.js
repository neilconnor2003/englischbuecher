
// frontend/src/features/cart/cartSlice.js
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

/* -------------------------------------------------
   Helper – make sure every price is a number
   ------------------------------------------------- */
const toNumber = (val) => {
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
};

/* -------------------------------------------------
   Load cart from localStorage (prices may be strings)
   ------------------------------------------------- */
const loadFromStorage = () => {
  const raw = localStorage.getItem('cart');
  if (!raw) return { items: [], totalItems: 0, totalPrice: 0 };

  let items = [];
  try {
    items = JSON.parse(raw);
    items = items.map(i => ({
      ...i,
      price: toNumber(i.price),
      // carry stock through if present
      stock: typeof i.stock === 'number' ? i.stock : i.stock,
    }));
  } catch (e) {
    console.warn('Invalid cart in localStorage – resetting', e);
  }

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.price * i.quantity, 0);
  return { items, totalItems, totalPrice };
};

const initialState = {
  ...loadFromStorage(),
  loading: false,
  merged: false, // runtime-only flag: prevents boot re-merge
};

/* -------------------------------------------------
   Async Thunks – sync with server (fire-and-forget)
   ------------------------------------------------- */
const syncAdd = createAsyncThunk('cart/syncAdd', async (payload, { rejectWithValue }) => {
  try {
    await axios.post(`${import.meta.env.VITE_API_URL}/api/cart/add`, payload, { withCredentials: true });
  } catch (err) {
    console.warn('Cart sync (add) failed', err);
    return rejectWithValue(err);
  }
});

const syncUpdate = createAsyncThunk('cart/syncUpdate', async (payload, { rejectWithValue }) => {
  try {
    await axios.put(`${import.meta.env.VITE_API_URL}/api/cart/update`, payload, { withCredentials: true });
  } catch (err) {
    console.warn('Cart sync (update) failed', err);
    return rejectWithValue(err);
  }
});

const syncRemove = createAsyncThunk('cart/syncRemove', async (bookId, { rejectWithValue }) => {
  try {
    await axios.delete(`${import.meta.env.VITE_API_URL}/api/cart/remove/${bookId}`, { withCredentials: true });
  } catch (err) {
    console.warn('Cart sync (remove) failed', err);
    return rejectWithValue(err);
  }
});

const syncClear = createAsyncThunk('cart/syncClear', async (_, { rejectWithValue }) => {
  try {
    await axios.post(`${import.meta.env.VITE_API_URL}/api/cart/clear`, {}, { withCredentials: true });
  } catch (err) {
    console.warn('Cart sync (clear) failed', err);
    return rejectWithValue(err);
  }
});

/* -------------------------------------------------
   Create Order (after Stripe payment)
   ------------------------------------------------- */
export const createOrder = createAsyncThunk(
  'cart/createOrder',
  async (orderData, { rejectWithValue }) => {
    try {
      // If you set axios.defaults.baseURL = config.API_URL in your app bootstrap,
      // calling relative '/api/orders' is fine. Otherwise, prefix with VITE_API_URL.
      const { data } = await axios.post('/api/orders', orderData, {
        withCredentials: true,
      });

      if (!data?.orderId) {
        throw new Error('No orderId from server');
      }

      return { orderId: data.orderId };
    } catch (err) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Order failed';
      return rejectWithValue(message);
    }
  }
);

/* -------------------------------------------------
   Helper: Save to localStorage
   ------------------------------------------------- */
const saveToLocalStorage = (state) => {
  try {
    localStorage.setItem(
      'cart',
      JSON.stringify(
        state.items.map(i => ({
          bookId: i.bookId,
          quantity: i.quantity,
          price: i.price,
          title_en: i.title_en,
          image: i.image,
          stock: i.stock ?? null,
        }))
      )
    );
  } catch { }
};

/* -------------------------------------------------
   Helper: Update totals
   ------------------------------------------------- */
const updateTotals = (state) => {
  state.totalItems = state.items.reduce((s, i) => s + i.quantity, 0);
  state.totalPrice = state.items.reduce((s, i) => s + i.price * i.quantity, 0);
};

/* -------------------------------------------------
   Slice
   ------------------------------------------------- */
const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {

    setItemStock: (state, action) => {
      const { bookId, stock } = action.payload;
      const item = state.items.find(i => i.bookId === bookId);
      if (item) {
        item.stock = typeof stock === 'number' ? stock : 0; // default 0 if unknown
        //saveToLocalStorage(state);
        if (!state.merged) saveToLocalStorage(state); // ✅ only guest cart persists
      }
    },

    addItem: (state, action) => {
      const { bookId, quantity = 1, book } = action.payload;
      const price = toNumber(book.price);

      // default to Infinity if stock not supplied (but better to pass stock)
      const stock = typeof book.stock === 'number' ? book.stock : Infinity;

      const existing = state.items.find(i => i.bookId === bookId);

      if (existing) {
        const desired = (existing.quantity || 0) + quantity;
        const max = typeof existing.stock === 'number' ? existing.stock : stock;
        existing.quantity = Math.min(desired, max);
        // ensure we keep stock in state
        if (typeof existing.stock !== 'number') existing.stock = stock;
      } else {
        const initialQty = Math.min(quantity, stock);
        state.items.push({ bookId, quantity: initialQty, price, ...book, stock });
      }

      updateTotals(state);
      //saveToLocalStorage(state); // persist after add
      if (!state.merged) saveToLocalStorage(state); // ✅ only guest cart persists
    },

    updateQuantity: (state, action) => {
      const { bookId, quantity } = action.payload;
      const item = state.items.find(i => i.bookId === bookId);
      if (!item) return;

      const maxQty = typeof item.stock === 'number' ? item.stock : quantity;
      const clamped = Math.min(quantity, maxQty);

      item.quantity = clamped;

      if (quantity <= 0 || item.quantity <= 0) {
        state.items = state.items.filter(i => i.bookId !== bookId);
      }

      //saveToLocalStorage(state);
      if (!state.merged) saveToLocalStorage(state); // ✅ only guest cart persists
      updateTotals(state);
    },

    removeItem: (state, action) => {
      const bookId = action.payload;
      state.items = state.items.filter(i => i.bookId !== bookId);
      //saveToLocalStorage(state);
      if (!state.merged) saveToLocalStorage(state); // ✅ only guest cart persists
      updateTotals(state);
    },

    clearCart: (state) => {
      state.items = [];
      localStorage.removeItem('cart');
      state.totalItems = 0;
      state.totalPrice = 0;
    },


    // Explicit refresh/replace after a known server mutation
    replaceWithServerCart: (state, action) => {
      const server = (action.payload.items || []).map(i => ({
        ...i,
        price: toNumber(i.price),
        stock: typeof i.stock === 'number' ? i.stock : i.stock,
      }));
      state.items = server;
      updateTotals(state);
      try { localStorage.removeItem('cart'); } catch { }
      // NOTE: does NOT touch state.merged (so your boot guard still works)
    },


    // Replace local with server once; guard to avoid re-merge; persist
    mergeServerCart: (state, action) => {
      if (state.merged) return; // prevent any re-merge on subsequent renders
      const server = (action.payload.items || []).map(i => ({
        ...i,
        price: toNumber(i.price),
        // include stock from server if available
        stock: typeof i.stock === 'number' ? i.stock : i.stock,
      }));
      state.items = server;     // REPLACE (not additive)
      state.merged = true;
      updateTotals(state);
      //saveToLocalStorage(state); // persist after merge
      try { localStorage.removeItem('cart'); } catch { }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(syncAdd.pending, () => { })
      .addCase(syncAdd.fulfilled, () => { })
      .addCase(syncAdd.rejected, () => { })
      .addCase(syncUpdate.pending, () => { })
      .addCase(syncUpdate.fulfilled, () => { })
      .addCase(syncUpdate.rejected, () => { })
      .addCase(syncRemove.pending, () => { })
      .addCase(syncRemove.fulfilled, () => { })
      .addCase(syncRemove.rejected, () => { })
      .addCase(syncClear.pending, () => { })
      .addCase(syncClear.fulfilled, () => { })
      .addCase(syncClear.rejected, () => { });
    // You can also wire createOrder pending/fulfilled/rejected here if you want to set state.loading
  },
});

/* -------------------------------------------------
   Export actions + thunks
   ------------------------------------------------- */
export const {
  addItem,
  updateQuantity,
  removeItem,
  clearCart,
  mergeServerCart,
  setItemStock,
  replaceWithServerCart,
} = cartSlice.actions;

export {
  syncAdd,
  syncUpdate,
  syncRemove,
  syncClear,
  // NOTE: do NOT re-export createOrder here to avoid "Duplicate export" errors.
};

export default cartSlice.reducer;

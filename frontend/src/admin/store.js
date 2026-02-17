// frontend/src/admin/store.js
import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query'; // <-- add this
import { bookApi } from './features/book/bookApiSlice.js';
import { heroBannerApi } from './features/hero/heroBannerApiSlice.js';
import cartReducer from '../features/cart/cartSlice.js';
import orderReducer from '../features/orders/orderSlice';
import wishlistReducer from '../features/wishlist/wishlistSlice';
import { cartAdminApiSlice } from './features/cart/cartAdminApiSlice.js';
//import { authorsApi } from '../admin/features/authors/authorsApiSlice';
import { authorsApi } from './features/authors/authorsApiSlice.js';

// ADD: RTK Query for Users
import { apiSlice } from '../app/api/apiSlice';

export const store = configureStore({
  reducer: {
    [bookApi.reducerPath]: bookApi.reducer,
    [heroBannerApi.reducerPath]: heroBannerApi.reducer,
    cart: cartReducer,
    wishlist: wishlistReducer,
    [cartAdminApiSlice.reducerPath]: cartAdminApiSlice.reducer,
    [authorsApi.reducerPath]: authorsApi.reducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
    orders: orderReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(bookApi.middleware)
      .concat(heroBannerApi.middleware)
      .concat(cartAdminApiSlice.middleware)
      .concat(authorsApi.middleware)
      .concat(apiSlice.middleware),
  devTools: true,
});


// Optional but recommended (enables refetchOnFocus/refetchOnReconnect)
setupListeners(store.dispatch);

// (Optional) quick debug check:
// console.log('reducers:', Object.keys(store.getState()));

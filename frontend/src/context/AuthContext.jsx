// src/context/AuthContext.js
import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useDispatch, useSelector } from 'react-redux';
import { clearCart, mergeServerCart } from '../features/cart/cartSlice';
import { useTranslation } from 'react-i18next';
import config from '../config';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const { i18n } = useTranslation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const dispatch = useDispatch();
  const cartItems = useSelector(state => state.cart.items || []);

  const checkAuth = async () => {
    try {
      const res = await axios.get(`${config.API_URL}/api/current-user`, {
        withCredentials: true
      });

      const userData = res.data;

      // SET USER WITH GOOGLE PHOTO
      setUser({
        ...userData,
        photoURL: userData.photoURL || userData.googlePhoto || null,
        first_name: userData.first_name || userData.displayName?.split(' ')[0] || '',
        last_name: userData.last_name || userData.displayName?.split(' ').slice(1).join(' ') || '',
        displayName: userData.displayName || `${userData.first_name} ${userData.last_name}`.trim(),
      });

      // LANGUAGE PERSISTENCE
      if (userData.language) {
        i18n.changeLanguage(userData.language);
        localStorage.setItem('i18nextLng', userData.language);
      }

      // MERGE LOCAL CART TO SERVER
      const localCart = JSON.parse(localStorage.getItem('cart') || '[]');
      if (localCart.length > 0) {
        try {
          await axios.post(`${config.API_URL}/api/cart/merge`, { items: localCart }, {
            withCredentials: true
          });
          //console.log('Local cart merged to server');
          localStorage.removeItem('cart');
        } catch (err) {
          console.warn('Cart merge failed:', err.response?.data);
        }
      }

      // LOAD SERVER CART IF REDUX IS EMPTY
      /*if (cartItems.length === 0) {
        try {
          const cartRes = await axios.get(`${config.API_URL}/api/cart`, { withCredentials: true });
          dispatch(mergeServerCart({ items: cartRes.data.items || [] }));
          console.log('Server cart loaded into Redux');
        } catch (err) {
          console.warn('No server cart found');
        }
      }*/

      // ALWAYS load final cart from server after possible merge
      try {
        const cartRes = await axios.get(`${config.API_URL}/api/cart`, { withCredentials: true });
        dispatch(mergeServerCart({ items: cartRes.data.items || [] }));
        //console.log('Final server cart loaded');
      } catch (err) {
        console.warn('No server cart');
      }

    } catch (err) {
      setUser(null);
      // Only warn on non-401 (unauthorized is normal)
      if (err.response?.status !== 401) {
        console.warn('Auth check failed:', err.response?.status);
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await axios.get(`${config.API_URL}/api/logout`, { withCredentials: true });
    } catch (err) {
      console.warn('Logout failed:', err);
    }
    setUser(null);
    localStorage.removeItem('cart');
    window.location.href = '/';
  };

  // UPDATE USER (e.g. after profile edit)
  const updateUser = (updatedData) => {
    setUser(prev => ({ ...prev, ...updatedData }));
  };

  // RUN ONCE ON APP START
  useEffect(() => {
    checkAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      logout,
      loading,
      checkAuth,
      updateUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};
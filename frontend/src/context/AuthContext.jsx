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
  //const [user, setUser] = useState(null);
  const [user, setUser] = useState(undefined); // <-- NOT null
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
      /*if (userData.language) {
        i18n.changeLanguage(userData.language);
        localStorage.setItem('i18nextLng', userData.language);
      }*/


      // LANGUAGE PERSISTENCE (profile default, session override aware)
      const overrideLang = sessionStorage.getItem('lang_override');

      if (overrideLang) {
        // User explicitly chose a language this session → respect it
        i18n.changeLanguage(overrideLang);
        localStorage.setItem('i18nextLng', overrideLang);
      } else if (userData.language) {
        // No override → apply profile language
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

  // Used only by the iOS/Safari redirect-fallback login path. Exchanges
  // a short-lived one-time token (received via the /auth/complete URL)
  // for a real session, via a same-origin-initiated POST — this is the
  // request Safari's ITP will actually trust to set/store the session
  // cookie, unlike a cookie merely attached to a cross-site redirect.
  const exchangeLoginToken = async (token) => {
    try {
      await axios.post(
        `${config.API_URL}/api/auth/exchange-token`,
        { login_token: token },
        { withCredentials: true }
      );
      // Re-run the normal auth check now that the session cookie is set —
      // this populates user state, merges the cart, etc., exactly the
      // same way a normal page load does.
      await checkAuth();
      return true;
    } catch (err) {
      console.warn('Login token exchange failed:', err.response?.data || err.message);
      setUser(null);
      setLoading(false);
      return false;
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
    sessionStorage.removeItem('lang_override');
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
      updateUser,
      exchangeLoginToken
    }}>
      {children}
    </AuthContext.Provider>
  );
};
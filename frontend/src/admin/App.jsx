import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import AdminLayout from './component/AdminLayout';
import Dashboard from './component/Dashboard';
import CategoriesDashboard from './component/CategoriesDashboard';
import OrderItemsDashboard from './component/OrderItemsDashboard';
import OrdersDashboard from './component/OrdersDashboard';
import SessionsDashboard from './component/SessionsDashboard';
import UsersDashboard from './component/UsersDashboard';
import HeroBannerDashboard from './component/HeroBannerDashboard';
import AboutUsDashboard from './component/AboutUsDashboard';
import ContactUsDashboard from './component/ContactUsDashboard';
import ImprintDashboard from './component/ImprintDashboard';
import PrivacyDashboard from './component/PrivacyDashboard';
import FAQDashboard from './component/FAQDashboard';
import WishlistDashboard from './component/WishlistDashboard';
import CartDashboard from './component/CartDashboard';
import BookRequestsDashboard from './component/BookRequestsDashboard';
import AuthorsDashboard from './component/AuthorsDashboard';

function AdminApp() {
  const { user, loading } = useContext(AuthContext);
  //console.log('AdminApp user:', user); // Debug
  if (loading) return <div>Loading...</div>;
  if (!user || user.role !== 'admin') return <Navigate to="/login" />;

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="books" element={<Dashboard />} />
        <Route path="categories" element={<CategoriesDashboard />} />
        <Route path="order_items" element={<OrderItemsDashboard />} />
        <Route path="orders" element={<OrdersDashboard />} />
        <Route path="sessions" element={<SessionsDashboard />} />
        <Route path="users" element={<UsersDashboard />} />
        <Route path="hero-banner" element={<HeroBannerDashboard />} />
        <Route index element={<Navigate to="books" />} />
        <Route path="/footer/about" element={<AboutUsDashboard />} />
        <Route path="footer/contact" element={<ContactUsDashboard />} />
        <Route path="footer/imprint" element={<ImprintDashboard />} />
        <Route path="footer/privacy" element={<PrivacyDashboard />} />
        <Route path="footer/faq" element={<FAQDashboard />} />
        <Route path="wishlist" element={<WishlistDashboard />} />
        <Route path="carts" element={<CartDashboard />} />
        <Route path="book-requests" element={<BookRequestsDashboard />} />
        <Route path="authors" element={<AuthorsDashboard />} />
      </Route>
    </Routes>
  );
}

export default AdminApp;
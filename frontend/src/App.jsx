// frontend/src/App.jsx
import React, { useContext, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import './App.css';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import ScrollToTop from './ScrollToTop';
import { loadStripe } from '@stripe/stripe-js';
import { fetchWishlist } from './features/wishlist/wishlistSlice'; // ← Added

import HeaderBeforeLogin from './components/Header/HeaderBeforeLogin';
import HeaderAfterLogin from './components/Header/HeaderAfterLogin';
import Footer from './components/Footer/Footer';
import Home from './pages/Home/Home';
import BookDetails from './pages/BookDetails/BookDetails';
import RequestBookPage from './pages/RequestBook/RequestBookPage';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import AdminApp from './admin/App';
import CartPage from './pages/Cart/CartPage';
import CheckoutWrapper from './pages/Checkout/CheckoutWrapper';
import OrderSuccessPage from './pages/Checkout/OrderSuccessPage';
import OrderReturn from './pages/Checkout/OrderReturn';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import MyOrdersPage from './pages/MyOrders/MyOrdersPage';
import ProfilePage from './pages/Profile/ProfilePage';
import ResendVerification from './pages/Auth/ResendVerification';
import Wishlist from './pages/Wishlist/Wishlist';

// Footer pages
import Imprint from './pages/FooterPages/imprint';
import Privacy from './pages/FooterPages/privacy';
import Terms from './pages/FooterPages/terms';
import Revocation from './pages/FooterPages/revocation';
import Shipping from './pages/FooterPages/shipping';
import About from './pages/FooterPages/About';
import Contact from './pages/FooterPages/Contact';
import FAQ from './pages/FooterPages/faq';
import Returns from './pages/FooterPages/returns';
import NotFound from './pages/FooterPages/notfound';
import Books from './pages/Books/Books';
import AuthorDetails from './pages/AuthorDetails/AuthorDetails';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// ←←← NEW COMPONENT — THIS FIXES THE HOOK ERROR ←←←
const AppContent = () => {
  const dispatch = useDispatch();
  const { user, loading } = useContext(AuthContext);

  // Load wishlist when user logs in
  useEffect(() => {
    if (user) {
      dispatch(fetchWishlist());
    }
  }, [user, dispatch]);

  return (
    <>
      <ScrollToTop />
      {loading ? (
        <div style={{ padding: '100px 20px', textAlign: 'center' }}>Loading...</div>
      ) : user ? (
        <HeaderAfterLogin />
      ) : (
        <HeaderBeforeLogin />
      )}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/book/:slug/:isbn?/:id?" element={<BookDetails />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutWrapper />} />
        <Route path="/order-success" element={<OrderReturn />} />
        <Route path="/order-success/:orderId" element={<OrderSuccessPage />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/my-orders" element={<MyOrdersPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/resend-verification" element={<ResendVerification />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/books" element={<Books />} />
        <Route path="/request-book" element={<RequestBookPage />} />
        <Route path="/author/:slug" element={<AuthorDetails />} />

        <Route
          path="/admin/*"
          element={user?.role === 'admin' ? <AdminApp /> : <Navigate to="/login" replace />}
        />

        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/imprint" element={<Imprint />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/revocation" element={<Revocation />} />
        <Route path="/shipping" element={<Shipping />} />
        <Route path="*" element={<NotFound />} />
      </Routes>

      <Footer
        className={window.location.pathname.startsWith('/admin') ? 'admin-active' : ''}
      />
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
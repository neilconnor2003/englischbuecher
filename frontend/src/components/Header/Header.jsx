// src/components/Header/Header.jsx
/*import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import LanguageSwitcher from '../LanguageSwitcher';
import CategoryMenu from '../CategoryMenu/CategoryMenu';
import { ShoppingCartOutlined, SearchOutlined, LogOut, User } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import './Header.css';

function Header() {
  const { t } = useTranslation();
  const { user, logout, loading } = useContext(AuthContext);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const navigate = useNavigate();
  const cartCount = useSelector(state => state.cart.totalItems);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Show loading skeleton
  if (loading) {
    return (
      <header className="header">
        <div className="header-container">
          <div className="logo skeleton" style={{ width: 150, height: 40 }}></div>
          <div className="auth-links">
            <div className="skeleton" style={{ width: 100, height: 40 }}></div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="header">
      <div className="header-container">
        // LOGO
        <div className="logo">
          <Link to="/">
            <img src="/assets/logo.png" alt="Bookstore" className="logo-img" />
          </Link>
        </div>

        // SEARCH BAR
        <div className="search-bar">
          <input type="text" placeholder={t('search')} />
          <SearchOutlined className="search-icon" />
        </div>

        // RIGHT NAV
        <nav className="auth-links">
          <CategoryMenu />

          {user ? (
            <>
              <span className="welcome-text">
                {t('header_welcome', { name: user.displayName || user.first_name || 'User' })}
              </span>

              {user.role === 'admin' && (
                <Link to="/admin" className="auth-button">{t('header_admin')}</Link>
              )}

              <button
                className="auth-button logout-btn"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? t('logging_out') : t('header_logout')}
                <LogOut style={{ marginLeft: 6 }} />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="auth-button">{t('login')}</Link>
              <Link to="/register" className="auth-button">{t('register')}</Link>
            </>
          )}

          <LanguageSwitcher />

          <Link to="/cart" className="cart-link">
            <ShoppingCartOutlined />
            {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default Header;*/
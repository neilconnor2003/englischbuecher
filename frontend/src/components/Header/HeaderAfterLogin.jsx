
// src/components/Header/HeaderAfterLogin.js
import React, { useContext, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../context/AuthContext';
import LanguageSwitcher from '../LanguageSwitcher';
import {
  ShoppingCartOutlined,
  SearchOutlined,
  LogoutOutlined,
  HeartOutlined,
  UserOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { AutoComplete, Avatar, Dropdown } from 'antd';
import CategoryMenu from '../CategoryMenu/CategoryMenu';
import axios from 'axios';
import config from '../../config';
import './Header.css';
//import RequestBookTrigger from '../RequestBook/RequestBookTrigger';

function HeaderAfterLogin() {
  const { t } = useTranslation();
  const { user, logout } = useContext(AuthContext);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const cartCount = useSelector(state => state.cart.totalItems);
  const wishlistCount = useSelector(state => state.wishlist?.items?.length || 0);

  const navigate = useNavigate();

  // --- Autocomplete state ---
  const [term, setTerm] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const cancelRef = useRef(null);

  const fetchSuggestions = async (q) => {
    // cancel previous request if still in flight
    if (cancelRef.current) cancelRef.current.cancel('New query');
    cancelRef.current = axios.CancelToken.source();

    setLoading(true);
    try {
      const res = await axios.get(`${config.API_URL}/api/books/listing`, {
        params: { q, sort: 'relevance' },
        cancelToken: cancelRef.current.token
      });

      const list = Array.isArray(res.data) ? res.data.slice(0, 5) : [];
      const opts = list.map(b => {
        const title = b.title_en || b.title_de || '';
        const author = b.author || '';
        const isbn = b.isbn13 || b.isbn10 || '';
        return {
          value: isbn || title || author || q,
          label: (
            <div className="suggest-item">
              <span className="suggest-title">{title}</span>
              {author && <span className="suggest-author"> · {author}</span>}
              {isbn && <span className="suggest-isbn"> · {isbn}</span>}
            </div>
          )
        };
      });
      setOptions(opts);
    } catch (e) {
      if (!axios.isCancel(e)) {
        console.error('header suggestions failed:', e?.message);
        setOptions([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const onSearch = (value) => {
    setTerm(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = value.trim();
    if (!q || q.length < 2) {
      setOptions([]);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(q), 250);
  };

  const doSearch = () => {
    const q = term.trim();
    if (!q) return;
    navigate(`/books?q=${encodeURIComponent(q)}`);
  };

  const onSelect = (val) => {
    navigate(`/books?q=${encodeURIComponent(val)}`);
  };

  // --- Profile avatar + dropdown ---
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try { await logout(); } finally { setIsLoggingOut(false); }
  };

  const initials = (user?.displayName || 'U')
    .split(' ')
    .map(s => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const profileMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: <Link to="/profile">{t('profile')}</Link>
    },
    ...(user?.role === 'admin'
      ? [{
        key: 'admin',
        icon: <SettingOutlined />,
        label: <Link to="/admin">{t('header_admin')}</Link>
      }]
      : []),
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: <span>{isLoggingOut ? t('logging_out') : t('header_logout')}</span>
    }
  ];

  const onProfileMenuClick = ({ key }) => {
    if (key === 'logout') {
      handleLogout();
    }
    // 'profile' and 'admin' use <Link> labels — navigation handled by React Router
  };

  return (
    <header className="header">
      <div className="header-container">
        {/* LOGO */}
        <div className="logo">
          <Link to="/">
            <img src="/assets/logo.png" alt="Bookstore Logo" className="logo-img" />
          </Link>
        </div>

        {/* SEARCH BAR — AutoComplete styled to match existing input */}
        <div className="search-bar">
          <AutoComplete
            value={term}
            options={options}
            onSearch={onSearch}
            onChange={setTerm}
            onSelect={onSelect}
            placeholder={t('search')}
            style={{ width: '100%' }}
            popupMatchSelectWidth={false}
            loading={loading}
            onKeyDown={(e) => { if (e.key === 'Enter') doSearch(); }}
          />
          <SearchOutlined
            className="search-icon"
            onClick={doSearch}
            role="button"
            aria-label={t('search')}
          />
        </div>

        {/* RIGHT NAV */}
        <nav className="auth-links">
          <CategoryMenu />

          <span className="welcome-text">
            {t('header_welcome', { name: user?.displayName || 'User' })}
          </span>

          <LanguageSwitcher />

          <Link to="/request-book" className="request-book-btn">{t('request.button')}</Link>


          {/* WISHLIST LINK */}
          <Link to="/wishlist" className="cart-link" style={{ marginRight: 16 }}>
            <HeartOutlined style={{ color: '#e91e63' }} /> {t('header_wishlist')} ({wishlistCount})
          </Link>

          {/* CART LINK */}
          <Link to="/cart" className="cart-link">
            <ShoppingCartOutlined /> {t('header_cart')} ({cartCount})
          </Link>

          {/* Profile avatar with dropdown (Logout/Admin/Settings) */}
          <Dropdown
            menu={{ items: profileMenuItems, onClick: onProfileMenuClick }}
            placement="bottomRight"
            overlayClassName="profile-dropdown"
          >
            <Avatar
              src={user?.photoURL}
              className="profile-avatar"
              alt="Profile"
              style={{ cursor: 'pointer' }}
            >
              {!user?.photoURL && initials}
            </Avatar>
          </Dropdown>
        </nav>

        {/* Mobile FAB */}
        <Link to="/request-book" className="request-book-fab" aria-label={t('request.button')}>+</Link>

      </div>
    </header>
  );
}

export default HeaderAfterLogin;


// src/components/Header/HeaderBeforeLogin.js
import React, { useContext, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { AuthContext } from '../../context/AuthContext';
import LanguageSwitcher from '../LanguageSwitcher';
import { ShoppingCartOutlined, SearchOutlined } from '@ant-design/icons';
import { AutoComplete } from 'antd';
import CategoryMenu from '../CategoryMenu/CategoryMenu';
import axios from 'axios';
import config from '../../config';
import './Header.css';  // keep same file
//import RequestBookTrigger from '../RequestBook/RequestBookTrigger';

function HeaderBeforeLogin() {
  const { t } = useTranslation();
  const { checkAuth } = useContext(AuthContext);
  const cartCount = useSelector(state => state.cart.totalItems);

  const navigate = useNavigate();
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
          value: isbn || title || author || q,           // value used if selected
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
    // debounce to avoid spamming backend
    debounceRef.current = setTimeout(() => fetchSuggestions(q), 250);
  };

  const doSearch = () => {
    const q = term.trim();
    if (!q) return;
    navigate(`/books?q=${encodeURIComponent(q)}`);
  };

  const onSelect = (val) => {
    // navigate using selected suggestion value (could be title, author, or ISBN)
    navigate(`/books?q=${encodeURIComponent(val)}`);
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

        {/* SEARCH BAR — AutoComplete styled to look like your input */}
        <div className="search-bar">
          <AutoComplete
            value={term}
            options={options}
            onSearch={onSearch}
            onChange={setTerm}
            onSelect={onSelect}
            placeholder={t('search')}
            style={{ width: '100%' }}                    // respect container width
            popupMatchSelectWidth={false}                // dropdown wider than input when needed
            loading={loading}
            // keep Enter-to-search behavior
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
          <Link to="/request-book" className="request-book-btn">{t('request.button')}</Link>
          <Link to="/login" className="auth-button">{t('login')}</Link>
          <Link to="/register" className="auth-button">{t('register')}</Link>
          <LanguageSwitcher />
          <Link to="/cart" className="cart-link">
            <ShoppingCartOutlined />
            {cartCount > 0 && <span className="cart-count">{cartCount}</span>}
          </Link>
        </nav>

        {/* Mobile FAB (fixed), renders on all pages via header mount */}
        <Link to="/request-book" className="request-book-fab" aria-label={t('request.button')}>+</Link>

      </div>
    </header>
  );
}

export default HeaderBeforeLogin;

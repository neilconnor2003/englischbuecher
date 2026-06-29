// frontend/src/pages/FooterPages/notfound.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './notfound.css';

function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="nf-page">
      <div className="nf-card">
        <div className="nf-emoji">📚</div>
        <h1 className="nf-code">404</h1>
        <h2 className="nf-title">{t('notfound.title') || 'Page Not Found'}</h2>
        <p className="nf-desc">
          {t('notfound.description') || "The page you're looking for doesn't exist or has been moved."}
        </p>
        <div className="nf-actions">
          <Link to="/" className="nf-btn-primary">{t('notfound.back_home') || 'Back to Homepage'}</Link>
          <Link to="/books" className="nf-btn-secondary">{t('notfound.browse_books') || 'Browse Books'}</Link>
        </div>
      </div>
    </div>
  );
}

export default NotFound;

// src/pages/NotFound.jsx   (or src/pages/notfound.jsx – filename doesn’t matter as long as import matches)

import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const NotFound = () => {
  const { t } = useTranslation();

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '40px 20px',
      background: '#f8fafc',
      color: '#1e293b'
    }}>
      <h1 style={{ fontSize: '120px', margin: '0', color: '#7c3aed' }}>404</h1>
      <h2 style={{ fontSize: '36px', margin: '20px 0' }}>{t('notfound.title') || 'Page Not Found'}</h2>
      <p style={{ fontSize: '18px', maxWidth: '600px', marginBottom: '40px' }}>
        {t('notfound.text') || 'Sorry, the page you are looking for doesn’t exist.'}
      </p>
      <Link 
        to="/" 
        style={{
          background: '#7c3aed',
          color: 'white',
          padding: '14px 32px',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: '600'
        }}
      >
        {t('notfound.home') || 'Back to Home'}
      </Link>
    </div>
  );
};

export default NotFound;   // THIS LINE IS REQUIRED
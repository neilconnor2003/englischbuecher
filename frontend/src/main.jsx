// frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './i18n/i18n';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './admin/store';  // ← CORRECT
import axios from 'axios';

import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { HelmetProvider } from 'react-helmet-async';
import { HashRouter } from 'react-router-dom';  // 👈 use HashRouter in dev
import * as Sentry from '@sentry/react';

import config from './config';

// ── Sentry error monitoring ──────────────────────────────────
Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || 'https://26d4858b1bdd1cf153635c1bff3522be@o4511659973214208.ingest.de.sentry.io/4511659990253648',
  environment: import.meta.env.MODE,
  enabled: true, // set to import.meta.env.PROD to only track production errors
  tracesSampleRate: 0.1,
});

axios.defaults.baseURL = config.API_URL;
axios.defaults.withCredentials = true;

ReactDOM.createRoot(document.getElementById('root')).render(
  //  <React.StrictMode>
  <Provider store={store}>
    <HelmetProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </Provider>
  //  </React.StrictMode>
);
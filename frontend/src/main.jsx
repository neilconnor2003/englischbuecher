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

import config from './config';

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
// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import './i18n/i18n';
import { Provider } from 'react-redux';
import { store } from './admin/store';
import axios from 'axios';
import config from './config';

// GLOBAL AXIOS CONFIG
axios.defaults.baseURL = config.API_URL;
axios.defaults.withCredentials = true;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  // <React.StrictMode>  ← REMOVE THIS
  <Provider store={store}>
    <App />
  </Provider>
  // </React.StrictMode>
);

reportWebVitals();
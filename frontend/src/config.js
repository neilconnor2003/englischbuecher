// frontend/src/config.js
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:3000';

export default {
  API_URL,
  FRONTEND_URL
};
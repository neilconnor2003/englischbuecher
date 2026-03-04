// frontend/src/config.js
/*const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || 'http://localhost:3000';
const isNetlify = typeof window !== 'undefined' && window.location.hostname.endsWith('netlify.app');
const config = {
  API_URL: isNetlify ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:3001'),
};

export default {
  API_URL,
  FRONTEND_URL,
  config
};*/

const isNetlify =
  typeof window !== 'undefined' &&
  window.location.hostname.endsWith('netlify.app');

// Always points directly to backend (for tools that need it)
const DIRECT_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

// Browser should use Netlify proxy when on netlify.app
// - Netlify: ''  -> calls /api/* and /auth/* on same domain (proxy rules apply)
// - Local/other: backend URL directly
const API_URL = isNetlify ? '' : DIRECT_API_URL;

const FRONTEND_URL =
  import.meta.env.VITE_FRONTEND_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');

export default {
  API_URL,
  DIRECT_API_URL,
  FRONTEND_URL,
  isNetlify
};


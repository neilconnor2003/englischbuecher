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

// Commented for Dev to Dev and Prod to Prod connection
/*const isNetlify =
  typeof window !== 'undefined' &&
  window.location.hostname.endsWith('netlify.app');*/

// Always points directly to backend (for tools that need it)
// Commented for Dev to Dev and Prod to Prod connection
//const DIRECT_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3002';

// Browser should use Netlify proxy when on netlify.app
// - Netlify: ''  -> calls /api/* and /auth/* on same domain (proxy rules apply)
// - Local/other: backend URL directly
// Browser API base (proxy-safe)

// Changed for Dev to Dev and Prod to Prod connection
//const API_URL = isNetlify ? '' : DIRECT_API_URL;
const API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:3002';


// ✅ Uploads / images MUST always come from backend
// Changed for Dev to Dev and Prod to Prod connection
//const UPLOADS_BASE_URL = DIRECT_API_URL;
const UPLOADS_BASE_URL = API_URL;


// Changed for Dev to Dev and Prod to Prod connection
/*const FRONTEND_URL =
  import.meta.env.VITE_FRONTEND_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');*/
const FRONTEND_URL =
  import.meta.env.VITE_FRONTEND_URL ||
  (typeof window !== 'undefined'
    ? window.location.origin
    : 'http://localhost:5173');


export default {
  API_URL,
  //DIRECT_API_URL,
  UPLOADS_BASE_URL,
  FRONTEND_URL,
  //isNetlify
};


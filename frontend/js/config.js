/**
 * EduVision — runtime configuration
 *
 * LOCAL DEV:  Leave API_BASE pointing to localhost. Run the backend with `python start.py`.
 * PRODUCTION: Change API_BASE to your Render backend URL before deploying to Vercel.
 *             e.g.  API_BASE: 'https://eduvision-api.onrender.com/api'
 */
const CONFIG = {
  API_BASE: (function () {
    // If a production backend URL is injected at build/deploy time, use it.
    // Otherwise fall back to localhost for local development.
    const prod = window.__EDUVISION_API_BASE__;
    if (prod && prod !== '__EDUVISION_API_BASE__') return prod;
    return 'http://localhost:8000/api';
  })(),
};

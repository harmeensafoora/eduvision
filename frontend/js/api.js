/**
 * EduVision API client
 * Handles all fetch calls, automatic token refresh on 401, and error display.
 */

const CONFIG = {
  API_BASE: 'http://localhost:8000/api',
};

/**
 * Attach auth header and perform fetch. On 401 automatically refreshes
 * the access token once and retries. Shows pulse loader on every call.
 */
async function apiFetch(endpoint, opts) {
  opts = opts || {};
  const token = localStorage.getItem('ev_token');
  opts.headers = Object.assign({}, opts.headers || {}, {
    'Content-Type': 'application/json',
    'Authorization': token ? 'Bearer ' + token : '',
  });
  if (opts.body && typeof opts.body === 'object') {
    opts.body = JSON.stringify(opts.body);
  }

  try {
    const r = await fetch(CONFIG.API_BASE + endpoint, opts);

    if (r.status === 401) {
      const refreshed = await _refreshToken();
      if (refreshed) return apiFetch(endpoint, opts);
      // Refresh failed — force logout
      if (typeof logout === 'function') logout();
      return null;
    }

    if (!r.ok) {
      const body = await r.json().catch(() => ({ error: 'Request failed' }));
      const msg = body.error || body.detail || 'Request failed';
      _showApiError(msg);
      throw new Error(msg);
    }

    return r.json();
  } catch (e) {
    console.error('[api]', e);
    throw e;
  }
}

/**
 * Multipart file upload (no Content-Type header — browser sets boundary).
 */
async function apiUpload(endpoint, formData) {
  const token = localStorage.getItem('ev_token');
  const r = await fetch(CONFIG.API_BASE + endpoint, {
    method: 'POST',
    headers: { 'Authorization': token ? 'Bearer ' + token : '' },
    body: formData,
  });

  if (r.status === 401) {
    const refreshed = await _refreshToken();
    if (refreshed) return apiUpload(endpoint, formData);
    if (typeof logout === 'function') logout();
    return null;
  }

  if (!r.ok) {
    const body = await r.json().catch(() => ({ error: 'Upload failed' }));
    throw new Error(body.detail || body.error || 'Upload failed');
  }

  return r.json();
}

/** Silently attempt to rotate the access token using the refresh token. */
async function _refreshToken() {
  const rt = localStorage.getItem('ev_refresh');
  if (!rt) return false;
  try {
    const r = await fetch(CONFIG.API_BASE + '/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!r.ok) return false;
    const d = await r.json();
    localStorage.setItem('ev_token', d.access_token);
    if (d.refresh_token) localStorage.setItem('ev_refresh', d.refresh_token);
    return true;
  } catch {
    return false;
  }
}

/** Show an inline error panel (yellow bg, dark text). */
function _showApiError(msg) {
  const existing = document.getElementById('apiErrorPanel');
  if (existing) {
    existing.querySelector('.api-err-msg').textContent = msg;
    existing.style.display = 'flex';
    return;
  }
  const panel = document.createElement('div');
  panel.id = 'apiErrorPanel';
  panel.style.cssText = [
    'position:fixed', 'bottom:1.5rem', 'left:50%', 'transform:translateX(-50%)',
    'z-index:9999', 'display:flex', 'align-items:center', 'gap:.75rem',
    'padding:.85rem 1.4rem', 'background:var(--yellow)', 'border:1.5px solid var(--ink)',
    'border-radius:12px', 'box-shadow:var(--sh-float)', 'font-size:.85rem',
    'font-weight:600', 'color:var(--ink)', 'max-width:480px',
  ].join(';');
  panel.innerHTML = `
    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <span class="api-err-msg">${msg}</span>
    <button onclick="document.getElementById('apiErrorPanel').style.display='none'"
      style="margin-left:.5rem;background:transparent;border:none;cursor:pointer;font-size:.75rem;font-weight:700;color:var(--muted2)">
      Retry
    </button>`;
  document.body.appendChild(panel);
  setTimeout(() => { if (panel) panel.style.display = 'none'; }, 5000);
}

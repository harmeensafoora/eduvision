/**
 * EduVision Auth module
 * Google OAuth + email-based JWT login, onboarding modal, token management.
 */

function checkAuth() {
  const token = localStorage.getItem('ev_token');
  if (token) {
    const u = JSON.parse(localStorage.getItem('ev_user') || 'null');
    if (u) { S.user = u; showApp(); return; }
  }
  showAuthView();
}

function showAuthView() {
  document.getElementById('authView').style.display = 'flex';
  document.getElementById('appShell').style.display = 'none';
}

function showApp() {
  document.getElementById('authView').style.display = 'none';
  document.getElementById('appShell').style.display = 'block';
  if (S.user?.language_pref) S.currentLang = S.user.language_pref;
  renderNavAvatar();
  loadSessions();
  const hash = window.location.hash.replace('#', '') || 'upload';
  navigate(hash);
}

async function googleLogin() {
  showLoader('Signing in with Google…');
  try {
    const probe = await fetch(CONFIG.API_BASE + '/auth/login', { redirect: 'manual' }).catch(() => null);
    if (probe && probe.type === 'opaqueredirect') {
      hideLoader();
      window.location.href = CONFIG.API_BASE + '/auth/login';
      return;
    }
    hideLoader();
    // Google OAuth not configured — focus email login
    document.getElementById('devEmail')?.focus();
  } catch (e) {
    hideLoader();
    document.getElementById('devEmail')?.focus();
  }
}

async function devLogin() {
  const emailEl = document.getElementById('devEmail');
  const nameEl = document.getElementById('devName');
  const errEl = document.getElementById('authError');

  const email = (emailEl?.value || '').trim();
  const name = (nameEl?.value || '').trim() || 'Student';

  if (!email) {
    if (errEl) { errEl.textContent = 'Please enter your email.'; errEl.style.display = 'block'; }
    return;
  }
  if (errEl) errEl.style.display = 'none';

  showLoader('Signing in…');
  try {
    const r = await fetch(CONFIG.API_BASE + '/auth/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      throw new Error(body.detail || 'Auth failed');
    }
    const d = await r.json();
    localStorage.setItem('ev_token', d.access_token);
    localStorage.setItem('ev_refresh', d.refresh_token);
    localStorage.setItem('ev_user', JSON.stringify(d.user));
    localStorage.setItem('ev_saved_name', name);
    localStorage.setItem('ev_saved_email', email);
    S.user = d.user;
    hideLoader();
    const isFirst = !localStorage.getItem('ev_onboarded');
    showApp();
    if (isFirst) showOnboarding();
  } catch (e) {
    hideLoader();
    if (errEl) { errEl.textContent = e.message || 'Sign in failed. Try again.'; errEl.style.display = 'block'; }
  }
}

async function logout() {
  const token = localStorage.getItem('ev_token');
  // Clear tokens FIRST so apiFetch 401-handler doesn't recurse back into logout
  localStorage.removeItem('ev_token');
  localStorage.removeItem('ev_refresh');
  localStorage.removeItem('ev_user');
  localStorage.removeItem('ev_onboarded');
  S.user = null; S.session = null; S.topics = [];
  showAuthView();
  // Fire-and-forget server-side logout (no retry, no auth loop)
  if (token) {
    fetch(CONFIG.API_BASE + '/auth/logout', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    }).catch(() => {});
  }
}

function renderNavAvatar() {
  const wrap = document.getElementById('navAvatar');
  if (!S.user) return;
  if (S.user.avatar_url) {
    wrap.innerHTML = '<img class="user-avatar" src="' + S.user.avatar_url + '" alt="' + S.user.name + '" onerror="this.style.display=\'none\'">';
  } else {
    wrap.innerHTML = '<div class="user-avatar-placeholder">' + S.user.name[0] + '</div>';
  }
  document.getElementById('udName').textContent = S.user.name;
  document.getElementById('udEmail').textContent = S.user.email;
}

function toggleDropdown() {
  const d = document.getElementById('userDropdown');
  d.style.display = d.style.display === 'none' ? 'block' : 'none';
}
function closeDropdown() { document.getElementById('userDropdown').style.display = 'none'; }

// ── Onboarding ──────────────────────────────────────────────────────────────
let _obStep = 1;

function showOnboarding() { const m = document.getElementById('onboardingModal'); if (m) m.style.display = 'flex'; }
function skipOnboarding() { const m = document.getElementById('onboardingModal'); if (m) m.style.display = 'none'; localStorage.setItem('ev_onboarded','1'); }

function obNext() {
  if (_obStep < 3) {
    document.getElementById('obStep' + _obStep).classList.remove('active');
    _obStep++;
    document.getElementById('obStep' + _obStep).classList.add('active');
    document.getElementById('obBack').style.display = 'block';
    _updateObProgress();
    if (_obStep === 3) document.getElementById('obNext').textContent = 'Finish';
  } else { finishOnboarding(); }
}

function obPrev() {
  if (_obStep > 1) {
    document.getElementById('obStep' + _obStep).classList.remove('active');
    _obStep--;
    document.getElementById('obStep' + _obStep).classList.add('active');
    if (_obStep === 1) document.getElementById('obBack').style.display = 'none';
    document.getElementById('obNext').textContent = 'Next →';
    _updateObProgress();
  }
}

function _updateObProgress() {
  document.querySelectorAll('.ob-prog-dot').forEach((d, i) => d.classList.toggle('done', i < _obStep));
}

async function finishOnboarding() {
  const types = Array.from(document.querySelectorAll('.learner-tag-opt.sel')).map(t => t.dataset.v);
  const lang = document.getElementById('langPref').value;
  const depth = document.querySelector('.depth-card.sel')?.dataset?.v || 'solid';
  if (S.user) { S.user.learner_types = types; S.user.depth_pref = depth; S.user.language_pref = lang; }
  S.currentLang = lang;
  localStorage.setItem('ev_user', JSON.stringify(S.user));
  localStorage.setItem('ev_onboarded', '1');
  skipOnboarding();
  try {
    await apiFetch('/user/profile', { method: 'POST', body: { learner_types: types, depth_pref: depth, language_pref: lang } });
  } catch(_) {}
}

function selectDepthCard(el) {
  document.querySelectorAll('.depth-card').forEach(c => c.classList.remove('sel'));
  el.classList.add('sel');
}

// ── Profile modal ──────────────────────────────────────────────────────────────

function openProfileModal() {
  closeDropdown();
  const modal = document.getElementById('profileModal');
  if (!modal) return;
  modal.style.display = 'flex';

  // Populate from current user
  const nameInput = document.getElementById('profileName');
  if (nameInput) nameInput.value = S.user?.name || '';

  // Learner types
  document.querySelectorAll('#profileLearnerTypes .q-chip').forEach(chip => {
    chip.classList.toggle('sel', (S.user?.learner_types || []).includes(chip.dataset.v));
  });

  // Depth
  document.querySelectorAll('.depth-card').forEach(c => {
    c.classList.toggle('sel', c.dataset.v === (S.user?.depth_pref || 'solid'));
  });

  // Language
  const lang = document.getElementById('profileLang');
  if (lang) lang.value = S.user?.language_pref || 'en';

  document.getElementById('profileError').style.display = 'none';
}

function closeProfileModal() {
  document.getElementById('profileModal').style.display = 'none';
}

async function saveProfile() {
  const name = document.getElementById('profileName')?.value?.trim();
  const types = Array.from(document.querySelectorAll('#profileLearnerTypes .q-chip.sel')).map(c => c.dataset.v);
  const depth = document.querySelector('.depth-card.sel')?.dataset?.v || 'solid';
  const lang = document.getElementById('profileLang')?.value || 'en';

  const errEl = document.getElementById('profileError');
  try {
    await apiFetch('/user/profile', {
      method: 'POST',
      body: {
        learner_types: types.length ? types : undefined,
        depth_pref: depth,
        language_pref: lang,
        name: name || undefined,
      }
    });

    // Update local state
    if (S.user) {
      if (name) S.user.name = name;
      S.user.learner_types = types;
      S.user.depth_pref = depth;
      S.user.language_pref = lang;
    }
    localStorage.setItem('ev_user', JSON.stringify(S.user));
    renderNavAvatar();
    closeProfileModal();
    toast('Profile saved!', 'success', 3000);

    // Re-apply learner modes
    if (typeof applyAllLearnerModes === 'function') applyAllLearnerModes(types);
  } catch (e) {
    if (errEl) {
      errEl.textContent = e.message || 'Failed to save profile.';
      errEl.style.display = 'block';
    }
  }
}

// ── Export user data ─────────────────────────────────────────────────────────

async function exportUserData() {
  closeDropdown();
  const token = localStorage.getItem('ev_token');
  if (!token) {
    alert('You must be signed in to export data.');
    return;
  }
  try {
    const r = await fetch(CONFIG.API_BASE + '/user/export', {
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (!r.ok) throw new Error('Export failed');
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eduvision_export.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('Failed to export data: ' + e.message);
  }
}

// ── Delete account ────────────────────────────────────────────────────────────

function confirmDeleteAccount() {
  closeDropdown();
  document.getElementById('deleteModal').style.display = 'flex';
  document.getElementById('deleteError').style.display = 'none';
}

function closeDeleteModal() {
  document.getElementById('deleteModal').style.display = 'none';
}

async function deleteAccount() {
  try {
    await apiFetch('/user/me', { method: 'DELETE' });
    // Clear everything
    localStorage.clear();
    S.user = null;
    S.session = null;
    S.topics = [];
    closeDeleteModal();
    showAuthView();
  } catch (e) {
    const errEl = document.getElementById('deleteError');
    if (errEl) {
      errEl.textContent = e.message || 'Failed to delete account.';
      errEl.style.display = 'block';
    }
  }
}

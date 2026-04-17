/**
 * EduVision Auth module
 * Google OAuth + dev-login fallback, onboarding modal, token management.
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
  renderNavAvatar();
  loadSessions();
  const hash = window.location.hash.replace('#', '') || 'upload';
  navigate(hash);
}

async function googleLogin() {
  showLoader('Signing in…');
  try {
    const probe = await fetch(CONFIG.API_BASE + '/auth/login', { redirect: 'manual' }).catch(() => null);
    if (probe && probe.type === 'opaqueredirect') {
      hideLoader();
      window.location.href = CONFIG.API_BASE + '/auth/login';
      return;
    }
    const name = localStorage.getItem('ev_saved_name') || 'Student';
    const email = localStorage.getItem('ev_saved_email') || 'student@eduvision.app';
    const r = await fetch(CONFIG.API_BASE + '/auth/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
    if (!r.ok) throw new Error('Auth failed');
    const d = await r.json();
    localStorage.setItem('ev_token', d.access_token);
    localStorage.setItem('ev_refresh', d.refresh_token);
    localStorage.setItem('ev_user', JSON.stringify(d.user));
    S.user = d.user;
    hideLoader();
    const isFirst = !localStorage.getItem('ev_onboarded');
    showApp();
    if (isFirst) showOnboarding();
  } catch (e) {
    hideLoader();
    demoLogin();
  }
}

function demoLogin() {
  const mockUser = { id:'demo', name:'Demo User', email:'demo@eduvision.app', avatar_url:'', learner_types:['visual'], depth_pref:'solid', streak_count:3 };
  localStorage.setItem('ev_token', 'demo_token');
  localStorage.setItem('ev_user', JSON.stringify(mockUser));
  S.user = mockUser;
  loadDemoData();
  showApp();
}

async function logout() {
  try { await apiFetch('/auth/logout', { method: 'POST' }); } catch(_) {}
  localStorage.removeItem('ev_token');
  localStorage.removeItem('ev_refresh');
  localStorage.removeItem('ev_user');
  localStorage.removeItem('ev_onboarded');
  S.user = null; S.session = null; S.topics = [];
  showAuthView();
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

function showOnboarding() { document.getElementById('onboardingModal').style.display = 'flex'; }
function skipOnboarding() { document.getElementById('onboardingModal').style.display = 'none'; localStorage.setItem('ev_onboarded','1'); }

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

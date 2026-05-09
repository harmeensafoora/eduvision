/**
 * EduVision SPA — global state, routing, loader, shared helpers.
 */

// ── Global state ─────────────────────────────────────────────────────────────
const S = {
  user: null,
  currentView: null,
  session: null,
  topics: [],
  activeTopic: null,
  currentDepth: 'quick',
  currentLang: 'en',
  roadmapDepth: 'solid',
  quizSetup: { types: ['mcq'], diff: 'intermediate', count: 10, lang: 'en', topicId: null },
  quizQuestions: [],
  quizAnswers: [],
  rawAnswers: [],
  quizIdx: 0,
  quizId: null,
  matchState: { selected: null, matched: new Set(), pairs: [] },
  files: [],
  sessions: [],
  badges: [],
  roadmapNodes: [],
  dashData: null,
  sessionPdfs: [],
};

// ── Loader ───────────────────────────────────────────────────────────────────
function showLoader(msg, steps) {
  const overlay = document.getElementById('globalLoader');
  overlay.style.display = 'flex';
  document.getElementById('loaderMsg').textContent = msg || 'Loading…';
  const sc = document.getElementById('loaderSteps');
  sc.innerHTML = '';
  if (steps) {
    steps.forEach((s, i) => {
      const d = document.createElement('div');
      d.className = 'ev-loader-step';
      d.innerHTML = '<div class="ev-step-dot"></div>' + s;
      d.style.animationDelay = (i * 0.6) + 's';
      sc.appendChild(d);
      setTimeout(() => d.classList.add('show'), 100 + i * 600);
    });
  }
}
function hideLoader() { document.getElementById('globalLoader').style.display = 'none'; }

// ── Toast notifications ───────────────────────────────────────────────────────
var _TOAST_ICONS = {
  success: '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#16a34a" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" stroke-linejoin="round" d="M8 12l3 3 5-5"/></svg>',
  error:   '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#dc2626" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M15 9l-6 6M9 9l6 6"/></svg>',
  info:    '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#1d4ed8" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M12 8v4m0 4h.01"/></svg>',
  warning: '<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#92400e" stroke-width="2.5"><path stroke-linecap="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>',
};
function toast(msg, type, duration) {
  type = type || 'info';
  duration = duration || 4000;
  var container = document.getElementById('toastContainer');
  if (!container) return;
  var t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.innerHTML =
    '<div class="toast-icon">' + (_TOAST_ICONS[type] || _TOAST_ICONS.info) + '</div>' +
    '<div class="toast-body"><div class="toast-msg">' + msg + '</div></div>' +
    '<button class="toast-close" onclick="this.closest(\'.toast\').remove()">&#x2715;</button>' +
    '<div class="toast-progress" style="animation-duration:' + duration + 'ms"></div>';
  container.appendChild(t);
  setTimeout(function() {
    t.classList.add('closing');
    setTimeout(function() { if (t.parentNode) t.parentNode.removeChild(t); }, 280);
  }, duration);
}

// ── Inline error helper ───────────────────────────────────────────────────────
function showError(id, msg) {
  // Always fire a toast so the message is visible regardless of scroll position
  toast(msg, 'error');
  // Also update the inline element if present (keeps existing error anchors working)
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  el.style.display = 'flex';
  setTimeout(function() { el.classList.remove('show'); el.style.display = 'none'; }, 4000);
}

// ── Learner Profile ───────────────────────────────────────────────────────────────
function applyLearnerProfile(types) {
  document.body.classList.remove('profile-dyslexic', 'profile-autistic', 'profile-visual', 'profile-verbal');
  if (!types || !types.length) return;
  types.forEach(function(t) {
    if (t === 'dyslexia') document.body.classList.add('profile-dyslexic');
    if (t === 'autism' || t === 'autistic-friendly') document.body.classList.add('profile-autistic');
    if (t === 'visual') document.body.classList.add('profile-visual');
    if (t === 'verbal' || t === 'auditory') document.body.classList.add('profile-verbal');
  });
}

// ── TTS (Text-to-Speech) ────────────────────────────────────────────────────
var TTS = { speaking: false, synth: null };
function initTTS() {
  if (typeof window.speechSynthesis === 'undefined') return false;
  TTS.synth = window.speechSynthesis;
  return true;
}
function speakText(text, lang) {
  if (!TTS.synth && !initTTS()) return;
  TTS.synth.cancel();
  var utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang || 'en-US';
  utter.rate = 0.9;
  TTS.synth.speak(utter);
}
function stopSpeaking() {
  if (TTS.synth) TTS.synth.cancel();
}

// ── SVG helper ────────────────────────────────────────────────────────────────
function svgIcon(path, size) {
  size = size || 18;
  return '<svg width="' + size + '" height="' + size + '" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">' + path + '</svg>';
}

// ── No-session empty states ───────────────────────────────────────────────────
var _NO_SESSION_INFO = {
  summary:   { title: 'No study materials yet',   desc: 'Upload a PDF to see AI-generated summaries of each topic.', icon: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>' },
  roadmap:   { title: 'No roadmap yet',            desc: 'Upload a PDF to get a personalised learning path.', icon: '<path d="M3 12h18M12 3l9 9-9 9"/>' },
  quiz:      { title: 'Nothing to quiz on yet',    desc: 'Upload a PDF to generate questions from your materials.', icon: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3m0 4h.01"/>' },
  dashboard: { title: 'No progress tracked yet',  desc: 'Take some quizzes to start seeing your mastery stats.', icon: '<path d="M3 17l4-8 4 4 4-6 4 10"/>' },
};

function _renderNoSessionState(view) {
  var el = document.getElementById('view-' + view);
  if (!el) return;
  var wrap = el.querySelector('.no-session-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'no-session-wrap';
    el.prepend(wrap);
  }
  var m = _NO_SESSION_INFO[view] || { title: 'Nothing here yet', desc: 'Upload a PDF to get started.', icon: '<rect x="4" y="2" width="16" height="20" rx="2"/>' };
  wrap.innerHTML =
    '<div class="no-session-state">' +
      '<div class="no-session-icon">' +
        '<svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#1c1917" stroke-width="1.6">' + m.icon + '</svg>' +
      '</div>' +
      '<div class="no-session-title">' + m.title + '</div>' +
      '<div class="no-session-desc">' + m.desc + '</div>' +
      '<button class="btn btn-dark btn-lg" onclick="navigate(\'upload\')">Upload a PDF &rarr;</button>' +
    '</div>';
  wrap.style.display = 'flex';
}

function _clearNoSessionState(view) {
  var el = document.getElementById('view-' + view);
  if (!el) return;
  var wrap = el.querySelector('.no-session-wrap');
  if (wrap) wrap.style.display = 'none';
}

// ── Routing ───────────────────────────────────────────────────────────────────
var _SESSION_VIEWS = ['summary', 'roadmap', 'quiz', 'dashboard'];

function navigate(view) {
  closeDropdown();
  // Fade out
  const canvas = document.querySelector('.canvas');
  canvas.style.transition = 'opacity .25s';
  canvas.style.opacity = '0';

  setTimeout(() => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(a => a.classList.remove('active'));

    const el = document.getElementById('view-' + view);
    if (el) el.classList.add('active');
    document.querySelectorAll('.nav-link[data-view="' + view + '"]').forEach(a => a.classList.add('active'));

    S.currentView = view;
    window.location.hash = view;

    // Fade in
    canvas.style.opacity = '1';

    // Guard: views that need a loaded session
    if (_SESSION_VIEWS.includes(view) && !S.session) {
      _renderNoSessionState(view);
      return;
    }
    if (_SESSION_VIEWS.includes(view)) _clearNoSessionState(view);

    if (view === 'summary') {
      if (S.topics.length) {
        renderTopicSidebar();
        if (!S.activeTopic) selectTopic(S.topics[0].id);
        else loadSummary();
      }
    }
    if (view === 'roadmap') renderRoadmap();
    if (view === 'dashboard') renderDashboard();
    if (view === 'quiz') setupQuizView();
    if (view === 'mindscape') renderMindscape();
  }, 250);
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();

  window.addEventListener('hashchange', () => {
    if (S.user) {
      const v = window.location.hash.replace('#', '') || 'upload';
      if (['upload','summary','roadmap','quiz','dashboard','mindscape'].includes(v)) navigate(v);
    }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#navAvatar') && !e.target.closest('#userDropdown')) closeDropdown();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeDropdown();
  });

  document.querySelectorAll('.learner-tag-opt').forEach(t =>
    t.addEventListener('click', function() { this.classList.toggle('sel'); })
  );
});

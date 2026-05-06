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

// ── Inline error helper ───────────────────────────────────────────────────────
function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  el.style.display = 'flex';
  setTimeout(() => { el.classList.remove('show'); el.style.display = 'none'; }, 4000);
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

// ── Routing ───────────────────────────────────────────────────────────────────
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

  document.querySelectorAll('.learner-tag-opt').forEach(t =>
    t.addEventListener('click', function() { this.classList.toggle('sel'); })
  );
});

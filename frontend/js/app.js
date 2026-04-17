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
  currentDepth: 'structured',
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

    if (view === 'summary' && S.topics.length) renderTopicSidebar();
    if (view === 'roadmap') renderRoadmap();
    if (view === 'dashboard') renderDashboard();
    if (view === 'quiz') setupQuizView();
  }, 250);
}

// ── Demo data ─────────────────────────────────────────────────────────────────
function loadDemoData() {
  S.topics = [
    { id:'t1', name:'Enzyme Kinetics', coverage:94, bestPdf:'Harper\'s Ch.8' },
    { id:'t2', name:'Signal Transduction', coverage:78, bestPdf:'Stryer Ch.12' },
    { id:'t3', name:'Metabolic Pathways', coverage:85, bestPdf:'Harper\'s Ch.14' },
    { id:'t4', name:'DNA Replication', coverage:72, bestPdf:'Stryer Ch.25' },
    { id:'t5', name:'Protein Synthesis', coverage:68, bestPdf:'Lehninger Ch.27' },
  ];
  S.session = { id:'s1', title:'Biochemistry Study', pdfCount:3 };
  S.sessions = [{ id:'s1', title:'Biochemistry Study', pdfCount:3, date:'Today' }];
  renderTopicSidebar();
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();

  window.addEventListener('hashchange', () => {
    if (S.user) {
      const v = window.location.hash.replace('#', '') || 'upload';
      if (['upload','summary','roadmap','quiz','dashboard'].includes(v)) navigate(v);
    }
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#navAvatar') && !e.target.closest('#userDropdown')) closeDropdown();
  });

  document.querySelectorAll('.learner-tag-opt').forEach(t =>
    t.addEventListener('click', function() { this.classList.toggle('sel'); })
  );
});

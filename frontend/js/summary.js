/** Summary view */

const _RTL = new Set(['ar','he','ur','fa']);

// ── Shared UI helpers ─────────────────────────────────────────────────────────

function _showSummaryContent() {
  const emptyEl = document.getElementById('summaryEmpty');
  const contentEl = document.getElementById('summaryContent');
  if (emptyEl) emptyEl.style.display = 'none';
  if (contentEl) contentEl.style.display = 'block';
}

function _syncDepthTabs() {
  document.querySelectorAll('#depthTabs .depth-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.depth === S.currentDepth);
  });
}

function _syncLangSelect() {
  const sel = document.getElementById('langSelect');
  if (sel) sel.value = S.currentLang;
}

// Keep loadSummary as the entrypoint called by app.js navigate()
function loadSummary() {
  const topic = S.topics.find(t => t.id === S.activeTopic);
  if (!topic) return;
  _showSummaryContent();
  _syncDepthTabs();
  _syncLangSelect();
  renderSummaryBody(topic);
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function renderTopicSidebar() {
  const list = document.getElementById('topicList');
  if (!list) return;
  if (!S.topics.length) {
    list.innerHTML = '<div style="padding:1rem;font-size:.82rem;color:var(--muted2)">No topics yet.</div>';
    return;
  }
  list.innerHTML = S.topics.map(t =>
    '<div class="topic-item' + (S.activeTopic === t.id ? ' active' : '') +
    '" onclick="selectTopic(\'' + t.id + '\')">' +
    '<div class="topic-name">' + t.name + '</div>' +
    '<div class="topic-bar"><div class="topic-bar-fill" style="width:' + t.coverage + '%"></div></div>' +
    '<div style="font-size:.7rem;color:var(--muted2);margin-top:.1rem">' + t.coverage + '% coverage</div>' +
    '</div>'
  ).join('');
}

function selectTopic(id) {
  S.activeTopic = id;
  renderTopicSidebar();
  renderDocPanel();
  _showSummaryContent();
  _syncDepthTabs();
  _syncLangSelect();
  const topic = S.topics.find(t => t.id === id);
  if (topic) renderSummaryBody(topic);
}

// ── Controls ──────────────────────────────────────────────────────────────────

function switchDepth(d, el) {
  S.currentDepth = d;
  document.querySelectorAll('#depthTabs .depth-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const topic = S.topics.find(t => t.id === S.activeTopic);
  if (topic) renderSummaryBody(topic);
}

function switchLang(code) {
  if (!code) return;
  S.currentLang = code;
  const body = document.getElementById('summaryBody');
  if (body) body.style.direction = _RTL.has(code) ? 'rtl' : 'ltr';
  const topic = S.topics.find(t => t.id === S.activeTopic);
  if (topic) renderSummaryBody(topic);
}

// ── Render ────────────────────────────────────────────────────────────────────

function _buildSummaryHtml(data, topic) {
  const content = data.content || { headline: topic.name, sections: [] };
  let html = '<h2 class="summary-headline">' + (content.headline || topic.name) + '</h2>';
  (content.sections || []).forEach(s => {
    let text = (s.content || s.text || '');
    (s.keywords || []).forEach(kw => {
      text = text.replace(new RegExp('\\b' + kw + '\\b', 'gi'), '<span class="kw">$&</span>');
    });
    text = text.replace(/\b([A-Z]{2,})\b/g, '<span class="acronym">$1</span>');
    html += '<div class="summary-section">' +
      '<div class="summary-section-title">' + (s.title || '') + '</div>' +
      '<div class="summary-text">' + text + '</div>' +
      '</div>';
  });
  if (data.keywords && data.keywords.length) {
    html += '<div class="summary-section">' +
      '<div class="summary-section-title">Key Terms</div>' +
      '<div class="summary-keywords">' +
      data.keywords.map(k => '<span class="kw">' + k + '</span>').join('') +
      '</div></div>';
  }
  return html;
}

async function renderSummaryBody(topic) {
  if (!S.session) return;
  const body = document.getElementById('summaryBody');
  if (!body) return;
  const cta = document.getElementById('summaryQuizCta');
  if (cta) cta.style.visibility = 'hidden';
  body.innerHTML = '<div class="summary-loading"><div class="ev-loader" style="font-size:1.4rem">ev.</div></div>';
  try {
    const data = await apiFetch(
      '/summary/' + S.session.id + '/' + topic.id +
      '?depth=' + S.currentDepth + '&lang=' + S.currentLang
    );
    if (!data) return;
    body.innerHTML = _buildSummaryHtml(data, topic);
    body.style.direction = _RTL.has(S.currentLang) ? 'rtl' : 'ltr';
    body.style.animation = 'none';
    requestAnimationFrame(() => { body.style.animation = 'fadeSlide .35s ease both'; });
    if (cta) cta.style.visibility = 'visible';
  } catch (e) {
    console.error('[summary] load failed:', e);
    body.innerHTML = '<div class="summary-error">' + (e.message || 'Could not load summary.') + '</div>';
    if (cta) cta.style.visibility = 'visible';
  }
}

// ── Doc panel ─────────────────────────────────────────────────────────────────

function renderDocPanel() {
  const pdfs = S.sessionPdfs || [];
  const list = document.getElementById('docPanelList');
  if (!list) return;
  const ins = document.getElementById('evInsight');

  if (!pdfs.length) {
    list.innerHTML = '<div class="doc-empty">No PDFs uploaded yet.</div>';
    if (ins) ins.style.display = 'none';
    return;
  }

  const topic = S.topics.find(t => t.id === S.activeTopic);
  const coverageByPdf = topic?.coverage_by_pdf || {};
  const sorted = [...pdfs].sort((a, b) => (coverageByPdf[b.id] || 0) - (coverageByPdf[a.id] || 0));

  list.innerHTML = sorted.map((p, i) => {
    const cov = Math.round(coverageByPdf[p.id] ?? Math.max(0, (topic?.coverage || 0) - i * 12));
    const tier = cov >= 70 ? 'high' : cov >= 35 ? 'mid' : 'low';
    const tierLabel = tier === 'high' ? 'Primary' : tier === 'mid' ? 'Supporting' : 'Minor';
    return '<div class="src-row src-' + tier + '">' +
      '<div class="src-icon">' +
        '<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 11h5"/></svg>' +
      '</div>' +
      '<div class="src-info">' +
        '<div class="src-name" title="' + _escHtml(p.filename) + '">' + _escHtml(_truncateName(p.filename, 30)) + '</div>' +
        '<div class="src-meta">' + (p.page_count || '?') + ' pages &middot; ' + cov + '% match</div>' +
        '<div class="src-bar"><div class="src-bar-fill" style="width:' + cov + '%"></div></div>' +
      '</div>' +
      '<span class="src-tier src-tier-' + tier + '">' + tierLabel + '</span>' +
    '</div>';
  }).join('');

  if (ins && sorted.length && topic) {
    const topCov = Math.round(coverageByPdf[sorted[0].id] ?? topic.coverage);
    ins.style.display = 'block';
    document.getElementById('evInsightText').textContent =
      _truncateName(sorted[0].filename, 24) + ' is the best match at ' + topCov + '%.';
  }
}

// ── PDF Library ───────────────────────────────────────────────────────────────

function renderPdfLibrary() {
  const wrap = document.getElementById('pdfLibrarySection');
  if (!wrap) return;
  const pdfs = S.sessionPdfs || [];
  if (!pdfs.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'block';

  const pdfBestCov = {};
  (S.topics || []).forEach(t => {
    Object.entries(t.coverage_by_pdf || {}).forEach(([pid, cov]) => {
      pdfBestCov[pid] = Math.max(pdfBestCov[pid] || 0, cov);
    });
  });

  const sessionTitle = S.session?.title || 'Session';
  let html = '<div class="pdf-library-header">' +
    '<span>PDFs in this session <span style="font-weight:400;color:var(--muted2)">(' + pdfs.length + ')</span></span>' +
    '<span style="font-weight:400;color:var(--muted2);font-size:.7rem">' + sessionTitle + '</span>' +
  '</div>';

  pdfs.forEach((p, i) => {
    const cov = pdfBestCov[p.id] ?? 0;
    const covColor = cov >= 70 ? 'var(--green)' : cov >= 40 ? 'var(--yellow-d)' : '#d1d5db';
    const delay = (i * 0.06).toFixed(2);
    html += '<div class="pdf-card" style="animation-delay:' + delay + 's">' +
      '<div class="pdf-card-icon">' +
        '<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#1c1917" stroke-width="1.8"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>' +
      '</div>' +
      '<div class="pdf-card-body">' +
        '<div class="pdf-card-name" title="' + _escHtml(p.filename) + '">' + _escHtml(p.filename) + '</div>' +
        '<div class="pdf-card-meta">' +
          '<span>' + (p.page_count || '?') + ' pages</span>' +
          (cov ? '<span style="color:' + covColor + ';font-weight:600">' + cov + '% coverage</span>' : '') +
        '</div>' +
        (cov ? '<div class="pdf-coverage-bar"><div class="pdf-coverage-fill" style="width:0%;background:' + covColor + '" data-w="' + cov + '"></div></div>' : '') +
      '</div>' +
      '<div class="pdf-card-actions">' +
        (S.session ? '<button class="pdf-action-btn" title="View PDF" onclick="viewPdf(\'' + p.id + '\')">' +
          '<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
        '</button>' : '') +
      '</div>' +
    '</div>';
  });

  wrap.innerHTML = html;
  setTimeout(() => {
    wrap.querySelectorAll('.pdf-coverage-fill').forEach(el => {
      el.style.width = el.dataset.w + '%';
    });
  }, 350);
}

async function viewPdf(pdfId) {
  if (!S.session) return;
  try {
    const data = await apiFetch('/session/' + S.session.id + '/pdf/' + pdfId + '/url');
    if (data.url) window.open(data.url, '_blank');
  } catch (e) {
    console.error('Could not open PDF:', e);
  }
}

function quizFromSummary() { S.quizSetup.topicId = S.activeTopic; navigate('quiz'); }

function _truncateName(name, max) {
  if (!name) return '';
  return name.length > max ? name.slice(0, max) + '…' : name;
}

function _escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

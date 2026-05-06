/** Summary view — topic sidebar, depth tabs, lang pills, doc panel, PDF library. */

const LANGS = [
  {code:'en',label:'English'},{code:'hi',label:'Hindi'},{code:'es',label:'Spanish'},
  {code:'fr',label:'French'},{code:'ar',label:'Arabic'},{code:'ja',label:'Japanese'},
  {code:'de',label:'German'},{code:'ur',label:'Urdu'},{code:'zh',label:'Chinese'},
];

function renderTopicSidebar() {
  const list = document.getElementById('topicList');
  if (!S.topics.length) { list.innerHTML='<div style="padding:1rem;font-size:.82rem;color:var(--muted2)">No topics yet.</div>'; return; }
  list.innerHTML = S.topics.map(t =>
    '<div class="topic-item'+(S.activeTopic===t.id?' active':'')+'" onclick="selectTopic(\''+t.id+'\')">'+
    '<div class="topic-name">'+t.name+'</div>'+
    '<div class="topic-bar" title="'+t.coverage+'% of this topic\'s key concepts were found in your PDFs"><div class="topic-bar-fill" style="width:'+t.coverage+'%"></div></div>'+
    '<div style="font-size:.7rem;color:var(--muted2);margin-top:.1rem">'+t.coverage+'% coverage <span title="How much of this topic\'s key concepts appear in your PDFs, measured by AI semantic similarity." style="cursor:help;opacity:.6">ⓘ</span></div></div>'
  ).join('');
}

function selectTopic(id) {
  S.activeTopic = id;
  renderTopicSidebar();
  loadSummary();
  renderDocPanel();
}

function loadSummary() {
  const topic = S.topics.find(t=>t.id===S.activeTopic);
  if (!topic) return;
  document.getElementById('summaryEmpty').style.display = 'none';
  document.getElementById('summaryContent').style.display = 'block';
  renderLangRow();
  renderSummaryBody(topic);
}

function renderLangRow() {
  const row = document.getElementById('langRow');
  row.innerHTML = LANGS.map(l =>
    '<div class="lang-pill'+(S.currentLang===l.code?' active':'')+'" onclick="switchLang(\''+l.code+'\')" data-lang="'+l.code+'">'+l.label+'</div>'
  ).join('');
}

function switchDepth(d, el) {
  S.currentDepth = d;
  document.querySelectorAll('.depth-tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  const topic = S.topics.find(t=>t.id===S.activeTopic);
  if (topic) renderSummaryBody(topic);
}

function switchLang(code) {
  S.currentLang = code;
  const rtlLangs = ['ar','he','ur','fa'];
  document.getElementById('summaryBody').style.direction = rtlLangs.includes(code) ? 'rtl' : 'ltr';
  renderLangRow();
  const topic = S.topics.find(t=>t.id===S.activeTopic);
  if (topic) renderSummaryBody(topic);
}

async function renderSummaryBody(topic) {
  if (!S.session) return;
  const body = document.getElementById('summaryBody');
  body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:3rem"><div class="ev-loader" style="font-size:1.6rem">ev.</div></div>';
  try {
    const data = await apiFetch('/summary/'+S.session.id+'/'+topic.id+'?depth='+S.currentDepth+'&lang='+S.currentLang);
    if (!data) return;
    const content = data.content || { headline: topic.name, sections: [] };
    let html = '<h2 class="summary-headline">'+(content.headline||topic.name)+'</h2>';
    (content.sections||[]).forEach(s => {
      let text = (s.content||s.text||'');
      (s.keywords||[]).forEach(kw => {
        text = text.replace(new RegExp('\\b'+kw+'\\b','gi'), '<span class="kw">$&</span>');
      });
      text = text.replace(/\b([A-Z]{2,})\b/g, '<span class="acronym">$1</span>');
      html += '<div class="summary-section"><div class="summary-section-title">'+(s.title||'')+'</div><div class="summary-text">'+text+'</div></div>';
    });
    if (data.keywords&&data.keywords.length) {
      html += '<div class="summary-section"><div class="summary-section-title">Key Terms</div><div style="display:flex;flex-wrap:wrap;gap:.4rem">'+data.keywords.map(k=>'<span class="kw">'+k+'</span>').join('')+'</div></div>';
    }
    html += '<div class="summary-quiz-cta"><span style="font-weight:600;font-size:.9rem">Ready to test yourself?</span><button class="btn btn-dark btn-sm" onclick="quizFromSummary()">Quiz on this topic &rarr;</button></div>';
    body.innerHTML = html;
    body.style.animation = 'none';
    requestAnimationFrame(() => { body.style.animation = 'fadeSlide .35s ease both'; });
  } catch(e) {
    body.innerHTML = '<div style="padding:2rem;font-size:.88rem;color:var(--muted2)">'+(e.message||'Could not load summary.')+'</div>';
  }
}

function renderDocPanel() {
  const pdfs = S.sessionPdfs || [];
  const list = document.getElementById('docPanelList');
  if (!pdfs.length) { list.innerHTML='<div style="padding:1rem;font-size:.8rem;color:var(--muted2)">Upload PDFs to see coverage.</div>'; return; }

  const topic = S.topics.find(t=>t.id===S.activeTopic);
  // Use real per-PDF coverage scores when available
  const coverageByPdf = topic?.coverage_by_pdf || {};

  // Sort PDFs: highest coverage for active topic first
  const sorted = [...pdfs].sort((a,b) => (coverageByPdf[b.id]||0) - (coverageByPdf[a.id]||0));

  list.innerHTML = sorted.map((p, i) => {
    const cov = coverageByPdf[p.id] ?? Math.max(0, (topic?.coverage||0) - i*12);
    const badge = cov >= 70 ? 'best' : cov >= 40 ? 'good' : 'skip';
    const badgeLabel = badge==='best' ? '★ Best' : badge==='good' ? 'Good' : 'Low';
    const barColor = badge==='best' ? 'var(--yellow-d)' : badge==='good' ? 'var(--green)' : '#d1d5db';
    const iconBg = badge==='best' ? '#fef9c3' : badge==='good' ? '#dcfce7' : '#f5f5f4';
    return '<div class="doc-row'+(badge==='best'?' best':'')+'">'+
      '<div class="doc-row-icon" style="background:'+iconBg+'"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#1c1917" stroke-width="1.8"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 11h5"/></svg></div>'+
      '<div class="doc-row-info">'+
        '<div class="doc-row-name">'+_truncateName(p.filename, 28)+'</div>'+
        '<div class="doc-row-meta">'+(p.page_count||'?')+' pages</div>'+
        '<div class="doc-cov" title="'+cov+'% of this topic\'s concepts found in this PDF"><div class="doc-cov-fill" style="width:'+cov+'%;background:'+barColor+'"></div></div>'+
        '<div style="font-size:.68rem;color:var(--muted2);margin-top:.15rem">'+cov+'% match <span title="Percentage of this topic\'s key concepts semantically matched in this PDF." style="cursor:help;opacity:.55">ⓘ</span></div>'+
      '</div>'+
      '<span class="doc-badge '+badge+'">'+badgeLabel+'</span>'+
    '</div>';
  }).join('');

  const ins = document.getElementById('evInsight');
  if (topic && ins && sorted.length) {
    const topCov = coverageByPdf[sorted[0].id] ?? topic.coverage;
    ins.style.display = 'block';
    document.getElementById('evInsightText').textContent =
      'For "'+topic.name+'", '+_truncateName(sorted[0].filename,22)+' has the best coverage at '+topCov+'%.';
  }
}

/** Render a proper PDF library grid in the upload view (#pdfLibrarySection) */
function renderPdfLibrary() {
  const wrap = document.getElementById('pdfLibrarySection');
  if (!wrap) return;
  const pdfs = S.sessionPdfs || [];
  if (!pdfs.length) { wrap.style.display = 'none'; return; }

  wrap.style.display = 'block';

  // Compute overall best coverage per PDF across all topics
  const pdfBestCov = {};
  (S.topics || []).forEach(t => {
    Object.entries(t.coverage_by_pdf || {}).forEach(([pid, cov]) => {
      pdfBestCov[pid] = Math.max(pdfBestCov[pid]||0, cov);
    });
  });

  const sessionTitle = S.session?.title || 'Session';
  let html = '<div class="pdf-library-header">'+
    '<span>PDFs in this session <span style="font-weight:400;color:var(--muted2)">('+pdfs.length+')</span></span>'+
    '<span style="font-weight:400;color:var(--muted2);font-size:.7rem">'+sessionTitle+'</span>'+
  '</div>';

  pdfs.forEach((p, i) => {
    const cov = pdfBestCov[p.id] ?? 0;
    const covColor = cov >= 70 ? 'var(--green)' : cov >= 40 ? 'var(--yellow-d)' : '#d1d5db';
    const delay = (i * 0.06).toFixed(2);
    html += '<div class="pdf-card" style="animation-delay:'+delay+'s">'+
      '<div class="pdf-card-icon">'+
        '<svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#1c1917" stroke-width="1.8"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>'+
      '</div>'+
      '<div class="pdf-card-body">'+
        '<div class="pdf-card-name" title="'+_escHtml(p.filename)+'">'+_escHtml(p.filename)+'</div>'+
        '<div class="pdf-card-meta">'+
          '<span><svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/></svg>'+(p.page_count||'?')+' pages</span>'+
          (cov ? '<span style="color:'+covColor+';font-weight:600">'+cov+'% coverage</span>' : '')+
        '</div>'+
        (cov ? '<div class="pdf-coverage-bar"><div class="pdf-coverage-fill" style="width:0%;background:'+covColor+'" data-w="'+cov+'"></div></div>' : '')+
      '</div>'+
      '<div class="pdf-card-actions">'+
        (S.session ? '<button class="pdf-action-btn" title="View PDF" onclick="viewPdf(\''+p.id+'\')">'+
          '<svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'+
        '</button>' : '')+
      '</div>'+
    '</div>';
  });

  wrap.innerHTML = html;

  // Animate coverage bars after paint
  setTimeout(() => {
    wrap.querySelectorAll('.pdf-coverage-fill').forEach(el => {
      el.style.width = el.dataset.w + '%';
    });
  }, 350);
}

/** Open a PDF in a new tab via the server's fresh-URL endpoint */
async function viewPdf(pdfId) {
  if (!S.session) return;
  try {
    const data = await apiFetch('/session/'+S.session.id+'/pdf/'+pdfId+'/url');
    if (data.url) window.open(data.url, '_blank');
  } catch(e) {
    console.error('Could not open PDF:', e);
  }
}

function quizFromSummary() { S.quizSetup.topicId = S.activeTopic; navigate('quiz'); }

function _truncateName(name, max) {
  if (!name) return '';
  return name.length > max ? name.slice(0, max) + '…' : name;
}

function _escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
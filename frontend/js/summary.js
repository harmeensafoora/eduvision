/** Summary view — topic sidebar, depth tabs, lang pills, doc panel. */

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
    '<div class="topic-bar"><div class="topic-bar-fill" style="width:'+t.coverage+'%"></div></div></div>'
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
  // RTL support
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
      // Highlight keywords
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
  list.innerHTML = pdfs.map((p,i) => {
    const badge = i===0?'best':i===1?'good':'skip';
    const cov = topic ? Math.round((topic.coverage||0)*(1-i*0.2)) : 60-i*15;
    return '<div class="doc-row'+(badge==='best'?' best':'')+'">'+
      '<div class="doc-row-icon" style="background:'+(badge==='best'?'#fef9c3':badge==='good'?'#dcfce7':'#f5f5f4')+'"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#1c1917" stroke-width="1.8"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 11h5"/></svg></div>'+
      '<div class="doc-row-info"><div class="doc-row-name">'+p.filename+'</div><div class="doc-row-meta">'+p.page_count+' pages</div>'+
      '<div class="doc-cov"><div class="doc-cov-fill" style="width:'+cov+'%;background:'+(badge==='best'?'var(--yellow-d)':badge==='good'?'var(--green)':'#d1d5db')+'"></div></div></div>'+
      '<span class="doc-badge '+badge+'">'+(badge==='best'?'&#9733; Best':badge==='good'?'Good':'Skip')+'</span></div>';
  }).join('');
  const ins = document.getElementById('evInsight');
  if (topic && ins) {
    ins.style.display = 'block';
    document.getElementById('evInsightText').textContent = 'For "'+topic.name+'", the top PDF has '+(topic.coverage||0)+'% coverage of this topic.';
  }
}

function quizFromSummary() { S.quizSetup.topicId = S.activeTopic; navigate('quiz'); }

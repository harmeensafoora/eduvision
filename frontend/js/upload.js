/** Upload view — drag-drop, file list, progress panel, session list, PDF library. */

function triggerFileInput() { document.getElementById('fileInput').click(); }
function handleDragOver(e) { e.preventDefault(); document.getElementById('dropZone').classList.add('drag-over'); }
function handleDragLeave() { document.getElementById('dropZone').classList.remove('drag-over'); }
function handleDrop(e) { e.preventDefault(); document.getElementById('dropZone').classList.remove('drag-over'); addFiles(Array.from(e.dataTransfer.files).filter(f=>f.type==='application/pdf')); }
function handleFiles(e) { addFiles(Array.from(e.target.files)); }

function addFiles(newFiles) {
  newFiles.forEach(f => { if (!S.files.find(x=>x.name===f.name)) S.files.push(f); });
  renderFileList();
}

function renderFileList() {
  const list = document.getElementById('fileList');
  list.innerHTML = '';
  S.files.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item.style.animationDelay = (i*0.08)+'s';
    item.innerHTML =
      '<div class="file-icon"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#1c1917" stroke-width="1.8"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/></svg></div>'+
      '<div class="file-name">'+f.name+'</div>'+
      '<div class="file-size">'+(f.size/1024/1024).toFixed(2)+' MB</div>'+
      '<button class="file-remove" onclick="removeFile('+i+')"><svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg></button>';
    list.appendChild(item);
  });
  document.getElementById('analyseBtn').disabled = S.files.length === 0;
  document.getElementById('fileCountLabel').textContent = S.files.length ? S.files.length+(S.files.length===1?' file selected':' files selected') : '';
}

function removeFile(i) { S.files.splice(i,1); renderFileList(); }

async function startAnalysis() {
  if (!S.files.length) return;
  const prog = document.getElementById('uploadProgress');
  prog.style.display = 'block';
  document.getElementById('analyseBtn').disabled = true;
  const stepIds = ['ps1','ps2','ps3','ps4','ps5'];
  let stepIdx = 0;
  function advanceStep() {
    if (stepIdx>0) { const prev=document.getElementById(stepIds[stepIdx-1]); if(prev){prev.classList.remove('active');prev.classList.add('done');} }
    if (stepIdx<stepIds.length) { const el=document.getElementById(stepIds[stepIdx]); if(el){el.classList.add('show','active');} stepIdx++; }
  }
  advanceStep();
  const stepTimer = setInterval(advanceStep, 1800);
  try {
    const fd = new FormData();
    S.files.forEach(f => fd.append('files', f));
    const resp = await apiUpload('/session/upload', fd);
    if (!resp) throw new Error('Session expired — please sign in again.');
    const { session_id } = resp;
    let ready = false;
    for (let i=0; i<90; i++) {
      await new Promise(r=>setTimeout(r,2000));
      try {
        const st = await apiFetch('/session/'+session_id+'/status');
        if (!st) throw new Error('Session expired — please sign in again.');
        if (st.status==='ready') { ready=true; break; }
        if (st.status==='error') throw new Error('Processing failed on server.');
      } catch(e) { if (e.message.includes('Processing') || e.message.includes('expired')) throw e; }
    }
    if (!ready) throw new Error('Processing timed out.');
    clearInterval(stepTimer);
    while (stepIdx<=stepIds.length) advanceStep();
    await new Promise(r=>setTimeout(r,400));
    await loadSession(session_id);
    prog.style.display = 'none';
    S.files = []; renderFileList();
  } catch(e) {
    clearInterval(stepTimer);
    prog.style.display = 'none';
    document.getElementById('analyseBtn').disabled = false;
    showError('uploadError', e.message||'Upload failed. Is the backend running?');
  }
}

async function loadSessions() {
  try {
    const data = await apiFetch('/session/list');
    S.sessions = (data||[]).map(s=>({
      id: s.id,
      title: s.title,
      pdfCount: s.pdf_count,
      date: s.last_accessed ? new Date(s.last_accessed).toLocaleDateString() : 'Recently',
      status: s.status
    }));
  } catch(_) { S.sessions = []; }
  renderSessionList();
  // Auto-load most recent ready session so summary/roadmap/quiz work immediately
  if (!S.session) {
    const ready = S.sessions.find(s => s.status === 'ready');
    if (ready) loadSession(ready.id, true);
  }
}

function renderSessionList() {
  const list = document.getElementById('sessionList');
  if (!S.sessions.length) {
    list.innerHTML = '<div style="font-size:.82rem;color:var(--muted2)">No recent sessions. Upload your first PDF to get started.</div>';
    return;
  }
  let h = '<div style="font-size:.72rem;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted2);margin-bottom:.8rem">Recent Sessions</div>';
  S.sessions.forEach(s => {
    const statusDot = s.status === 'processing'
      ? '<span style="width:7px;height:7px;border-radius:50%;background:var(--yellow-d);display:inline-block;margin-left:4px" title="Processing"></span>'
      : s.status === 'error'
      ? '<span style="width:7px;height:7px;border-radius:50%;background:#ef4444;display:inline-block;margin-left:4px" title="Error"></span>'
      : '';
    h += '<div class="session-card" onclick="loadSession(\''+s.id+'\')">'+
      '<div class="session-icon"><svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#1c1917" stroke-width="1.8"><rect x="4" y="2" width="16" height="20" rx="2"/></svg></div>'+
      '<div class="session-info">'+
        '<div class="session-title">'+s.title+statusDot+'</div>'+
        '<div class="session-meta">'+s.pdfCount+' PDF'+(s.pdfCount===1?'':'s')+' &middot; '+s.date+'</div>'+
      '</div>'+
      '<button class="btn btn-sm">Resume &rarr;</button>'+
    '</div>';
  });
  list.innerHTML = h;
}

async function loadSession(id, silent) {
  if (!silent) showLoader('Loading session…');
  try {
    const data = await apiFetch('/session/'+id);
    S.session = { id: data.id, title: data.title, pdfCount: (data.pdfs||[]).length };
    S.activeTopic = null;
    // Preserve coverage_by_pdf on each topic for the PDF library
    S.topics = (data.topics||[]).map(t => ({
      id: t.id,
      name: t.name,
      coverage: t.coverage || 0,
      bestPdf: t.best_pdf_id || '',
      coverage_by_pdf: t.coverage_by_pdf || {},
    }));
    S.sessionPdfs = data.pdfs || [];
    if (!silent) hideLoader();
    renderTopicSidebar();
    renderPdfLibrary();
    if (!silent) navigate('summary');
  } catch(e) {
    if (!silent) {
      hideLoader();
      showError('uploadError', 'Could not load session: ' + e.message);
    }
  }
}
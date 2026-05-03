/** Quiz view — setup, active quiz, results, badge animation, revision mode. */

const MOCK_QUESTIONS = [
  { type:'mcq', q:'At low [S], reaction rate is approximately:', opts:['Vmax only','[S] × (Vmax/Km)','Km alone','1/Vmax'], correct:1, expl:'At low [S] ≪ Km, rate ≈ Vmax[S]/Km.' },
  { type:'tf', q:'At saturating substrate concentrations, rate approaches Vmax.', correct:true, expl:'Correct — all active sites occupied.' },
  { type:'ow', q:'What symbol represents substrate concentration at half-maximal velocity?', correct:['km','michaelis constant'], expl:'Km is the Michaelis constant.' },
  { type:'os', q:'In one sentence, explain what Vmax represents.', expl:'Vmax = maximum velocity when enzyme is fully saturated.' },
  { type:'match', q:'Match each term to its definition.', pairs:[['Km','[S] at ½ Vmax'],['Vmax','Maximum rate'],['Kcat','Turnover number']], expl:'All pairs correct.' },
];

function normalizeQuestion(q) {
  let correct = q.correct_answer;
  const opts = q.options||q.opts||[];
  if (q.type==='mcq'&&opts.length) {
    const idx = opts.findIndex(o=>o===q.correct_answer);
    correct = idx>=0?idx:0;
  }
  if (q.type==='tf') correct = String(q.correct_answer).toLowerCase()==='true';
  if (q.type==='ow') correct = [String(q.correct_answer).toLowerCase()];
  return { type:q.type, q:q.question||q.q, opts, correct, expl:q.explanation||q.expl||'', pairs:q.pairs||[], _correct_answer:q.correct_answer };
}

function setupQuizView() {
  document.getElementById('quizSetup').style.display = 'block';
  document.getElementById('quizActive').style.display = 'none';
  document.getElementById('quizResults').style.display = 'none';
  const sel = document.getElementById('quizTopicSelect');
  sel.innerHTML = S.topics.map(t=>'<option value="'+t.id+'">'+t.name+'</option>').join('')||'<option value="">No topics loaded</option>';
  if (S.quizSetup.topicId) sel.value = S.quizSetup.topicId;
  _updateStepDots(3,0);
  // Reset mode toggle
  _setQuizMode('normal');
  _refreshWrongCount();
}

function toggleQT(el) { el.classList.toggle('sel'); }
function setDiff(el) { document.querySelectorAll('.diff-tab').forEach(t=>t.classList.remove('active')); el.classList.add('active'); S.quizSetup.diff=el.dataset.d; }
function setCount(el) { document.querySelectorAll('.qcount-btn').forEach(b=>b.classList.remove('active')); el.classList.add('active'); S.quizSetup.count=parseInt(el.dataset.n); }

function _setQuizMode(mode) {
  S.quizSetup.mode = mode;
  const normalBtn = document.getElementById('modeNormal');
  const revisionBtn = document.getElementById('modeRevision');
  if (normalBtn) normalBtn.classList.toggle('active', mode==='normal');
  if (revisionBtn) revisionBtn.classList.toggle('active', mode==='revision');
  const normalOptions = document.getElementById('quizNormalOptions');
  if (normalOptions) normalOptions.style.display = mode==='revision' ? 'none' : '';
  const revisionNote = document.getElementById('quizRevisionNote');
  if (revisionNote) revisionNote.style.display = mode==='revision' ? 'block' : 'none';
}

async function _refreshWrongCount() {
  const badge = document.getElementById('wrongCountBadge');
  if (!badge || !S.session) return;
  const topicId = document.getElementById('quizTopicSelect')?.value;
  if (!topicId) return;
  try {
    const data = await apiFetch('/quiz/wrong-answers/'+topicId);
    const n = data.wrong_count || 0;
    badge.textContent = n > 0 ? n+' to revise' : 'None yet';
    badge.style.background = n > 0 ? 'var(--accent)' : 'var(--surface2)';
    badge.style.color = n > 0 ? '#fff' : 'var(--muted2)';
    const revBtn = document.getElementById('modeRevision');
    if (revBtn) revBtn.disabled = n === 0;
  } catch(_) {}
}

// Update wrong count when topic changes
function onTopicChange() { _refreshWrongCount(); }

async function startQuiz() {
  const mode = S.quizSetup.mode || 'normal';
  const topicId = document.getElementById('quizTopicSelect').value;
  S.quizSetup.topicId = topicId;
  S.quizSetup.diff = document.querySelector('.diff-tab.active')?.dataset?.d||'intermediate';
  S.quizSetup.count = parseInt(document.querySelector('.qcount-btn.active')?.dataset?.n||'10');
  S.quizSetup.lang = document.getElementById('quizLangSelect').value||'en';

  if (mode === 'revision') {
    await _startRevisionQuiz();
    return;
  }

  const types = Array.from(document.querySelectorAll('.qt-chip.sel')).map(c=>c.dataset.v);
  if (!types.length) { showError('quizSetupError','Please select at least one question type.'); return; }
  S.quizSetup.types = types;

  if (!S.session||!S.quizSetup.topicId) { _useMockQuiz(types); return; }
  showLoader('Generating quiz…',['Reading your uploaded materials…','Creating tailored questions…','Checking for duplicates…']);
  try {
    const data = await apiFetch('/quiz/generate',{ method:'POST', body:{ session_id:S.session.id, topic_id:S.quizSetup.topicId, types, difficulty:S.quizSetup.diff, count:S.quizSetup.count, lang:S.quizSetup.lang, mode:'normal' } });
    hideLoader();
    S.quizId = data.quiz_id;
    S.quizMode = 'normal';
    S.quizQuestions = (data.questions||[]).map(normalizeQuestion);
    if (!S.quizQuestions.length) { _useMockQuiz(types); return; }
    _startActiveQuiz();
  } catch(e) { hideLoader(); showError('quizSetupError',e.message||'Quiz generation failed.'); _useMockQuiz(types); }
}

async function _startRevisionQuiz() {
  if (!S.session||!S.quizSetup.topicId) { showError('quizSetupError','Please load a session first.'); return; }
  showLoader('Loading your mistakes…',['Finding questions you got wrong…','Building your revision set…']);
  try {
    const data = await apiFetch('/quiz/generate',{ method:'POST', body:{
      session_id: S.session.id,
      topic_id: S.quizSetup.topicId,
      types: ['mcq','tf','ow','os','match'],
      difficulty: S.quizSetup.diff,
      count: S.quizSetup.count,
      lang: S.quizSetup.lang,
      mode: 'revision'
    }});
    hideLoader();
    S.quizId = data.quiz_id;
    S.quizMode = 'revision';
    S.quizQuestions = (data.questions||[]).map(normalizeQuestion);
    if (!S.quizQuestions.length) { showError('quizSetupError','No wrong answers found yet — take a normal quiz first!'); return; }
    _startActiveQuiz();
  } catch(e) {
    hideLoader();
    const msg = e.message||'';
    if (msg.toLowerCase().includes('no wrong answers')) {
      showError('quizSetupError','No mistakes recorded yet! Take a normal quiz first, then revisit.');
    } else {
      showError('quizSetupError', msg||'Could not start revision quiz.');
    }
  }
}

function _useMockQuiz(types) {
  const count = S.quizSetup.count||10;
  S.quizId = null;
  S.quizMode = 'normal';
  S.quizQuestions = MOCK_QUESTIONS.filter(q=>types.includes(q.type)).slice(0,count);
  if (!S.quizQuestions.length) S.quizQuestions = MOCK_QUESTIONS.slice(0,count);
  _startActiveQuiz();
}

function _startActiveQuiz() {
  S.quizAnswers = new Array(S.quizQuestions.length).fill(null);
  S.rawAnswers = new Array(S.quizQuestions.length).fill(null);
  S.quizIdx = 0;
  S.matchState = { selected:null, matched:new Set(), pairs:[] };
  document.getElementById('quizSetup').style.display = 'none';
  document.getElementById('quizActive').style.display = 'block';
  // Show revision banner if in revision mode
  const revBanner = document.getElementById('quizRevisionBanner');
  if (revBanner) revBanner.style.display = S.quizMode==='revision' ? 'flex' : 'none';
  renderQuestion();
}

function _updateStepDots(total,current) {
  const ind = document.getElementById('quizStepIndicator');
  ind.innerHTML = Array.from({length:total}).map((_,i)=>
    '<div class="quiz-step-dot'+(i===current?' active':i<current?' done':'')+'" style="animation-delay:'+(i*0.08)+'s"></div>'
  ).join('');
}

function renderQuestion() {
  const q = S.quizQuestions[S.quizIdx];
  const total = S.quizQuestions.length;
  document.getElementById('quizProgressFill').style.width=((S.quizIdx/total)*100)+'%';
  document.getElementById('quizQNumber').textContent=(S.quizMode==='revision'?'Revision — ':'')+' Question '+(S.quizIdx+1)+' of '+total;
  document.getElementById('quizQuestionText').textContent=q.q;
  document.getElementById('quizFeedback').className='q-feedback';
  document.getElementById('quizNextBtn').style.display='none';
  _updateStepDots(total,S.quizIdx);
  const area = document.getElementById('quizAnswerArea');
  area.innerHTML='';
  if (q.type==='mcq') _renderMCQ(q,area);
  else if (q.type==='tf') _renderTF(q,area);
  else if (q.type==='ow') _renderOW(q,area);
  else if (q.type==='os') _renderOS(q,area);
  else if (q.type==='match') _renderMatch(q,area);
  else if (q.type==='diagram') renderDiagramQuestion(q);
  area.style.animation='none'; requestAnimationFrame(()=>{ area.style.animation='slideUp .35s ease both'; });
}

function _renderMCQ(q,area) { area.innerHTML=q.opts.map((o,i)=>'<div class="qopt" onclick="answerMCQ(this,'+i+','+q.correct+')">'+'<div class="qcirc">'+'ABCD'[i]+'</div>'+o+'</div>').join(''); }
function answerMCQ(el,idx,correct) {
  if (document.querySelector('.qopt.correct,.qopt.wrong')) return;
  document.querySelectorAll('.qopt').forEach(o=>o.style.pointerEvents='none');
  const ok=idx===correct; el.classList.add(ok?'correct':'wrong');
  if (!ok) document.querySelectorAll('.qopt')[correct]?.classList.add('correct');
  S.quizAnswers[S.quizIdx]=ok; S.rawAnswers[S.quizIdx]=(S.quizQuestions[S.quizIdx].opts||[])[idx]||String(idx);
  _showFeedback(ok,S.quizQuestions[S.quizIdx].expl);
}

function _renderTF(q,area) {
  area.innerHTML='<div class="tf-opts">'+
    '<button class="tf-btn true-btn" onclick="answerTF(this,true,'+q.correct+')">'+'<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>True</button>'+
    '<button class="tf-btn false-btn" onclick="answerTF(this,false,'+q.correct+')">'+'<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>False</button></div>';
}
function answerTF(el,val,correct) {
  document.querySelectorAll('.tf-btn').forEach(b=>b.style.pointerEvents='none');
  const ok=val===correct; el.classList.add(val?'sel-t':'sel-f');
  S.quizAnswers[S.quizIdx]=ok; S.rawAnswers[S.quizIdx]=val?'True':'False';
  _showFeedback(ok,S.quizQuestions[S.quizIdx].expl);
}

function _renderOW(q,area) {
  area.innerHTML='<input class="input" id="owAns" placeholder="Type your answer…" autocomplete="off" onkeydown="if(event.key===\'Enter\')submitOW()"/>'+
    '<button class="btn btn-dark" style="margin-top:.75rem;width:100%;justify-content:center" onclick="submitOW()">Submit &rarr;</button>';
  setTimeout(()=>document.getElementById('owAns')?.focus(),100);
}
function submitOW() {
  const val=(document.getElementById('owAns')?.value||'').trim();
  const q=S.quizQuestions[S.quizIdx];
  const ok=(q.correct||[]).some(a=>val.toLowerCase().includes(a)||a.includes(val.toLowerCase()));
  document.getElementById('owAns').disabled=true;
  S.quizAnswers[S.quizIdx]=ok; S.rawAnswers[S.quizIdx]=val;
  _showFeedback(ok,q.expl);
}

function _renderOS(q,area) {
  area.innerHTML='<textarea class="textarea" id="osAns" placeholder="Write your answer in one sentence…" rows="3"></textarea>'+
    '<button class="btn btn-dark" style="margin-top:.75rem;width:100%;justify-content:center" onclick="submitOS()">Submit &rarr;</button>';
  setTimeout(()=>document.getElementById('osAns')?.focus(),100);
}
function submitOS() {
  const val=(document.getElementById('osAns')?.value||'').trim();
  if (!val) return;
  document.getElementById('osAns').disabled=true;
  S.quizAnswers[S.quizIdx]=true; S.rawAnswers[S.quizIdx]=val;
  _showFeedback(true,'Submitted — server will evaluate. '+S.quizQuestions[S.quizIdx].expl);
}

function _renderMatch(q,area) {
  S.matchState={ selected:null, matched:new Set(), pairs:[], _q:q };
  const shuffled=[...q.pairs].sort(()=>Math.random()-.5);
  area.innerHTML='<div class="match-grid"><div class="match-col" id="matchLeft">'+
    q.pairs.map((p,i)=>'<div class="match-item" data-idx="'+i+'" data-side="left" onclick="selectMatch(this)">'+p[0]+'</div>').join('')+'</div>'+
    '<div class="match-col" id="matchRight">'+
    shuffled.map(p=>{ const oi=q.pairs.findIndex(x=>x[0]===p[0]); return '<div class="match-item" data-idx="'+oi+'" data-side="right" onclick="selectMatch(this)">'+p[1]+'</div>'; }).join('')+'</div></div>';
}
function selectMatch(el) {
  const side=el.dataset.side, idx=parseInt(el.dataset.idx);
  if (el.classList.contains('matched')) return;
  if (side==='left') {
    document.querySelectorAll('#matchLeft .match-item').forEach(i=>i.classList.remove('sel'));
    el.classList.add('sel'); S.matchState.selected=idx;
  } else {
    if (S.matchState.selected===null) return;
    const q=S.matchState._q||S.quizQuestions[S.quizIdx];
    if (S.matchState.selected===idx) {
      document.querySelectorAll('#matchLeft .match-item').forEach(i=>{ if(parseInt(i.dataset.idx)===S.matchState.selected){i.classList.remove('sel');i.classList.add('matched');} });
      el.classList.add('matched'); S.matchState.matched.add(idx);
      S.matchState.pairs.push([q.pairs[S.matchState.selected][0],q.pairs[idx][1]]);
      S.matchState.selected=null;
      if (S.matchState.matched.size===q.pairs.length) { S.quizAnswers[S.quizIdx]=true; S.rawAnswers[S.quizIdx]=S.matchState.pairs; _showFeedback(true,q.expl); }
    } else {
      el.style.animation='shake .3s ease'; setTimeout(()=>el.style.animation='',300);
      document.querySelectorAll('#matchLeft .match-item').forEach(i=>i.classList.remove('sel')); S.matchState.selected=null;
    }
  }
}

function _showFeedback(correct,expl) {
  const fb=document.getElementById('quizFeedback');
  fb.className='q-feedback show '+(correct?'correct-fb':'wrong-fb');
  fb.textContent=(correct?'Correct! ':'Not quite. ')+expl;
  document.getElementById('quizNextBtn').style.display='flex';
}

function nextQuestion() {
  S.quizIdx++;
  if (S.quizIdx>=S.quizQuestions.length) { showResults(); return; }
  renderQuestion();
}

async function showResults() {
  document.getElementById('quizActive').style.display='none';
  document.getElementById('quizResults').style.display='block';
  let pct;
  let perQuestion = [];
  if (S.quizId) {
    showLoader('Evaluating your answers…');
    try {
      const result = await apiFetch('/quiz/submit',{ method:'POST', body:{ quiz_id:S.quizId, answers:S.rawAnswers } });
      hideLoader(); pct=Math.round(result.score||0);
      perQuestion = result.per_question || [];
      if (pct===100&&S.session) { try { await apiFetch('/badge/award',{ method:'POST', body:{ topic_id:S.quizSetup.topicId } }); } catch(_){} }
    } catch(e) { hideLoader(); pct=Math.round((S.quizAnswers.filter(Boolean).length/S.quizAnswers.length)*100); }
  } else {
    pct=Math.round((S.quizAnswers.filter(Boolean).length/S.quizAnswers.length)*100);
  }

  // Animate score counter
  const scoreEl=document.getElementById('resultScore');
  scoreEl.textContent='0%'; let n=0; const step=Math.max(1,pct/40);
  const anim=setInterval(()=>{ n=Math.min(n+step,pct); scoreEl.textContent=Math.round(n)+'%'; if(n>=pct)clearInterval(anim); },25);

  // Label
  const labels={90:'Outstanding — topic mastered!',70:'Great work — a few gaps to close.',50:'Good progress — keep reviewing.',0:'Keep going — you\'re making progress.'};
  const lKey=Object.keys(labels).reverse().find(k=>pct>=parseInt(k));
  document.getElementById('resultLabel').textContent=labels[lKey];

  // Mode label
  const modeLabelEl = document.getElementById('resultModeLabel');
  if (modeLabelEl) {
    modeLabelEl.style.display = S.quizMode==='revision' ? 'inline-flex' : 'none';
    modeLabelEl.textContent = 'Revision Session';
  }

  // Score bar
  const topic=S.topics.find(t=>t.id===S.quizSetup.topicId)||S.topics[0];
  const topicName=topic?topic.name:'Topic';
  const bars=document.getElementById('resultBars');
  bars.innerHTML='<div style="font-size:.72rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted2);margin-bottom:.8rem">Topic Mastery</div>'+
    '<div class="r-bar-row"><span class="r-bar-label">'+topicName+'</span>'+
    '<div class="r-bar-bg"><div class="r-bar-fill" style="width:0%;background:'+(pct>=80?'var(--green)':pct>=50?'var(--yellow-d)':'var(--accent)')+'" data-w="'+pct+'"></div></div>'+
    '<span class="r-bar-pct">'+pct+'%</span></div>';
  setTimeout(()=>{ document.querySelectorAll('.r-bar-fill').forEach(b=>b.style.width=b.dataset.w+'%'); },400);

  // Per-question breakdown
  _renderQuestionBreakdown(perQuestion);

  // Badge
  if (pct>=100) { document.getElementById('badgeAwardWrap').style.display='flex'; _spawnConfetti(); }

  // Show/hide "Study Mistakes" button based on wrong answers
  const wrongBtn = document.getElementById('studyMistakesBtn');
  if (wrongBtn) {
    const wrongCount = perQuestion.filter(r=>!r.is_correct).length || S.quizAnswers.filter(a=>a===false).length;
    wrongBtn.style.display = wrongCount > 0 && S.session ? 'inline-flex' : 'none';
    wrongBtn.textContent = 'Study '+(wrongCount||'')+' Mistake'+(wrongCount===1?'':'s')+' →';
  }
}

function _renderQuestionBreakdown(perQuestion) {
  const wrap = document.getElementById('questionBreakdown');
  if (!wrap) return;
  if (!perQuestion || !perQuestion.length) {
    // Build local breakdown from S.quizAnswers
    perQuestion = S.quizQuestions.map((q,i)=>({
      question: q.q,
      is_correct: S.quizAnswers[i]===true,
      correct_answer: q._correct_answer,
      student_answer: S.rawAnswers[i],
      feedback: q.expl,
      type: q.type,
    }));
  }

  const wrongItems = perQuestion.filter(r=>!r.is_correct);
  if (!wrongItems.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:1rem;color:var(--green);font-size:.85rem;font-weight:600">🎉 All correct! Nothing to review.</div>';
    wrap.style.display = 'block';
    return;
  }

  let html = '<div style="font-size:.72rem;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--muted2);margin-bottom:.8rem">What went wrong ('+wrongItems.length+')</div>';
  html += wrongItems.map((r,i)=>{
    const correctDisplay = Array.isArray(r.correct_answer)
      ? r.correct_answer.join(' / ')
      : (r.correct_answer||'');
    return '<div class="breakdown-item wrong" style="margin-bottom:.75rem;padding:.85rem 1rem;background:#fff7f7;border:1.5px solid #fecaca;border-radius:10px">'+
      '<div style="font-size:.82rem;font-weight:600;color:#1c1917;margin-bottom:.35rem;line-height:1.45">'+(i+1)+'. '+_escapeHtml(r.question||'')+'</div>'+
      '<div style="font-size:.78rem;color:#dc2626;margin-bottom:.2rem">Your answer: '+_escapeHtml(String(r.student_answer||'—'))+'</div>'+
      (correctDisplay ? '<div style="font-size:.78rem;color:#16a34a;margin-bottom:.2rem">Correct: '+_escapeHtml(correctDisplay)+'</div>' : '')+
      (r.feedback ? '<div style="font-size:.76rem;color:var(--muted);margin-top:.2rem;font-style:italic">'+_escapeHtml(r.feedback)+'</div>' : '')+
    '</div>';
  }).join('');

  wrap.innerHTML = html;
  wrap.style.display = 'block';
}

function _escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _spawnConfetti() {
  const container=document.getElementById('confettiContainer');
  const colors=['var(--yellow-d)','var(--accent)','var(--green-lt)','#dbeafe'];
  for (let i=0;i<28;i++) {
    const p=document.createElement('div'); p.className='confetti-piece';
    const angle=(i/28)*360, dist=60+Math.random()*80;
    p.style.cssText='background:'+colors[i%colors.length]+';--cx:'+Math.cos(angle*Math.PI/180)*dist+'px;--cy:'+Math.sin(angle*Math.PI/180)*dist+'px;--cr:'+(Math.random()*360)+'deg;animation-delay:'+(Math.random()*0.3)+'s;';
  
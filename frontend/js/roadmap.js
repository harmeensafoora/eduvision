/** Roadmap view */
const DEPTH_LABELS = { exam:'Just the exam bits', solid:'Solid understanding', expert:'Become an expert' };
function setRoadmapDepth(d,el) { S.roadmapDepth=d; document.querySelectorAll('.rm-depth-tab').forEach(t=>t.classList.remove('active')); el.classList.add('active'); renderRoadmap(); }
async function renderRoadmap() {
  if (!S.session) return;
  document.getElementById('rmDepthBadge').textContent=DEPTH_LABELS[S.roadmapDepth];
  const track=document.getElementById('roadmapTrack');
  track.innerHTML='<div style="padding:2rem;display:flex;align-items:center;gap:.6rem"><div class="ev-loader" style="font-size:1.4rem">ev.</div><span style="font-size:.85rem;color:var(--muted2)">Building roadmap…</span></div>';
  try {
    const data=await apiFetch('/roadmap/'+S.session.id+'?depth='+S.roadmapDepth);
    S.roadmapNodes=data.nodes||[];
    document.getElementById('rmTopicLabel').textContent=S.session.title||'Your Study Plan';
    track.innerHTML=S.roadmapNodes.map((n,i)=>
      '<div class="rm-step '+n.status+'" style="animation-delay:'+(i*0.08)+'s">'+
      '<div class="rm-dot"></div>'+
      '<div class="rm-card" onclick="openDrawer(\''+n.id+'\')">'+
      '<div class="rm-icon">'+(n.status==='done'?'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>':'&#x25CB;')+'</div>'+
      '<div style="flex:1"><div class="rm-label">'+n.topic_name+'</div><div class="rm-sub">'+(n.is_locked?'Locked':'Step '+(n.order_index+1))+'</div></div>'+
      (!n.is_locked?'<button class="rm-quiz-btn" onclick="event.stopPropagation();quizFromRoadmap(\''+n.topic_id+'\')">Take quiz</button>':'')+
      '</div></div>'
    ).join('');
  } catch(e) { track.innerHTML='<div style="padding:1.5rem;font-size:.85rem;color:var(--muted2)">Could not load roadmap: '+e.message+'</div>'; }
}
function openDrawer(nodeId) {
  const node=S.roadmapNodes.find(n=>n.id===nodeId);
  if (!node||node.is_locked) return;
  document.getElementById('drawerTitle').textContent=node.topic_name;
  document.getElementById('drawerSub').textContent='Step '+(node.order_index+1)+' — '+DEPTH_LABELS[node.depth_level||S.roadmapDepth];
  const refs=node.pdf_section_refs||[];
  document.getElementById('drawerExcerpt').textContent=refs.length?(refs[0].excerpt||'No excerpt available.'):'No PDF section linked yet.';
  document.getElementById('stepDrawer').classList.add('open');
}
function closeDrawer() { document.getElementById('stepDrawer').classList.remove('open'); }
function quizFromRoadmap(topicId) { S.quizSetup.topicId=topicId; navigate('quiz'); }
function quizFromDrawer() { closeDrawer(); navigate('quiz'); }

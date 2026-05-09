/**
 * EduVision Dashboard module.
 * Renders stats, strengths/weaknesses, concept map, badges, and AI observation.
 */

function saveBadges() { localStorage.setItem('ev_badges', JSON.stringify(S.badges)); }
function loadBadges() { S.badges = JSON.parse(localStorage.getItem('ev_badges') || '[]'); }

async function renderDashboard() {
  if (!S.user) return;

  // Header — instant from cached user
  const wrap = document.getElementById('dashAvatarWrap');
  if (wrap) {
    wrap.innerHTML = S.user.avatar_url
      ? '<img class="dash-avatar" src="' + S.user.avatar_url + '" alt="' + S.user.name + '" onerror="this.style.display=\'none\'">'
      : '<div class="dash-avatar-placeholder">' + (S.user.name || 'U')[0] + '</div>';
  }

  const dashName = document.getElementById('dashName');
  if (dashName) dashName.textContent = S.user.name || 'Learner';

  const tags = document.getElementById('dashLearnerTags');
  if (tags) tags.style.display = 'none'; // Hidden as per accessibility purge

  const memberSince = document.getElementById('dashMemberSince');
  if (memberSince) {
    if (S.user.created_at) {
      const d = new Date(S.user.created_at);
      memberSince.textContent = 'Member since ' + d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } else {
      memberSince.style.display = 'none';
    }
  }

  const streakVal = S.user.streak_count || 0;
  const streakEl = document.getElementById('dashStreak');
  const statStreak = document.getElementById('statStreak');
  if (streakEl) streakEl.textContent = streakVal;
  if (statStreak) statStreak.textContent = streakVal;

  // Fetch live data
  try {
    const d = await apiFetch('/dashboard');
    S.dashData = d;
    const st = d.stats || {};

    animateStat('statTopics', (st.topics_mastered || 0) + '/' + (st.total_topics || 0));
    animateStat('statScore', (st.avg_quiz_score || 0) + '%');
    animateStat('statPDFs', st.pdfs_analysed || 0);

    if (streakEl) streakEl.textContent = st.streak_count || streakVal;
    if (statStreak) statStreak.textContent = st.streak_count || streakVal;

    renderSW(d.strengths, d.weaknesses);
    renderConceptMap(d.concept_map);
    await renderBadgesGrid();

    // Observation — non-blocking
    _loadObservation();
  } catch (e) {
    animateStat('statTopics', '—');
    animateStat('statScore', '—');
    animateStat('statPDFs', '—');
    loadBadges();
    renderBadgesGrid();
  }
}

async function _loadObservation() {
  try {
    const obs = await apiFetch('/dashboard/observation');
    const el = document.getElementById('dashObs');
    if (el && obs && obs.observation) {
      el.textContent = obs.observation;
      el.style.display = 'block';
    }
  } catch (_) {}
}

function animateStat(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = '—';
  setTimeout(() => {
    el.textContent = val;
    el.style.animation = 'none';
    requestAnimationFrame(() => {
      el.style.animation = 'countUp .7s cubic-bezier(.34,1.56,.64,1) both';
    });
  }, 200);
}

function renderSW(strengths, weaknesses) {
  strengths = strengths || [];
  weaknesses = weaknesses || [];
  const strEl = document.getElementById('swStrengths');
  const wkEl = document.getElementById('swWeaknesses');
  if (!strEl || !wkEl) return;

  strEl.innerHTML =
    '<div style="font-size:.72rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--green);margin-bottom:.4rem">Strengths</div>' +
    (strengths.length
      ? strengths.map(s =>
          '<div class="sw-item strength">' +
          '<span style="font-weight:600;font-size:.82rem;flex:1">' + s.topic_name + '</span>' +
          '<div class="sw-bar-wrap"><div class="sw-bar" style="width:' + Math.round(s.score) + '%;background:var(--green)"></div></div>' +
          '<span style="font-size:.75rem;font-weight:700;color:var(--green)">' + Math.round(s.score) + '%</span>' +
          '</div>'
        ).join('')
      : '<div style="font-size:.8rem;color:var(--muted2)">Complete quizzes to track strengths.</div>');

  wkEl.innerHTML =
    '<div style="font-size:.72rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--red);margin:.8rem 0 .4rem">Needs Work</div>' +
    (weaknesses.length
      ? weaknesses.map(s =>
          '<div class="sw-item weakness">' +
          '<span style="font-weight:600;font-size:.82rem;flex:1">' + s.topic_name + '</span>' +
          '<div class="sw-bar-wrap"><div class="sw-bar" style="width:' + Math.round(s.score) + '%;background:var(--red)"></div></div>' +
          '<span style="font-size:.75rem;font-weight:700;color:var(--red)">' + Math.round(s.score) + '%</span>' +
          '</div>'
        ).join('')
      : '<div style="font-size:.8rem;color:var(--muted2)">No weak areas yet — keep quizzing!</div>');
}

function renderConceptMap(nodes) {
  const map = document.getElementById('conceptMap');
  if (!map) return;

  if (!nodes || !nodes.length) {
    map.innerHTML = '<div style="font-size:.8rem;color:var(--muted2);padding:1rem">Complete quizzes to build your knowledge map.</div>';
    return;
  }

  const cols = Math.ceil(Math.sqrt(nodes.length));
  map.innerHTML = nodes.map((n, i) => {
    const x = ((i % cols) / cols) * 88 + 4;
    const y = (Math.floor(i / cols) / Math.ceil(nodes.length / cols)) * 80 + 6;
    const st = n.status === 'mastered' ? 'mastered' : n.status === 'in_progress' ? 'progress' : 'not-started';
    return '<div class="cmap-node ' + st + '" style="left:' + x + '%;top:' + y + '%" ' +
      'onclick="selectTopicFromMap(\'' + n.topic_id + '\')" title="' + n.topic_name + '">' +
      n.topic_name + '</div>';
  }).join('');
}

function selectTopicFromMap(topicId) {
  S.quizSetup.topicId = topicId;
  const topic = S.topics.find(t => t.id === topicId);
  if (topic) S.activeTopic = topic;
  if (S.session) navigate('summary');
}

async function renderBadgesGrid() {
  const grid = document.getElementById('badgesGrid');
  if (!grid) return;

  let earned = [];
  try {
    earned = await apiFetch('/badge/list') || [];
  } catch (_) {
    earned = (S.badges || []).map(b => ({ topic_name: b.topic, badge_type: 'star' }));
  }

  const earnedNames = new Set(earned.map(b => b.topic_name));
  const allTopics = S.topics.length ? S.topics : earned.map(b => ({ name: b.topic_name }));

  if (!allTopics.length) {
    grid.innerHTML = '<div style="font-size:.8rem;color:var(--muted2)">Score 100% on a topic quiz to earn a badge.</div>';
    return;
  }

  grid.innerHTML = allTopics.map(t => {
    const isEarned = earnedNames.has(t.name);
    return '<div class="badge-card' + (isEarned ? ' earned' : '') + '" title="' +
      (isEarned ? 'Mastered \u2014 ' + t.name : 'Not yet earned') + '">' +
      '<svg class="badge-svg" viewBox="0 0 48 48">' +
      '<polygon points="24,3 28,17 43,17 31,26 35,41 24,32 13,41 17,26 5,17 20,17" ' +
      'fill="' + (isEarned ? '#fde047' : 'none') + '" stroke="#1c1917" stroke-width="2"/>' +
      '</svg>' +
      '<div class="badge-name">' + t.name + '</div>' +
      '</div>';
  }).join('');
}

function shareProfile() {
  const mastered = (S.dashData?.stats?.topics_mastered) || 0;
  const msg = 'Check out my EduVision learning profile! I\'ve mastered ' + mastered + ' topics already.';
  if (navigator.clipboard) {
    navigator.clipboard.writeText(msg)
      .then(() => toast('Profile status copied to clipboard!', 'success', 3000))
      .catch(() => toast('Could not copy to clipboard.', 'error', 3000));
  } else {
    toast('Sharing not supported in this browser.', 'info', 3000);
  }
}

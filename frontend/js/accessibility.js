/**
 * EduVision — Learner Accessibility Engine
 * Handles: Dyslexia, ADHD, Auditory/Verbal, Visual, Kinaesthetic, Non-native
 */

// ── State ─────────────────────────────────────────────────────────────────────
const A11Y = {
  activeTypes: [],
  tts: { synth: window.speechSynthesis || null, utter: null, speaking: false, rate: 0.9, paused: false },
  adhd: { focusIndex: 0, sections: [], focusActive: false, timerInterval: null, timerSecs: 0, timerRunning: false },
  ruler: { active: false },
};

// ── Init — called after applyLearnerProfile ───────────────────────────────────
function initAccessibility(types) {
  A11Y.activeTypes = types || [];
  _buildLearnerBadge();
  _buildA11yFab();
  _buildTTSBar();
  _buildADHDTimer();
  _buildReadingRuler();
  _applyAll();
}

function _applyAll() {
  const t = A11Y.activeTypes;
  _setRuler(t.includes('dyslexia'));
  _setADHDMode(t.includes('adhd'));
  _updateTTSBarVisibility(t.includes('auditory') || t.includes('verbal'));
  _updateLearnerBadge();
  // Font size: larger for dyslexia / autism
  if (t.includes('dyslexia') || t.includes('autism')) {
    document.documentElement.style.setProperty('--a11y-font-size', '1.08rem');
  } else {
    document.documentElement.style.removeProperty('--a11y-font-size');
  }
}

// ── Learner Mode Badge (nav) ──────────────────────────────────────────────────
function _buildLearnerBadge() {
  if (document.getElementById('learnerBadge')) return;
  const badge = document.createElement('div');
  badge.id = 'learnerBadge';
  badge.className = 'learner-badge';
  badge.title = 'Your learning profile — click to adjust';
  badge.onclick = openA11yPanel;
  const navRight = document.querySelector('.nav-right');
  if (navRight) navRight.insertBefore(badge, navRight.firstChild);
}

function _updateLearnerBadge() {
  const badge = document.getElementById('learnerBadge');
  if (!badge) return;
  if (!A11Y.activeTypes.length) { badge.style.display = 'none'; return; }
  const icons = {
    dyslexia: '◈', adhd: '◎', autism: '◇', visual: '◉', auditory: '♪',
    verbal: '♪', reading: '≡', kinaesthetic: '⌖', 'non-native': '⊕', dyscalculia: '∑'
  };
  const labels = {
    dyslexia: 'Dyslexic', adhd: 'ADHD', autism: 'Autism', visual: 'Visual',
    auditory: 'Auditory', verbal: 'Verbal', reading: 'Reading', kinaesthetic: 'Kinae.',
    'non-native': 'Non-native', dyscalculia: 'Dyscalculia'
  };
  badge.style.display = 'flex';
  badge.innerHTML = A11Y.activeTypes.slice(0, 3).map(t =>
    `<span class="learner-badge-pill" title="${labels[t] || t}">${icons[t] || '◆'} ${labels[t] || t}</span>`
  ).join('') + (A11Y.activeTypes.length > 3 ? `<span class="learner-badge-pill">+${A11Y.activeTypes.length - 3}</span>` : '');
}

// ── A11y FAB + Panel ──────────────────────────────────────────────────────────
function _buildA11yFab() {
  if (document.getElementById('a11yFab')) return;

  // FAB button
  const fab = document.createElement('button');
  fab.id = 'a11yFab';
  fab.className = 'a11y-fab';
  fab.title = 'Accessibility settings';
  fab.setAttribute('aria-label', 'Accessibility settings');
  fab.innerHTML = `<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
    <circle cx="12" cy="4" r="1.5"/><path stroke-linecap="round" d="M12 6v6m0 0l-3 5m3-5l3 5M9 9h6"/>
  </svg>`;
  fab.onclick = openA11yPanel;
  document.body.appendChild(fab);

  // Panel
  const panel = document.createElement('div');
  panel.id = 'a11yPanel';
  panel.className = 'a11y-panel';
  panel.innerHTML = `
    <div class="a11y-panel-header">
      <span style="font-family:'Fraunces',serif;font-size:1.1rem;font-weight:400">Learning Profile</span>
      <button class="a11y-panel-close" onclick="closeA11yPanel()" aria-label="Close">&times;</button>
    </div>
    <div class="a11y-panel-body">
      <div class="a11y-section-label">My learning style</div>
      <div class="a11y-toggle-grid" id="a11yToggleGrid"></div>
      <div class="a11y-section-label" style="margin-top:1rem">Display</div>
      <div class="a11y-display-controls">
        <div class="a11y-ctrl-row">
          <span>Font size</span>
          <div class="a11y-font-btns">
            <button onclick="a11yFontSize(-1)" aria-label="Decrease font size">A−</button>
            <button onclick="a11yFontSize(0)" aria-label="Reset font size">A</button>
            <button onclick="a11yFontSize(1)" aria-label="Increase font size">A+</button>
          </div>
        </div>
        <div class="a11y-ctrl-row">
          <span>High contrast</span>
          <label class="a11y-switch">
            <input type="checkbox" id="highContrastToggle" onchange="toggleHighContrast(this.checked)"/>
            <span class="a11y-switch-slider"></span>
          </label>
        </div>
        <div class="a11y-ctrl-row">
          <span>Reduce motion</span>
          <label class="a11y-switch">
            <input type="checkbox" id="reduceMotionToggle" onchange="toggleReduceMotion(this.checked)"/>
            <span class="a11y-switch-slider"></span>
          </label>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  _populateA11yToggles();
}

function _populateA11yToggles() {
  const grid = document.getElementById('a11yToggleGrid');
  if (!grid) return;
  const modes = [
    { v: 'dyslexia', label: 'Dyslexia', icon: '◈', desc: 'OpenDyslexic font + reading ruler' },
    { v: 'adhd', label: 'ADHD', icon: '◎', desc: 'Focus mode + Pomodoro timer' },
    { v: 'autism', label: 'Autism', icon: '◇', desc: 'Low stimulation, no animations' },
    { v: 'visual', label: 'Visual', icon: '◉', desc: 'Concept maps + color-coded keywords' },
    { v: 'auditory', label: 'Auditory', icon: '♪', desc: 'Text-to-speech audio player' },
    { v: 'verbal', label: 'Verbal', icon: '♪', desc: 'Read-aloud buttons on every section' },
    { v: 'reading', label: 'Reading/Writing', icon: '≡', desc: 'Structured notes format' },
    { v: 'kinaesthetic', label: 'Kinaesthetic', icon: '⌖', desc: 'Interactive exercises emphasis' },
    { v: 'non-native', label: 'Non-native', icon: '⊕', desc: 'Simplified language + glossary' },
    { v: 'dyscalculia', label: 'Dyscalculia', icon: '∑', desc: 'Math concepts visualised' },
  ];
  grid.innerHTML = modes.map(m => {
    const on = A11Y.activeTypes.includes(m.v);
    return `<label class="a11y-mode-toggle${on ? ' on' : ''}" title="${m.desc}" data-mode="${m.v}">
      <input type="checkbox" ${on ? 'checked' : ''} onchange="toggleA11yMode('${m.v}', this.checked)" style="display:none"/>
      <span class="a11y-mode-icon">${m.icon}</span>
      <span class="a11y-mode-label">${m.label}</span>
    </label>`;
  }).join('');
}

function openA11yPanel() {
  const panel = document.getElementById('a11yPanel');
  if (!panel) return;
  _populateA11yToggles();
  panel.classList.add('open');
  // Sync display toggles
  const hc = document.getElementById('highContrastToggle');
  if (hc) hc.checked = document.body.classList.contains('high-contrast');
  const rm = document.getElementById('reduceMotionToggle');
  if (rm) rm.checked = document.body.classList.contains('reduce-motion');
}

function closeA11yPanel() {
  const panel = document.getElementById('a11yPanel');
  if (panel) panel.classList.remove('open');
}

// Close on outside click
document.addEventListener('click', function(e) {
  const panel = document.getElementById('a11yPanel');
  const fab = document.getElementById('a11yFab');
  const badge = document.getElementById('learnerBadge');
  if (panel && panel.classList.contains('open')) {
    if (!panel.contains(e.target) && e.target !== fab && !fab?.contains(e.target) && e.target !== badge && !badge?.contains(e.target)) {
      closeA11yPanel();
    }
  }
});

function toggleA11yMode(mode, on) {
  if (on && !A11Y.activeTypes.includes(mode)) A11Y.activeTypes.push(mode);
  if (!on) A11Y.activeTypes = A11Y.activeTypes.filter(t => t !== mode);
  // Update body classes via existing function
  if (typeof applyLearnerProfile === 'function') applyLearnerProfile(A11Y.activeTypes);
  _applyAll();
  // Persist
  if (typeof S !== 'undefined' && S.user) {
    S.user.learner_types = A11Y.activeTypes;
    localStorage.setItem('ev_user', JSON.stringify(S.user));
  }
  // Update toggle label
  const label = document.querySelector(`.a11y-mode-toggle[data-mode="${mode}"]`);
  if (label) label.classList.toggle('on', on);
  // Re-inject TTS buttons if needed
  if (mode === 'auditory' || mode === 'verbal') injectTTSButtons();
  if (mode === 'adhd') _setADHDMode(on);
}

// ── Font size control ──────────────────────────────────────────────────────────
let _fontStep = 0;
function a11yFontSize(dir) {
  if (dir === 0) { _fontStep = 0; }
  else { _fontStep = Math.max(-2, Math.min(4, _fontStep + dir)); }
  const base = 16 + _fontStep * 1.5;
  document.documentElement.style.fontSize = base + 'px';
}

// ── High contrast + Reduce motion ────────────────────────────────────────────
function toggleHighContrast(on) {
  document.body.classList.toggle('high-contrast', on);
  localStorage.setItem('ev_high_contrast', on ? '1' : '');
}
function toggleReduceMotion(on) {
  document.body.classList.toggle('reduce-motion', on);
  localStorage.setItem('ev_reduce_motion', on ? '1' : '');
}

// ── Dyslexia: Reading Ruler ────────────────────────────────────────────────────
function _buildReadingRuler() {
  if (document.getElementById('readingRuler')) return;
  const ruler = document.createElement('div');
  ruler.id = 'readingRuler';
  ruler.className = 'reading-ruler';
  document.body.appendChild(ruler);

  document.addEventListener('mousemove', function(e) {
    if (!A11Y.ruler.active) return;
    ruler.style.top = (e.clientY - 12) + 'px';
  });
}

function _setRuler(on) {
  A11Y.ruler.active = on;
  const ruler = document.getElementById('readingRuler');
  if (ruler) ruler.style.display = on ? 'block' : 'none';
}

// ── TTS: Floating Controls Bar ─────────────────────────────────────────────────
function _buildTTSBar() {
  if (document.getElementById('ttsBar')) return;
  const bar = document.createElement('div');
  bar.id = 'ttsBar';
  bar.className = 'tts-bar';
  bar.innerHTML = `
    <button class="tts-btn" id="ttsPlayBtn" onclick="ttsPlayPause()" title="Play / Pause">
      <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24" id="ttsPlayIcon"><path d="M8 5v14l11-7z"/></svg>
    </button>
    <button class="tts-btn" onclick="ttsStop()" title="Stop">
      <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
    </button>
    <div class="tts-track">
      <div class="tts-track-fill" id="ttsTrackFill"></div>
    </div>
    <select class="tts-speed" id="ttsSpeedSel" onchange="ttsSetSpeed(this.value)" title="Speed">
      <option value="0.7">0.7×</option>
      <option value="0.9" selected>0.9×</option>
      <option value="1.0">1.0×</option>
      <option value="1.2">1.2×</option>
      <option value="1.5">1.5×</option>
    </select>
    <span class="tts-label" id="ttsLabel">Ready</span>
    <button class="tts-btn tts-close" onclick="ttsStop(); _updateTTSBarVisibility(false)" title="Close">×</button>
  `;
  document.body.appendChild(bar);
}

function _updateTTSBarVisibility(show) {
  const bar = document.getElementById('ttsBar');
  if (bar) bar.classList.toggle('visible', !!show);
}

var _ttsSections = [];
var _ttsCurrent = 0;
var _ttsTotal = 0;

function ttsReadSummary() {
  // Collect all summary text sections
  const body = document.getElementById('summaryBody');
  if (!body) return;
  _ttsSections = Array.from(body.querySelectorAll('.summary-section, .summary-headline, .summary-text'))
    .map(el => el.innerText.trim()).filter(Boolean);
  _ttsCurrent = 0;
  _ttsTotal = _ttsSections.length;
  _speakSection(_ttsCurrent);
  _updateTTSBarVisibility(true);
}

function ttsReadText(text, label) {
  _ttsSections = [text];
  _ttsCurrent = 0;
  _ttsTotal = 1;
  const lbl = document.getElementById('ttsLabel');
  if (lbl && label) lbl.textContent = label;
  _speakSection(0);
  _updateTTSBarVisibility(true);
}

function _speakSection(idx) {
  const synth = A11Y.tts.synth;
  if (!synth) return;
  synth.cancel();
  if (idx >= _ttsSections.length) {
    _ttsFinish();
    return;
  }
  const utter = new SpeechSynthesisUtterance(_ttsSections[idx]);
  utter.rate = A11Y.tts.rate;
  utter.lang = (typeof S !== 'undefined' && S.currentLang) ? _langToLocale(S.currentLang) : 'en-US';
  A11Y.tts.utter = utter;
  A11Y.tts.speaking = true;
  A11Y.tts.paused = false;
  _setTTSPlayIcon(true);
  const fill = document.getElementById('ttsTrackFill');
  if (fill && _ttsTotal > 0) fill.style.width = Math.round(((idx + 1) / _ttsTotal) * 100) + '%';
  const lbl = document.getElementById('ttsLabel');
  if (lbl) lbl.textContent = `Section ${idx + 1} of ${_ttsTotal}`;
  utter.onend = function() {
    _ttsCurrent++;
    if (_ttsCurrent < _ttsSections.length) {
      _speakSection(_ttsCurrent);
    } else {
      _ttsFinish();
    }
  };
  utter.onerror = function() { _ttsFinish(); };
  synth.speak(utter);
}

function _ttsFinish() {
  A11Y.tts.speaking = false;
  A11Y.tts.paused = false;
  _setTTSPlayIcon(false);
  const lbl = document.getElementById('ttsLabel');
  if (lbl) lbl.textContent = 'Done';
  const fill = document.getElementById('ttsTrackFill');
  if (fill) fill.style.width = '100%';
}

function ttsPlayPause() {
  const synth = A11Y.tts.synth;
  if (!synth) return;
  if (!A11Y.tts.speaking && _ttsSections.length) {
    // Restart
    _ttsCurrent = 0;
    _speakSection(0);
    return;
  }
  if (A11Y.tts.paused) {
    synth.resume();
    A11Y.tts.paused = false;
    _setTTSPlayIcon(true);
  } else {
    synth.pause();
    A11Y.tts.paused = true;
    _setTTSPlayIcon(false);
  }
}

function ttsStop() {
  const synth = A11Y.tts.synth;
  if (synth) synth.cancel();
  A11Y.tts.speaking = false;
  A11Y.tts.paused = false;
  _ttsSections = [];
  _setTTSPlayIcon(false);
  const lbl = document.getElementById('ttsLabel');
  if (lbl) lbl.textContent = 'Stopped';
  const fill = document.getElementById('ttsTrackFill');
  if (fill) fill.style.width = '0%';
}

function ttsSetSpeed(val) {
  A11Y.tts.rate = parseFloat(val);
  if (A11Y.tts.speaking && !A11Y.tts.paused) {
    // restart current section at new rate
    const cur = _ttsCurrent;
    const synth = A11Y.tts.synth;
    if (synth) synth.cancel();
    _ttsCurrent = cur;
    _speakSection(cur);
  }
}

function _setTTSPlayIcon(playing) {
  const icon = document.getElementById('ttsPlayIcon');
  if (!icon) return;
  icon.innerHTML = playing
    ? '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>' // pause icon
    : '<path d="M8 5v14l11-7z"/>'; // play icon
}

function _langToLocale(code) {
  const map = { en: 'en-US', hi: 'hi-IN', es: 'es-ES', fr: 'fr-FR', ar: 'ar-SA', ja: 'ja-JP', de: 'de-DE', ur: 'ur-PK', zh: 'zh-CN', ko: 'ko-KR', pt: 'pt-BR' };
  return map[code] || 'en-US';
}

// ── TTS: Inject buttons into summary sections ─────────────────────────────────
function injectTTSButtons() {
  const body = document.getElementById('summaryBody');
  if (!body) return;
  const isVerbal = A11Y.activeTypes.includes('auditory') || A11Y.activeTypes.includes('verbal');
  // Remove existing buttons first
  body.querySelectorAll('.tts-inline-btn').forEach(b => b.remove());
  if (!isVerbal) return;

  // Add "Listen to full summary" button at top
  const headline = body.querySelector('.summary-headline');
  if (headline && !headline.previousElementSibling?.classList.contains('tts-inline-btn')) {
    const fullBtn = document.createElement('button');
    fullBtn.className = 'tts-inline-btn tts-full-btn';
    fullBtn.innerHTML = `<svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> Listen to full summary`;
    fullBtn.onclick = ttsReadSummary;
    body.insertBefore(fullBtn, headline);
  }

  // Add listen button to each section
  body.querySelectorAll('.summary-section').forEach(function(sec) {
    const titleEl = sec.querySelector('.summary-section-title');
    const textEl = sec.querySelector('.summary-text');
    if (!textEl) return;
    const btn = document.createElement('button');
    btn.className = 'tts-inline-btn';
    btn.innerHTML = `<svg width="12" height="12" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg> Listen`;
    btn.onclick = function() {
      const label = titleEl ? titleEl.innerText : 'Section';
      ttsReadText(textEl.innerText, label);
    };
    if (titleEl) titleEl.insertAdjacentElement('afterend', btn);
    else sec.insertBefore(btn, textEl);
  });
}

// Hook into renderSummaryBody completion
(function patchSummaryRenderer() {
  const _origRender = window.renderSummaryBody;
  if (typeof _origRender === 'function') {
    window.renderSummaryBody = async function(topic) {
      await _origRender(topic);
      injectTTSButtons();
    };
  }
  // Also watch for DOM changes in case renderSummaryBody is defined later
  const bodyEl = document.getElementById('summaryBody');
  if (bodyEl) {
    const obs = new MutationObserver(function() {
      const isVerbal = A11Y.activeTypes.includes('auditory') || A11Y.activeTypes.includes('verbal');
      if (isVerbal) injectTTSButtons();
    });
    obs.observe(bodyEl, { childList: true, subtree: false });
  }
})();

// ── ADHD: Focus Mode ─────────────────────────────────────────────────────────
function _buildADHDTimer() {
  if (document.getElementById('adhdTimer')) return;
  const timer = document.createElement('div');
  timer.id = 'adhdTimer';
  timer.className = 'adhd-timer';
  timer.innerHTML = `
    <div class="adhd-timer-ring">
      <svg viewBox="0 0 36 36" class="adhd-ring-svg">
        <circle class="adhd-ring-bg" cx="18" cy="18" r="15.9"/>
        <circle class="adhd-ring-fill" id="adhdRingFill" cx="18" cy="18" r="15.9"/>
      </svg>
      <span class="adhd-timer-label" id="adhdTimerLabel">25:00</span>
    </div>
    <div class="adhd-timer-controls">
      <button onclick="adhdTimerToggle()" id="adhdTimerBtn" title="Start / Pause">▶</button>
      <button onclick="adhdTimerReset()" title="Reset">↺</button>
    </div>
    <div class="adhd-timer-title">Focus</div>
  `;
  document.body.appendChild(timer);
}

var _adhdDuration = 25 * 60; // 25 min Pomodoro
var _adhdElapsed = 0;
var _adhdInterval = null;

function adhdTimerToggle() {
  const btn = document.getElementById('adhdTimerBtn');
  if (_adhdInterval) {
    clearInterval(_adhdInterval);
    _adhdInterval = null;
    if (btn) btn.textContent = '▶';
  } else {
    _adhdInterval = setInterval(function() {
      _adhdElapsed++;
      _updateAdhdTimer();
      if (_adhdElapsed >= _adhdDuration) {
        clearInterval(_adhdInterval);
        _adhdInterval = null;
        _adhdTimerDone();
      }
    }, 1000);
    if (btn) btn.textContent = '⏸';
  }
}

function adhdTimerReset() {
  clearInterval(_adhdInterval);
  _adhdInterval = null;
  _adhdElapsed = 0;
  _updateAdhdTimer();
  const btn = document.getElementById('adhdTimerBtn');
  if (btn) btn.textContent = '▶';
}

function _updateAdhdTimer() {
  const remaining = _adhdDuration - _adhdElapsed;
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;
  const lbl = document.getElementById('adhdTimerLabel');
  if (lbl) lbl.textContent = m + ':' + (s < 10 ? '0' : '') + s;
  // Ring progress
  const fill = document.getElementById('adhdRingFill');
  if (fill) {
    const pct = _adhdElapsed / _adhdDuration;
    const circumference = 2 * Math.PI * 15.9;
    fill.style.strokeDashoffset = circumference * (1 - pct);
  }
}

function _adhdTimerDone() {
  const lbl = document.getElementById('adhdTimerLabel');
  if (lbl) lbl.textContent = 'Break!';
  // Flash
  const timer = document.getElementById('adhdTimer');
  if (timer) { timer.classList.add('done'); setTimeout(() => timer.classList.remove('done'), 3000); }
}

function _setADHDMode(on) {
  const timer = document.getElementById('adhdTimer');
  if (timer) timer.style.display = on ? 'flex' : 'none';
  document.body.classList.toggle('profile-adhd', on);
  if (!on && _adhdInterval) { clearInterval(_adhdInterval); _adhdInterval = null; }
}

// ── Kinaesthetic: Highlight drag-to-select ───────────────────────────────────
function _initKinaesthetic() {
  // Emphasise quiz CTA when kinaesthetic mode is on
  if (!A11Y.activeTypes.includes('kinaesthetic')) return;
  const ctaButtons = document.querySelectorAll('.summary-quiz-cta .btn');
  ctaButtons.forEach(b => b.classList.add('kinesthetic-pulse'));
}

// ── Non-native: Glossary tooltip ──────────────────────────────────────────────
function _initGlossary() {
  if (!A11Y.activeTypes.includes('non-native')) return;
  // Wrap acronyms with tooltip hint
  document.querySelectorAll('.acronym').forEach(el => {
    el.title = 'Abbreviation — hover for context';
    el.style.borderBottom = '1px dotted var(--muted2)';
    el.style.cursor = 'help';
  });
}

// ── Call after summary renders ────────────────────────────────────────────────
function onSummaryRendered() {
  injectTTSButtons();
  _initKinaesthetic();
  _initGlossary();
}

// ── Restore persisted display preferences ────────────────────────────────────
(function restorePrefs() {
  if (localStorage.getItem('ev_high_contrast') === '1') {
    document.body.classList.add('high-contrast');
  }
  if (localStorage.getItem('ev_reduce_motion') === '1') {
    document.body.classList.add('reduce-motion');
  }
})();

// Expose for external use
window.A11Y = A11Y;
window.initAccessibility = initAccessibility;
window.openA11yPanel = openA11yPanel;
window.closeA11yPanel = closeA11yPanel;
window.toggleA11yMode = toggleA11yMode;
window.ttsReadSummary = ttsReadSummary;
window.ttsReadText = ttsReadText;
window.ttsPlayPause = ttsPlayPause;
window.ttsStop = ttsStop;
window.ttsSetSpeed = ttsSetSpeed;
window.adhdTimerToggle = adhdTimerToggle;
window.adhdTimerReset = adhdTimerReset;
window.a11yFontSize = a11yFontSize;
window.toggleHighContrast = toggleHighContrast;
window.toggleReduceMotion = toggleReduceMotion;
window.injectTTSButtons = injectTTSButtons;
window.onSummaryRendered = onSummaryRendered;

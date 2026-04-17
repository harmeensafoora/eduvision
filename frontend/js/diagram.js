/**
 * EduVision Diagram module.
 * Handles the "diagram" question type — SVG hotspot labelling.
 *
 * Question shape expected from backend:
 *   {
 *     type: "diagram",
 *     question: "Label the parts of this cell",
 *     hotspots: [{ id, label, x, y }],   // x/y as percentages
 *     image_url?: "..."                   // optional; placeholder SVG used if absent
 *   }
 */

/**
 * Main entry point called by quiz.js renderQuestion() when type === 'diagram'.
 */
function renderDiagramQuestion(q) {
  const area = document.getElementById('quizAnswerArea');
  if (!area) return;

  const hotspots = q.hotspots || [];
  if (!hotspots.length) {
    area.innerHTML = '<div style="font-size:.88rem;color:var(--muted2)">No hotspots defined for this diagram.</div>';
    return;
  }

  // Track assignment state
  const matched = {}; // hotspot.id -> assigned label
  let selectedChip = null;

  area.innerHTML =
    '<div class="diagram-wrap">' +
      '<div class="diagram-canvas-wrap" id="diagramCanvasWrap">' +
        _buildDiagramImage(q, hotspots) +
        '<div class="diagram-hotspot-layer" id="diagramHotspotLayer"></div>' +
      '</div>' +
      '<div class="diagram-label-bank" id="diagramLabelBank"></div>' +
    '</div>';

  // Render number dots over the diagram
  const layer = document.getElementById('diagramHotspotLayer');
  hotspots.forEach((h, i) => {
    const dot = document.createElement('button');
    dot.className = 'diagram-dot';
    dot.id = 'diag-dot-' + i;
    dot.style.left = (h.x || (10 + (i % 4) * 22)) + '%';
    dot.style.top  = (h.y || (15 + Math.floor(i / 4) * 30)) + '%';
    dot.dataset.idx = i;
    dot.innerHTML = '<span class="dot-inner">' + (i + 1) + '</span>';
    dot.addEventListener('click', () => _onDotClick(i, h, matched, hotspots, layer));
    layer.appendChild(dot);
  });

  // Shuffle labels and render chips
  const labels = hotspots.map(h => h.label || h.id || '');
  const shuffled = _shuffled(labels);
  const bank = document.getElementById('diagramLabelBank');
  shuffled.forEach(label => {
    const chip = document.createElement('button');
    chip.className = 'diagram-chip';
    chip.dataset.label = label;
    chip.textContent = label;
    chip.addEventListener('click', () => {
      if (chip.classList.contains('used')) return;
      document.querySelectorAll('.diagram-chip.sel').forEach(c => c.classList.remove('sel'));
      if (selectedChip === chip) { selectedChip = null; return; }
      chip.classList.add('sel');
      selectedChip = chip;
    });
    bank.appendChild(chip);
  });

  // Expose selectedChip to dot-click handler via closure reference through a wrapper
  // (dot click needs to read the current value of selectedChip)
  function _onDotClick(idx, hotspot, matchedObj, allHotspots, layerEl) {
    if (!selectedChip) return;
    const label = selectedChip.dataset.label;
    matchedObj[hotspot.id || idx] = label;

    // Update dot visual
    const dot = document.getElementById('diag-dot-' + idx);
    if (dot) {
      dot.classList.add('assigned');
      dot.querySelector('.dot-inner').textContent = label.length > 6 ? label.substring(0, 5) + '\u2026' : label;
      dot.title = label;
    }

    // Mark chip as used
    selectedChip.classList.remove('sel');
    selectedChip.classList.add('used');
    selectedChip.disabled = true;
    selectedChip = null;

    // Check if all assigned
    if (Object.keys(matchedObj).length >= allHotspots.length) {
      _evaluateDiagram(matchedObj, allHotspots, layerEl);
    }
  }
}

function _evaluateDiagram(matched, hotspots, layer) {
  let correct = 0;
  hotspots.forEach((h, i) => {
    const key = h.id || i;
    const expected = (h.label || '').toLowerCase().trim();
    const given = (matched[key] || '').toLowerCase().trim();
    const isCorrect = given === expected;
    if (isCorrect) correct++;

    const dot = document.getElementById('diag-dot-' + i);
    if (dot) {
      dot.classList.add(isCorrect ? 'correct' : 'wrong');
      dot.disabled = true;
    }
  });

  const pct = Math.round((correct / hotspots.length) * 100);
  S.rawAnswers[S.quizIdx] = matched;
  S.quizAnswers[S.quizIdx] = pct >= 60;

  const fb = document.getElementById('quizFeedback');
  if (fb) {
    fb.className = 'q-feedback show ' + (pct >= 60 ? 'correct-fb' : 'wrong-fb');
    fb.textContent = pct >= 60
      ? 'Nice work! ' + correct + ' of ' + hotspots.length + ' labels correct.'
      : correct + ' of ' + hotspots.length + ' correct. Check the diagram again.';
  }

  const nextBtn = document.getElementById('quizNextBtn');
  if (nextBtn) nextBtn.style.display = 'inline-flex';
}

function _buildDiagramImage(q, hotspots) {
  if (q.image_url) {
    return '<img src="' + q.image_url + '" class="diagram-img" alt="Diagram" draggable="false"/>';
  }
  // Placeholder SVG with organic blob shapes
  const blobs = hotspots.map((h, i) => {
    const cx = (h.x || (10 + (i % 4) * 22));
    const cy = (h.y || (15 + Math.floor(i / 4) * 30));
    return '<ellipse cx="' + cx + '%" cy="' + cy + '%" rx="6%" ry="4%" ' +
      'fill="var(--accent)" stroke="var(--ink)" stroke-width="1.5" opacity=".6"/>';
  }).join('');
  return '<svg class="diagram-img" viewBox="0 0 100 60" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">' +
    '<rect width="100" height="60" fill="#fafaf9" stroke="var(--ink)" stroke-width=".5" rx="3"/>' +
    '<text x="50%" y="8%" text-anchor="middle" font-size="3.5" fill="var(--muted2)" font-family="DM Sans,sans-serif">Label the diagram</text>' +
    blobs +
    '</svg>';
}

function _shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

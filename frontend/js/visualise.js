/**
 * EduVision — Mindscape Visual System
 * Animated visual gallery for all 10 learner types.
 * Generates topic-matched CSS/SVG animations + multi-panel split view.
 */

// ── TOPIC → ANIMATION CATEGORY MAPPING ──────────────────────────────────────
const TOPIC_ANIM_MAP = [
  { pattern: /physi|force|motion|energy|wave|electromagn|thermo|quantum|optic|mechanic/i,  key: 'physics'  },
  { pattern: /bio|cell|DNA|gene|evolut|organ|photosyn|ecosystem|protein|neuron|anatomy/i,   key: 'biology'  },
  { pattern: /chem|molecule|bond|atom|element|reaction|periodic|acid|base|compound/i,       key: 'chemistry'},
  { pattern: /math|calcul|algebra|geometr|statistic|probability|theorem|equation|vector/i,  key: 'math'     },
  { pattern: /algo|code|program|software|data struct|computer|network|system|database|AI/i, key: 'cs'       },
  { pattern: /history|war|empire|civilization|revolution|ancient|medieval|colonial|era/i,   key: 'history'  },
  { pattern: /econom|market|trade|supply|demand|GDP|inflation|finance|investment/i,          key: 'economics'},
  { pattern: /psychology|cognitive|behavior|mental|emotion|memory|learning|brain/i,         key: 'psych'    },
];

function getTopicAnimKey(topicName) {
  for (const { pattern, key } of TOPIC_ANIM_MAP) {
    if (pattern.test(topicName)) return key;
  }
  return 'default';
}

// ── SVG ANIMATION GENERATORS ─────────────────────────────────────────────────
// Each returns an SVG string + a CSS class for the background gradient.

const ANIM_RENDERERS = {

  physics(w=320, h=200) {
    return {
      cls: 'anim-physics',
      svg: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <!-- Pendulum -->
        <g transform="translate(${w/2},20)">
          <line x1="0" y1="0" x2="0" y2="80" stroke="#1c1917" stroke-width="1.5" opacity=".4"/>
          <circle cx="0" cy="80" r="14" fill="#93c5fd" stroke="#1c1917" stroke-width="1.5">
            <animateTransform attributeName="transform" type="rotate"
              values="-30 0 0;30 0 0;-30 0 0" dur="2s" repeatCount="indefinite" calcMode="spline"
              keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"/>
          </circle>
        </g>
        <!-- Wave -->
        <path d="M20,${h*0.72} Q50,${h*0.56} 80,${h*0.72} Q110,${h*0.88} 140,${h*0.72} Q170,${h*0.56} 200,${h*0.72} Q230,${h*0.88} 260,${h*0.72} Q290,${h*0.56} 310,${h*0.72}"
          stroke="#3b82f6" stroke-width="2.5" fill="none" opacity=".6" stroke-linecap="round">
          <animateTransform attributeName="transform" type="translate"
            values="0 0;-40 0" dur="1.8s" repeatCount="indefinite"/>
        </path>
        <path d="M20,${h*0.78} Q50,${h*0.62} 80,${h*0.78} Q110,${h*0.94} 140,${h*0.78} Q170,${h*0.62} 200,${h*0.78} Q230,${h*0.94} 260,${h*0.78} Q290,${h*0.62} 310,${h*0.78}"
          stroke="#60a5fa" stroke-width="1.5" fill="none" opacity=".35" stroke-linecap="round">
          <animateTransform attributeName="transform" type="translate"
            values="0 0;40 0" dur="2.2s" repeatCount="indefinite"/>
        </path>
        <!-- Orbit -->
        <g transform="translate(${w*0.78},${h*0.38})">
          <circle r="22" fill="none" stroke="#bfdbfe" stroke-width="1.5" stroke-dasharray="4 3"/>
          <circle r="7" fill="#1d4ed8" opacity=".8">
            <animateTransform attributeName="transform" type="rotate"
              from="0 0 0" to="360 0 0" dur="3s" repeatCount="indefinite"/>
            <animate attributeName="cx" values="22;-22;22" dur="3s" repeatCount="indefinite"/>
            <animate attributeName="cy" values="0;0;0" dur="3s" repeatCount="indefinite"/>
          </circle>
          <circle cx="0" cy="0" r="9" fill="#fbbf24" stroke="#1c1917" stroke-width="1.2"/>
        </g>
      </svg>`
    };
  },

  biology(w=320, h=200) {
    return {
      cls: 'anim-biology',
      svg: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <!-- DNA Helix -->
        <g transform="translate(${w*0.18},${h*0.1})">
          ${Array.from({length:7},(_,i)=>`
            <ellipse cx="${20+i%2*10}" cy="${i*22}" rx="${16-i%2*6}" ry="6"
              fill="none" stroke="${i%2===0?'#4ade80':'#86efac'}" stroke-width="2" opacity=".8">
              <animateTransform attributeName="transform" type="translate"
                values="0 0;0 -40;0 0" dur="${2+i*0.15}s" repeatCount="indefinite"/>
            </ellipse>
            <line x1="14" y1="${i*22}" x2="26" y2="${i*22}"
              stroke="#16a34a" stroke-width="1.5" opacity=".4"/>
          `).join('')}
        </g>
        <!-- Cell -->
        <g transform="translate(${w*0.6},${h*0.5})">
          <ellipse rx="52" ry="44" fill="#dcfce7" stroke="#16a34a" stroke-width="1.8">
            <animate attributeName="rx" values="52;56;52" dur="3s" repeatCount="indefinite"/>
            <animate attributeName="ry" values="44;48;44" dur="3s" repeatCount="indefinite"/>
          </ellipse>
          <!-- Nucleus -->
          <ellipse rx="18" ry="15" fill="#86efac" stroke="#15803d" stroke-width="1.5"/>
          <!-- Organelles -->
          <ellipse cx="-22" cy="-15" rx="9" ry="5" fill="#a7f3d0" stroke="#059669" stroke-width="1" transform="rotate(-30 -22 -15)"/>
          <ellipse cx="20" cy="18" rx="7" ry="4" fill="#a7f3d0" stroke="#059669" stroke-width="1" transform="rotate(20 20 18)"/>
          <circle cx="-28" cy="18" r="5" fill="#6ee7b7" stroke="#059669" stroke-width="1"/>
        </g>
      </svg>`
    };
  },

  chemistry(w=320, h=200) {
    return {
      cls: 'anim-science',
      svg: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <!-- Central atom -->
        <g transform="translate(${w/2},${h/2})">
          <circle r="18" fill="#0ea5e9" stroke="#0c4a6e" stroke-width="1.8"/>
          <text x="0" y="5" text-anchor="middle" fill="#fff" font-size="11" font-weight="700" font-family="DM Sans,sans-serif">C</text>
          <!-- Orbiting electrons -->
          ${[0,60,120,180,240,300].map((angle,i)=>`
            <g transform="rotate(${angle})">
              <ellipse rx="${28+i%2*8}" ry="${14+i%2*4}" fill="none"
                stroke="#7dd3fc" stroke-width="1" stroke-dasharray="3 2" opacity=".5"/>
              <circle r="5" fill="#38bdf8" cx="${28+i%2*8}" cy="0">
                <animateTransform attributeName="transform" type="rotate"
                  from="${angle} 0 0" to="${angle+360} 0 0" dur="${1.8+i*0.3}s" repeatCount="indefinite"/>
              </circle>
            </g>
          `).join('')}
        </g>
        <!-- Satellite atoms -->
        ${[[-80,30,'H','#fbbf24'],[ 80,30,'O','#f87171'],[-60,-55,'N','#a78bfa'],[70,-50,'H','#fbbf24']].map(([x,y,l,c])=>`
          <g transform="translate(${w/2+x},${h/2+y})">
            <circle r="13" fill="${c}" stroke="#1c1917" stroke-width="1.2" opacity=".85"/>
            <text x="0" y="4" text-anchor="middle" fill="#1c1917" font-size="9" font-weight="700" font-family="DM Sans,sans-serif">${l}</text>
          </g>
          <line x1="${w/2}" y1="${h/2}" x2="${w/2+x}" y2="${h/2+y}"
            stroke="rgba(28,25,23,.18)" stroke-width="1.5" stroke-dasharray="4 3"/>
        `).join('')}
      </svg>`
    };
  },

  math(w=320, h=200) {
    return {
      cls: 'anim-math',
      svg: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <!-- Coordinate axes -->
        <line x1="40" y1="${h-30}" x2="${w-20}" y2="${h-30}" stroke="#1c1917" stroke-width="1.5" opacity=".3"/>
        <line x1="60" y1="15" x2="60" y2="${h-20}" stroke="#1c1917" stroke-width="1.5" opacity=".3"/>
        <!-- Sine curve -->
        <path d="M60,${h/2} Q85,${h*0.2} 110,${h/2} Q135,${h*0.8} 160,${h/2} Q185,${h*0.2} 210,${h/2} Q235,${h*0.8} 260,${h/2} Q285,${h*0.2} ${w-10},${h/2}"
          stroke="#8b5cf6" stroke-width="2.5" fill="none" opacity=".8" stroke-linecap="round">
          <animate attributeName="d"
            values="M60,${h/2} Q85,${h*0.2} 110,${h/2} Q135,${h*0.8} 160,${h/2} Q185,${h*0.2} 210,${h/2} Q235,${h*0.8} 260,${h/2} Q285,${h*0.2} ${w-10},${h/2};
                    M60,${h/2} Q85,${h*0.8} 110,${h/2} Q135,${h*0.2} 160,${h/2} Q185,${h*0.8} 210,${h/2} Q235,${h*0.2} 260,${h/2} Q285,${h*0.8} ${w-10},${h/2};
                    M60,${h/2} Q85,${h*0.2} 110,${h/2} Q135,${h*0.8} 160,${h/2} Q185,${h*0.2} 210,${h/2} Q235,${h*0.8} 260,${h/2} Q285,${h*0.2} ${w-10},${h/2}"
            dur="3s" repeatCount="indefinite"/>
        </path>
        <!-- Parabola -->
        <path d="M80,${h-35} Q${w/2},25 ${w-50},${h-35}"
          stroke="#c084fc" stroke-width="2" fill="none" opacity=".5" stroke-dasharray="6 4"/>
        <!-- Geometric shapes -->
        <polygon points="${w-70},${h*0.15} ${w-40},${h*0.55} ${w-100},${h*0.55}"
          fill="#ede9fe" stroke="#7c3aed" stroke-width="1.5" opacity=".6">
          <animateTransform attributeName="transform" type="rotate"
            from="0 ${w-70} ${h*0.35}" to="360 ${w-70} ${h*0.35}" dur="8s" repeatCount="indefinite"/>
        </polygon>
        <!-- π symbol -->
        <text x="68" y="145" fill="#8b5cf6" font-size="22" font-family="Georgia,serif" opacity=".25">π</text>
        <text x="88" y="100" fill="#a78bfa" font-size="16" font-family="Georgia,serif" opacity=".3">∫</text>
        <text x="230" y="155" fill="#8b5cf6" font-size="13" font-family="Georgia,serif" opacity=".22">∑</text>
      </svg>`
    };
  },

  cs(w=320, h=200) {
    return {
      cls: 'anim-cs',
      svg: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <!-- Binary tree -->
        <!-- Root -->
        <circle cx="${w/2}" cy="28" r="14" fill="#10b981" stroke="#064e3b" stroke-width="1.5"/>
        <text x="${w/2}" y="33" text-anchor="middle" fill="#fff" font-size="10" font-weight="700" font-family="monospace">1</text>
        <!-- Level 2 -->
        ${[[w/2-60,78,'0'],[w/2+60,78,'1']].map(([x,y,v])=>`
          <line x1="${w/2}" y1="42" x2="${x}" y2="${y-14}" stroke="#34d399" stroke-width="1.5" opacity=".6"/>
          <circle cx="${x}" cy="${y}" r="13" fill="#34d399" stroke="#065f46" stroke-width="1.5"/>
          <text x="${x}" y="${y+4}" text-anchor="middle" fill="#fff" font-size="10" font-weight="700" font-family="monospace">${v}</text>
        `).join('')}
        <!-- Level 3 -->
        ${[[w/2-90,128,'0'],[w/2-30,128,'1'],[w/2+30,128,'0'],[w/2+90,128,'1']].map(([x,y,v],i)=>`
          <line x1="${i<2?w/2-60:w/2+60}" y1="${78+13}" x2="${x}" y2="${y-12}" stroke="#6ee7b7" stroke-width="1.2" opacity=".5"/>
          <circle cx="${x}" cy="${y}" r="11" fill="#6ee7b7" stroke="#047857" stroke-width="1.2">
            <animate attributeName="r" values="11;13;11" dur="${1.5+i*0.2}s" repeatCount="indefinite"/>
          </circle>
          <text x="${x}" y="${y+4}" text-anchor="middle" fill="#064e3b" font-size="9" font-weight="700" font-family="monospace">${v}</text>
        `).join('')}
        <!-- Code lines decoration -->
        ${[0,1,2,3].map(i=>`
          <rect x="${w-80}" y="${30+i*22}" width="${30+i%3*15}" height="6" rx="3"
            fill="#a7f3d0" opacity="${0.3+i*0.1}">
            <animate attributeName="width" values="${30+i%3*15};${45+i%3*10};${30+i%3*15}"
              dur="${2+i*0.4}s" repeatCount="indefinite"/>
          </rect>
        `).join('')}
        <!-- Cursor blink -->
        <rect x="${w-85}" y="${30+4*22}" width="8" height="6" rx="1" fill="#10b981">
          <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/>
        </rect>
      </svg>`
    };
  },

  history(w=320, h=200) {
    return {
      cls: 'anim-history',
      svg: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <!-- Timeline spine -->
        <line x1="30" y1="${h/2}" x2="${w-20}" y2="${h/2}" stroke="#92400e" stroke-width="2" opacity=".4"/>
        <!-- Arrow head -->
        <polygon points="${w-20},${h/2} ${w-32},${h/2-6} ${w-32},${h/2+6}"
          fill="#92400e" opacity=".4"/>
        <!-- Events -->
        ${[
          [60,  -45, '1700s', '#fcd34d', 'Revolution'],
          [130, +45, '1850s', '#fb923c', 'Industry'],
          [200, -45, '1914',  '#f87171', 'World War'],
          [270, +45, '2000s', '#34d399', 'Digital Age'],
        ].map(([x,yOff,yr,c,label])=>`
          <line x1="${x}" y1="${h/2}" x2="${x}" y2="${h/2+yOff}" stroke="${c}" stroke-width="1.5" opacity=".6"/>
          <circle cx="${x}" cy="${h/2}" r="7" fill="${c}" stroke="#1c1917" stroke-width="1.5">
            <animate attributeName="r" values="7;9;7" dur="${2+x/100}s" repeatCount="indefinite"/>
          </circle>
          <rect x="${x-28}" y="${h/2+yOff+(yOff<0?-36:4)}" width="56" height="28"
            rx="6" fill="${c}22" stroke="${c}" stroke-width="1"/>
          <text x="${x}" y="${h/2+yOff+(yOff<0?-22:14)}" text-anchor="middle"
            fill="#1c1917" font-size="7" font-weight="700" font-family="DM Sans,sans-serif">${yr}</text>
          <text x="${x}" y="${h/2+yOff+(yOff<0?-12:24)}" text-anchor="middle"
            fill="#44403c" font-size="6.5" font-family="DM Sans,sans-serif">${label}</text>
        `).join('')}
        <!-- Hourglass -->
        <g transform="translate(${w-55},${h*0.18})">
          <polygon points="0,0 30,0 15,20" fill="#fde68a" stroke="#92400e" stroke-width="1.2" opacity=".7"/>
          <polygon points="15,20 0,40 30,40" fill="#fde68a" stroke="#92400e" stroke-width="1.2" opacity=".7"/>
          <circle cx="15" cy="20" r="3" fill="#d97706" opacity=".6">
            <animate attributeName="cy" values="5;20;35" dur="2.5s" repeatCount="indefinite"/>
          </circle>
        </g>
      </svg>`
    };
  },

  economics(w=320, h=200) {
    return {
      cls: 'anim-default',
      svg: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <!-- Bar chart -->
        ${[40,80,55,95,70,110,85].map((bh,i)=>`
          <rect x="${28+i*36}" y="${h-25-bh}" width="22" height="${bh}" rx="4"
            fill="${i===5?'#1c1917':'#fde047'}"
            stroke="#1c1917" stroke-width="1.2">
            <animate attributeName="height" values="0;${bh}" dur="${0.6+i*0.1}s" fill="freeze"
              calcMode="spline" keySplines="0 0 0.2 1"/>
            <animate attributeName="y" values="${h-25};${h-25-bh}" dur="${0.6+i*0.1}s" fill="freeze"
              calcMode="spline" keySplines="0 0 0.2 1"/>
          </rect>
        `).join('')}
        <!-- Trend line -->
        <polyline points="39,${h-60} 75,${h-75} 111,${h-50} 147,${h-90} 183,${h-65} 219,${h-105} 255,${h-80}"
          stroke="#ef4444" stroke-width="2" fill="none" stroke-dasharray="5 3" opacity=".7"/>
        <!-- X axis -->
        <line x1="20" y1="${h-25}" x2="${w-10}" y2="${h-25}" stroke="#1c1917" stroke-width="1.5" opacity=".3"/>
        <!-- $ symbol -->
        <text x="${w-38}" y="38" fill="#1c1917" font-size="28" font-family="Fraunces,Georgia,serif" font-weight="400" opacity=".1">$</text>
      </svg>`
    };
  },

  psych(w=320, h=200) {
    return {
      cls: 'anim-adhd',
      svg: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <!-- Brain outline -->
        <g transform="translate(${w/2},${h/2-5}) scale(0.85)">
          <path d="M-30,-55 Q-60,-65 -65,-40 Q-80,-20 -65,0 Q-70,20 -55,35 Q-40,55 -10,55
            Q5,70 20,65 Q35,72 50,58 Q70,52 72,32 Q85,15 75,-5 Q80,-30 65,-48
            Q45,-68 20,-62 Q5,-70 -10,-65 Z"
            fill="#bbf7d0" stroke="#15803d" stroke-width="2" opacity=".8">
            <animate attributeName="d"
              values="M-30,-55 Q-60,-65 -65,-40 Q-80,-20 -65,0 Q-70,20 -55,35 Q-40,55 -10,55 Q5,70 20,65 Q35,72 50,58 Q70,52 72,32 Q85,15 75,-5 Q80,-30 65,-48 Q45,-68 20,-62 Q5,-70 -10,-65 Z;
                      M-30,-55 Q-62,-67 -65,-40 Q-82,-22 -67,2 Q-70,22 -55,37 Q-40,55 -10,55 Q5,70 20,65 Q35,72 50,58 Q70,52 72,32 Q85,15 75,-5 Q80,-30 65,-48 Q45,-68 20,-62 Q5,-70 -10,-65 Z;
                      M-30,-55 Q-60,-65 -65,-40 Q-80,-20 -65,0 Q-70,20 -55,35 Q-40,55 -10,55 Q5,70 20,65 Q35,72 50,58 Q70,52 72,32 Q85,15 75,-5 Q80,-30 65,-48 Q45,-68 20,-62 Q5,-70 -10,-65 Z"
              dur="4s" repeatCount="indefinite"/>
          </path>
          <!-- Neuron connections -->
          ${[[-30,-20],[10,-35],[40,0],[15,30],[-25,25]].map(([x,y],i)=>`
            <circle cx="${x}" cy="${y}" r="6" fill="#4ade80" stroke="#15803d" stroke-width="1.2">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="${1.5+i*0.3}s" repeatCount="indefinite"/>
            </circle>
            <line x1="0" y1="0" x2="${x}" y2="${y}" stroke="#86efac" stroke-width="1" opacity=".5"/>
          `).join('')}
          <!-- Center node -->
          <circle r="10" fill="#16a34a" stroke="#14532d" stroke-width="1.5">
            <animate attributeName="r" values="10;13;10" dur="2s" repeatCount="indefinite"/>
          </circle>
        </g>
      </svg>`
    };
  },

  default(w=320, h=200) {
    const nodes = [
      [w/2,   h/2,   'Core',   22, '#fde047'],
      [w/2-90,h/2-30,'Concept',14, '#fff'],
      [w/2+85,h/2-40,'Idea',   14, '#fff'],
      [w/2-70,h/2+55,'Method', 13, '#fff'],
      [w/2+75,h/2+50,'Result', 13, '#fff'],
      [w/2,   h/2-75,'Theory', 12, '#ffccd5'],
    ];
    const edges = [[0,1],[0,2],[0,3],[0,4],[0,5],[1,3],[2,4]];
    return {
      cls: 'anim-default',
      svg: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        ${edges.map(([a,b])=>`
          <line x1="${nodes[a][0]}" y1="${nodes[a][1]}"
                x2="${nodes[b][0]}" y2="${nodes[b][1]}"
                stroke="rgba(28,25,23,.15)" stroke-width="1.5"/>
        `).join('')}
        ${nodes.map(([x,y,label,r,fill],i)=>`
          <circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"
            stroke="#1c1917" stroke-width="${i===0?2:1.2}">
            <animateTransform attributeName="transform" type="translate"
              values="0 0;0 ${i%2===0?-6:6};0 0" dur="${2+i*0.4}s" repeatCount="indefinite"
              calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
          </circle>
          <text x="${x}" y="${y+4}" text-anchor="middle" fill="#1c1917"
            font-size="${i===0?9:7}" font-weight="${i===0?700:600}"
            font-family="DM Sans,sans-serif">${label}</text>
        `).join('')}
      </svg>`
    };
  },
};

function renderTopicAnim(topicName, w=320, h=200) {
  const key = getTopicAnimKey(topicName);
  const renderer = ANIM_RENDERERS[key] || ANIM_RENDERERS.default;
  return renderer(w, h);
}

// ── LEARNER TYPE VISUAL DEFINITIONS ─────────────────────────────────────────
const LEARNER_TYPES = [
  {
    key: 'visual',
    name: 'Visual Learner',
    desc: 'Concept maps and diagrams alongside every summary',
    color: '#fde047', cls: 'anim-visual', mode: 'mode-visual',
    icon: '◈',
    anim: (w,h) => ANIM_RENDERERS.default(w,h),
  },
  {
    key: 'adhd',
    name: 'ADHD',
    desc: 'Bite-sized chunks, progress dots, and kinetic animations',
    color: '#86efac', cls: 'anim-adhd', mode: 'mode-adhd',
    icon: '⚡',
    anim: (w,h) => ({
      cls: 'anim-adhd',
      svg: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <!-- Progress chunks -->
        ${[0,1,2,3,4].map(i=>`
          <rect x="${20+i*52}" y="${h*0.3}" width="38" height="38" rx="10"
            fill="${i<3?'#4ade80':'#f0fdf4'}" stroke="#16a34a" stroke-width="1.5" opacity="${i<3?1:.5}">
            ${i<3?`<animate attributeName="fill" values="#4ade80;#86efac;#4ade80" dur="${1.5+i*0.3}s" repeatCount="indefinite"/>`:''}
          </rect>
          ${i<3?`<text x="${20+i*52+19}" y="${h*0.3+24}" text-anchor="middle" fill="#fff" font-size="16" font-family="DM Sans,sans-serif">✓</text>`:''}
        `).join('')}
        <!-- Bounce ball -->
        <circle cx="${w*0.5}" cy="${h*0.75}" r="10" fill="#fbbf24" stroke="#1c1917" stroke-width="1.5">
          <animate attributeName="cy" values="${h*0.75};${h*0.5};${h*0.75}" dur="1.2s" repeatCount="indefinite"
            calcMode="spline" keySplines="0.2 0.8 0.8 0.2;0.2 0.8 0.8 0.2"/>
          <animate attributeName="rx" values="10;14;10;14;10" dur="1.2s" repeatCount="indefinite"/>
        </circle>
        <!-- Streak indicator -->
        <text x="${w/2}" y="${h*0.9}" text-anchor="middle" fill="#1c1917" font-size="10" font-weight="700"
          font-family="DM Sans,sans-serif" opacity=".5">🔥 3 day streak</text>
      </svg>`
    }),
  },
  {
    key: 'dyslexia',
    name: 'Dyslexia',
    desc: 'High contrast, generous spacing, and colour-coded text',
    color: '#93c5fd', cls: 'anim-dyslexia', mode: 'mode-dyslexia',
    icon: '◎',
    anim: (w,h) => ({
      cls: 'anim-dyslexia',
      svg: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <!-- Colour-coded text lines -->
        ${['#3b82f6','#8b5cf6','#10b981','#f59e0b','#ef4444'].map((c,i)=>`
          <rect x="30" y="${25+i*28}" width="${80+i%2*60}" height="14" rx="7" fill="${c}" opacity=".7">
            <animate attributeName="width" values="${80+i%2*60};${100+i%2*40};${80+i%2*60}"
              dur="${2.5+i*0.2}s" repeatCount="indefinite"/>
          </rect>
        `).join('')}
        <!-- Large readable letter -->
        <text x="${w*0.75}" y="${h*0.62}" text-anchor="middle"
          fill="#1d4ed8" font-size="80" font-family="Georgia,serif" opacity=".12" font-weight="700">A</text>
        <!-- Tracking guide line -->
        <line x1="20" y1="${h*0.72}" x2="${w-20}" y2="${h*0.72}"
          stroke="#bfdbfe" stroke-width="3" stroke-linecap="round">
          <animate attributeName="y1" values="${h*0.72};${h*0.55};${h*0.72}" dur="4s" repeatCount="indefinite"/>
          <animate attributeName="y2" values="${h*0.72};${h*0.55};${h*0.72}" dur="4s" repeatCount="indefinite"/>
        </line>
      </svg>`
    }),
  },
  {
    key: 'autism',
    name: 'Autism Spectrum',
    desc: 'Predictable grids, muted palette, and structured layouts',
    color: '#d8b4fe', cls: 'anim-autism', mode: 'mode-autism',
    icon: '▦',
    anim: (w,h) => ({
      cls: 'anim-autism',
      svg: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <!-- Predictable grid -->
        ${Array.from({length:4},(_,row)=>
          Array.from({length:5},(_,col)=>`
            <rect x="${28+col*54}" y="${20+row*42}" width="40" height="32" rx="6"
              fill="${(row+col)%3===0?'#ede9fe':(row+col)%3===1?'#ddd6fe':'#f5f3ff'}"
              stroke="#7c3aed" stroke-width="1" opacity="${0.4+((row+col)%3)*0.2}">
              <animate attributeName="opacity"
                values="${0.4+((row+col)%3)*0.2};${0.7+((row+col)%3)*0.15};${0.4+((row+col)%3)*0.2}"
                dur="${3+row*0.5}s" repeatCount="indefinite"/>
            </rect>
          `).join('')
        ).join('')}
      </svg>`
    }),
  },
  {
    key: 'auditory',
    name: 'Auditory Learner',
    desc: 'Waveform visualisations and prominent text-to-speech',
    color: '#fda4af', cls: 'anim-auditory', mode: 'mode-auditory',
    icon: '♪',
    anim: (w,h) => ({
      cls: 'anim-auditory',
      svg: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <!-- Sound bars equaliser -->
        ${[18,30,48,22,40,55,32,20,44,28,50,35,25,42,30].map((bh,i)=>`
          <rect x="${18+i*19}" y="${h/2-bh/2}" width="12" height="${bh}" rx="6"
            fill="${i%3===0?'#fb7185':i%3===1?'#f43f5e':'#fda4af'}" opacity=".8">
            <animate attributeName="height"
              values="${bh};${bh*1.8};${bh*0.5};${bh}"
              dur="${0.8+i%4*0.2}s" repeatCount="indefinite"
              calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"/>
            <animate attributeName="y"
              values="${h/2-bh/2};${h/2-bh*0.9};${h/2-bh*0.25};${h/2-bh/2}"
              dur="${0.8+i%4*0.2}s" repeatCount="indefinite"
              calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"/>
          </rect>
        `).join('')}
        <!-- Speaker icon -->
        <g transform="translate(${w-45},${h-42})" opacity=".3">
          <path d="M0,12 L8,12 L16,4 L16,28 L8,20 L0,20 Z" fill="#1c1917"/>
          <path d="M20,8 Q28,16 20,24" stroke="#1c1917" stroke-width="2" fill="none" stroke-linecap="round"/>
          <path d="M23,4 Q36,16 23,28" stroke="#1c1917" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        </g>
      </svg>`
    }),
  },
  {
    key: 'verbal',
    name: 'Verbal Learner',
    desc: 'Definition tooltips, word clouds, and rich typographic detail',
    color: '#fde68a', cls: 'anim-verbal', mode: 'mode-verbal',
    icon: 'Aa',
    anim: (w,h) => ({
      cls: 'anim-verbal',
      svg: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <!-- Word cloud -->
        ${[
          [w/2,   h/2,   'Concept',  18, '#1c1917', 1],
          [w/2-75,h/2-20,'Define',   12, '#44403c', 0.8],
          [w/2+65,h/2+15,'Explain',  11, '#78716c', 0.7],
          [w/2-50,h/2+40,'Context',  10, '#44403c', 0.75],
          [w/2+40,h/2-40,'Theory',   10, '#78716c', 0.65],
          [w/2-80,h/2+60,'Meaning',  8,  '#a8a29e', 0.6],
          [w/2+80,h/2+55,'Analyse',  8,  '#a8a29e', 0.55],
          [w/2,   h/2-65,'Language', 9,  '#78716c', 0.7],
          [w/2-20,h/2+75,'Narrate',  8,  '#a8a29e', 0.5],
        ].map(([x,y,word,size,color,op],i)=>`
          <text x="${x}" y="${y}" text-anchor="middle" fill="${color}" font-size="${size}"
            font-family="Fraunces,Georgia,serif" opacity="${op}" font-weight="${i<2?600:400}">
            <animate attributeName="opacity" values="${op};${Math.min(op+0.3,1)};${op}"
              dur="${2.5+i*0.3}s" repeatCount="indefinite"/>
            ${word}
          </text>
        `).join('')}
        <!-- Underline decoration -->
        <line x1="${w/2-38}" y1="${h/2+6}" x2="${w/2+38}" y2="${h/2+6}"
          stroke="#fde047" stroke-width="3" stroke-linecap="round" opacity=".6"/>
      </svg>`
    }),
  },
  {
    key: 'kinaesthetic',
    name: 'Kinaesthetic',
    desc: 'Interactive drag-and-drop, hands-on practice questions',
    color: '#6ee7b7', cls: 'anim-kinaesthetic', mode: 'mode-kinaesthetic',
    icon: '✦',
    anim: (w,h) => ({
      cls: 'anim-kinaesthetic',
      svg: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <!-- Drag cards -->
        ${[
          [w/2-80, h/2-30, '#bbf7d0', 'Drag me', -6],
          [w/2+10, h/2-50, '#fde68a', 'Sort me', 4],
          [w/2-30, h/2+35, '#fda4af', 'Match me', -3],
        ].map(([x,y,fill,label,rot])=>`
          <rect x="${x}" y="${y}" width="80" height="44" rx="10"
            fill="${fill}" stroke="#1c1917" stroke-width="1.5"
            transform="rotate(${rot} ${x+40} ${y+22})">
            <animate attributeName="transform"
              values="rotate(${rot} ${x+40} ${y+22});rotate(${rot+3} ${x+40} ${y+22});rotate(${rot} ${x+40} ${y+22})"
              dur="${2+Math.abs(rot)*0.3}s" repeatCount="indefinite"/>
          </rect>
          <text x="${x+40}" y="${y+26}" text-anchor="middle" fill="#1c1917"
            font-size="10" font-weight="700" font-family="DM Sans,sans-serif"
            transform="rotate(${rot} ${x+40} ${y+22})">${label}</text>
        `).join('')}
        <!-- Hand cursor -->
        <g transform="translate(${w-65},${h-55})" opacity=".4">
          <path d="M10,0 Q10,20 10,28 L4,28 Q2,28 2,24 L2,14 Q2,12 4,12 L6,12 L6,4 Q6,0 10,0 Z" fill="#1c1917"/>
          <path d="M10,14 L16,14 Q18,14 18,18 L18,28" stroke="#1c1917" stroke-width="2" fill="none"/>
          <path d="M18,16 L22,16 Q24,16 24,20 L24,28" stroke="#1c1917" stroke-width="2" fill="none"/>
        </g>
      </svg>`
    }),
  },
  {
    key: 'non-native',
    name: 'Non-Native Speaker',
    desc: 'One-click translation, simplified phrasing, language badges',
    color: '#a5f3fc', cls: 'anim-nonnative', mode: 'mode-nonnative',
    icon: '🌐',
    anim: (w,h) => ({
      cls: 'anim-nonnative',
      svg: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <!-- Globe -->
        <g transform="translate(${w/2},${h/2})">
          <circle r="58" fill="#cffafe" stroke="#0e7490" stroke-width="1.5">
            <animate attributeName="r" values="58;61;58" dur="3s" repeatCount="indefinite"/>
          </circle>
          <!-- Meridians -->
          <ellipse rx="30" ry="58" fill="none" stroke="#67e8f9" stroke-width="1.2" opacity=".7"/>
          <ellipse rx="55" ry="25" fill="none" stroke="#67e8f9" stroke-width="1" opacity=".5"/>
          <line x1="-58" y1="0" x2="58" y2="0" stroke="#67e8f9" stroke-width="1" opacity=".5"/>
          <ellipse rx="58" ry="20" fill="none" stroke="#67e8f9" stroke-width=".8" opacity=".3" transform="rotate(30)"/>
        </g>
        <!-- Language labels -->
        ${[[-80,-55,'Hindi','#f59e0b'],[60,-48,'Español','#ef4444'],[75,42,'Français','#3b82f6'],[-90,50,'中文','#8b5cf6']].map(([x,y,lang,c])=>`
          <rect x="${w/2+x-18}" y="${h/2+y-11}" width="${lang.length*7+12}" height="18" rx="9"
            fill="${c}22" stroke="${c}" stroke-width="1.2"/>
          <text x="${w/2+x+lang.length*3.5}" y="${h/2+y+2}" text-anchor="middle"
            fill="${c}" font-size="8" font-weight="700" font-family="DM Sans,sans-serif">${lang}</text>
        `).join('')}
      </svg>`
    }),
  },
  {
    key: 'reading',
    name: 'Reading / Writing',
    desc: 'Notebook-style notes, highlight mode, annotated summaries',
    color: '#e2e8f0', cls: 'anim-readwrite', mode: 'mode-readwrite',
    icon: '✎',
    anim: (w,h) => ({
      cls: 'anim-readwrite',
      svg: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <!-- Notebook -->
        <rect x="40" y="15" width="${w-80}" height="${h-30}" rx="10"
          fill="#fff" stroke="#cbd5e1" stroke-width="1.5"/>
        <!-- Spine -->
        <rect x="40" y="15" width="18" height="${h-30}" rx="10" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1.2"/>
        <!-- Ruled lines -->
        ${Array.from({length:6},(_,i)=>`
          <line x1="72" y1="${45+i*22}" x2="${w-50}" y2="${45+i*22}"
            stroke="#e2e8f0" stroke-width="1"/>
        `).join('')}
        <!-- Animated writing -->
        <path d="M72,45 Q110,45 150,45" stroke="#1c1917" stroke-width="2"
          stroke-linecap="round" stroke-dasharray="200" stroke-dashoffset="200">
          <animate attributeName="stroke-dashoffset" values="200;0" dur="2s" repeatCount="indefinite" fill="freeze"/>
        </path>
        <path d="M72,67 Q100,67 128,67" stroke="#94a3b8" stroke-width="1.5"
          stroke-linecap="round" stroke-dasharray="150" stroke-dashoffset="150">
          <animate attributeName="stroke-dashoffset" values="150;0" dur="1.8s" begin="0.5s" repeatCount="indefinite" fill="freeze"/>
        </path>
        <!-- Highlight -->
        <rect x="72" y="87" width="90" height="10" rx="5"
          fill="#fde047" opacity=".6">
          <animate attributeName="width" values="0;90" dur="1.5s" begin="1s" repeatCount="indefinite" fill="freeze"/>
        </rect>
        <!-- Pencil -->
        <g transform="translate(${w-80},${h-55}) rotate(-35)">
          <rect x="0" y="0" width="10" height="40" rx="2" fill="#fde68a" stroke="#92400e" stroke-width="1"/>
          <polygon points="0,40 10,40 5,52" fill="#92400e"/>
          <rect x="0" y="0" width="10" height="8" rx="2" fill="#f87171"/>
        </g>
      </svg>`
    }),
  },
  {
    key: 'dyscalculia',
    name: 'Dyscalculia',
    desc: 'Icon-based progress bars, shapes instead of numbers',
    color: '#fed7aa', cls: 'anim-dyscalculia', mode: 'mode-dyscalculia',
    icon: '◐',
    anim: (w,h) => ({
      cls: 'anim-dyscalculia',
      svg: `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
        <!-- Progress as shapes not numbers -->
        <text x="${w/2}" y="${h*0.28}" text-anchor="middle"
          fill="#44403c" font-size="11" font-weight="600" font-family="DM Sans,sans-serif" opacity=".7">Progress</text>
        <!-- Icon-based bar: stars filled -->
        ${Array.from({length:5},(_,i)=>`
          <polygon points="${50+i*50},${h*0.42} ${58+i*50},${h*0.58} ${42+i*50},${h*0.5} ${66+i*50},${h*0.5} ${50+i*50},${h*0.58}"
            fill="${i<3?'#fb923c':'#fed7aa'}" stroke="#c2410c" stroke-width="1.2">
            ${i<3?`<animate attributeName="fill" values="#fb923c;#fbbf24;#fb923c" dur="${1.5+i*0.2}s" repeatCount="indefinite"/>`:''}
          </polygon>
        `).join('')}
        <!-- "3 of 5" shown as shapes -->
        <text x="${w/2}" y="${h*0.75}" text-anchor="middle"
          fill="#1c1917" font-size="10" font-family="DM Sans,sans-serif" opacity=".5">
          ★ ★ ★ ☆ ☆
        </text>
        <!-- Big circle progress -->
        <circle cx="${w/2}" cy="${h*0.88}" r="${h*0.06}"
          fill="none" stroke="#fed7aa" stroke-width="5"/>
        <circle cx="${w/2}" cy="${h*0.88}" r="${h*0.06}"
          fill="none" stroke="#fb923c" stroke-width="5"
          stroke-dasharray="${2*Math.PI*h*0.06*0.6} ${2*Math.PI*h*0.06*0.4}"
          stroke-dashoffset="${2*Math.PI*h*0.06*0.25}"
          stroke-linecap="round"/>
      </svg>`
    }),
  },
];

// ── MAIN VIEW RENDERER ────────────────────────────────────────────────────────
let _msFilter = 'all';
let _msViewMode = 'grid';

function renderMindscape() {
  const view = document.getElementById('view-mindscape');
  if (!view) return;

  const topics = S.topics || [];

  // Build cards from topics + learner type cards
  const cards = topics.length > 0
    ? topics.map(t => _buildTopicCard(t))
    : [];

  view.innerHTML = `
    <div class="mindscape-view">
      <div class="mindscape-hero">
        <div class="mindscape-hero-text">
          <h2>Mindscape <em>Visual Gallery</em></h2>
          <p>Every topic, rendered for <em>your</em> learning style. Animated. Intuitive. Yours.</p>
        </div>
        <div class="mindscape-controls">
          <div class="view-mode-btns">
            <button class="view-mode-btn ${_msViewMode==='grid'?'active':''}" title="Grid" onclick="setMsView('grid',this)">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="0" y="0" width="6" height="6" rx="1"/><rect x="8" y="0" width="6" height="6" rx="1"/>
                <rect x="0" y="8" width="6" height="6" rx="1"/><rect x="8" y="8" width="6" height="6" rx="1"/>
              </svg>
            </button>
            <button class="view-mode-btn ${_msViewMode==='2col'?'active':''}" title="2 Column" onclick="setMsView('2col',this)">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="0" y="0" width="5.5" height="14" rx="1"/><rect x="8.5" y="0" width="5.5" height="14" rx="1"/>
              </svg>
            </button>
            <button class="view-mode-btn ${_msViewMode==='list'?'active':''}" title="List" onclick="setMsView('list',this)">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                <rect x="0" y="0" width="14" height="3" rx="1.5"/><rect x="0" y="5.5" width="14" height="3" rx="1.5"/>
                <rect x="0" y="11" width="14" height="3" rx="1.5"/>
              </svg>
            </button>
          </div>
          <button class="multi-panel-toggle" id="splitPanelBtn" onclick="toggleSplitPanel()">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="1" y="1" width="12" height="12" rx="2"/>
              <line x1="7" y1="1" x2="7" y2="13"/>
            </svg>
            Split view
          </button>
        </div>
      </div>

      ${topics.length === 0
        ? `<div class="mindscape-empty">
            <svg width="56" height="56" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 12h8M12 8v8"/>
            </svg>
            <div class="mindscape-empty-title">No materials yet</div>
            <div class="mindscape-empty-sub">Upload a PDF first — Mindscape will build a visual gallery for every topic it finds.</div>
            <button class="btn btn-dark" onclick="navigate('upload')">Upload PDF &rarr;</button>
          </div>`
        : `<div class="visual-gallery view-${_msViewMode}" id="visualGallery">
            ${cards.join('')}
          </div>`
      }
    </div>
  `;
}

function _buildTopicCard(topic) {
  const { svg, cls } = renderTopicAnim(topic.name, 320, 200);
  const animKey = getTopicAnimKey(topic.name);
  const coverage = Math.round((topic.coverage || 0) * 100);
  const learnerMode = _getCurrentLearnerMode();
  return `
    <div class="visual-card" onclick="openVisualModal('${topic.id}','${_esc(topic.name)}')">
      <div class="visual-card-canvas ${cls}">${svg}</div>
      <div class="visual-card-body">
        <div class="visual-card-tag">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4"/></svg>
          ${animKey.toUpperCase()}
        </div>
        <div class="visual-card-title">${_esc(topic.name)}</div>
        <div class="visual-card-sub">Tap to explore the visual explainer for this topic</div>
      </div>
      <div class="visual-card-footer">
        <div class="visual-learner-badge">${learnerMode ? learnerMode.icon : '◈'} ${learnerMode ? learnerMode.name : 'Visual'}</div>
        <button class="btn btn-sm" onclick="event.stopPropagation();quizFromVisual('${topic.id}')">Quiz &rarr;</button>
      </div>
    </div>
  `;
}

function _getCurrentLearnerMode() {
  const types = S.user?.learner_types || [];
  if (!types.length) return LEARNER_TYPES.find(l=>l.key==='visual');
  return LEARNER_TYPES.find(l => types.includes(l.key)) || LEARNER_TYPES[0];
}

function setMsView(mode) {
  _msViewMode = mode;
  const gallery = document.getElementById('visualGallery');
  if (!gallery) return;
  gallery.className = `visual-gallery view-${mode}`;
  document.querySelectorAll('.view-mode-btn').forEach(b => b.classList.remove('active'));
  event.currentTarget.classList.add('active');
}

// ── SPLIT PANEL ───────────────────────────────────────────────────────────────
let _splitPanelActive = false;

function toggleSplitPanel() {
  _splitPanelActive = !_splitPanelActive;
  const btn = document.getElementById('splitPanelBtn');
  if (btn) btn.classList.toggle('active', _splitPanelActive);

  const appShell = document.getElementById('appShell');
  if (!appShell) return;

  if (_splitPanelActive) {
    _activateSplitPanel();
  } else {
    _deactivateSplitPanel();
  }
}

function _activateSplitPanel() {
  // Wrap the active view in a split container
  const activeView = document.querySelector('.view.active');
  if (!activeView) return;

  const container = document.createElement('div');
  container.className = 'split-panel-container';
  container.id = 'splitContainer';

  const primary = document.createElement('div');
  primary.className = 'split-panel-primary';

  const handle = document.createElement('div');
  handle.className = 'split-panel-handle';

  const secondary = document.createElement('div');
  secondary.className = 'split-panel-secondary';
  secondary.id = 'splitSecondary';
  secondary.innerHTML = _buildMiniMindscape();

  // Move active view into primary
  activeView.parentNode.insertBefore(container, activeView);
  primary.appendChild(activeView);
  container.appendChild(primary);
  container.appendChild(handle);
  container.appendChild(secondary);

  // Add resize handle
  _addResizeHandle(handle, primary, secondary);
}

function _deactivateSplitPanel() {
  const container = document.getElementById('splitContainer');
  if (!container) return;
  const activeView = container.querySelector('.view.active');
  if (activeView) {
    container.parentNode.insertBefore(activeView, container);
  }
  container.remove();
}

function _addResizeHandle(handle, primary, secondary) {
  let dragging = false;
  handle.addEventListener('mousedown', () => { dragging = true; });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const containerRect = handle.parentElement.getBoundingClientRect();
    const newWidth = containerRect.right - e.clientX;
    if (newWidth > 200 && newWidth < containerRect.width * 0.6) {
      secondary.style.width = newWidth + 'px';
    }
  });
  document.addEventListener('mouseup', () => { dragging = false; });
}

function _buildMiniMindscape() {
  const topics = S.topics || [];
  if (!topics.length) {
    return `<div class="mindscape-mini">
      <div class="mindscape-mini-header">
        <div class="mindscape-mini-title">Mindscape</div>
      </div>
      <p style="font-size:.8rem;color:var(--muted2);line-height:1.65">Upload a PDF to see visual explainers here.</p>
    </div>`;
  }
  const cards = topics.slice(0, 6).map(t => {
    const { svg, cls } = renderTopicAnim(t.name, 240, 120);
    return `<div class="visual-mini-card" onclick="openVisualModal('${t.id}','${_esc(t.name)}')">
      <div class="visual-mini-canvas ${cls}">${svg}</div>
      <div class="visual-mini-body">
        <div class="visual-mini-title">${_esc(t.name)}</div>
        <div class="visual-mini-sub">Tap to expand</div>
      </div>
    </div>`;
  }).join('');
  return `<div class="mindscape-mini">
    <div class="mindscape-mini-header">
      <div class="mindscape-mini-title">Mindscape</div>
      <button class="btn btn-sm btn-yellow" onclick="navigate('mindscape')">Full view &rarr;</button>
    </div>
    ${cards}
  </div>`;
}

// ── VISUAL MODAL ──────────────────────────────────────────────────────────────
function openVisualModal(topicId, topicName) {
  const topic = (S.topics || []).find(t => t.id === topicId) || { id: topicId, name: topicName };
  const { svg, cls } = renderTopicAnim(topicName, 860, 320);

  const overlay = document.createElement('div');
  overlay.className = 'visual-modal-overlay';
  overlay.id = 'visualModalOverlay';
  overlay.onclick = e => { if (e.target === overlay) closeVisualModal(); };

  overlay.innerHTML = `
    <div class="visual-modal">
      <div class="visual-modal-header">
        <div>
          <div style="font-size:.68rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--muted2);margin-bottom:.3rem">${getTopicAnimKey(topicName).toUpperCase()} · VISUAL EXPLAINER</div>
          <div style="font-family:'Fraunces',serif;font-size:1.5rem;font-weight:400;letter-spacing:-.03em">${_esc(topicName)}</div>
        </div>
        <button class="visual-modal-close" onclick="closeVisualModal()">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
          </svg>
        </button>
      </div>
      <div class="visual-modal-canvas ${cls}">${svg}</div>
      <div class="visual-modal-body">
        <div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap;margin-bottom:1.2rem">
          ${LEARNER_TYPES.map(lt=>`
            <button class="btn btn-sm" style="font-size:.72rem" onclick="switchVisualMode('${lt.key}','${topicId}','${_esc(topicName)}')"
              title="${lt.desc}">
              ${lt.icon} ${lt.name}
            </button>
          `).join('')}
        </div>
        <div style="display:flex;gap:.75rem;padding-top:1rem;border-top:1px solid rgba(28,25,23,.07)">
          <button class="btn btn-dark" onclick="closeVisualModal();navigate('summary');selectTopicById('${topicId}')">
            Read summary &rarr;
          </button>
          <button class="btn btn-yellow" onclick="closeVisualModal();quizFromVisual('${topicId}')">
            Take quiz
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function closeVisualModal() {
  const el = document.getElementById('visualModalOverlay');
  if (el) el.remove();
}

function switchVisualMode(learnerKey, topicId, topicName) {
  const lt = LEARNER_TYPES.find(l=>l.key===learnerKey);
  if (!lt) return;
  // Update body class
  LEARNER_TYPES.forEach(l => document.body.classList.remove(l.mode));
  document.body.classList.add(lt.mode);
  // Re-render modal canvas
  const canvas = document.querySelector('.visual-modal-canvas');
  if (!canvas) return;
  const { svg, cls } = lt.anim(860, 320);
  canvas.className = `visual-modal-canvas ${cls}`;
  canvas.innerHTML = svg;
}

function quizFromVisual(topicId) {
  if (S.topics) {
    const t = S.topics.find(x=>x.id===topicId);
    if (t) S.quizSetup.topicId = topicId;
  }
  navigate('quiz');
}

function selectTopicById(topicId) {
  const items = document.querySelectorAll('.topic-item');
  items.forEach(el => {
    if (el.dataset.id === topicId) el.click();
  });
}

// ── LEARNER PROFILE APPLICATION ───────────────────────────────────────────────
function applyAllLearnerModes(types) {
  // Remove all mode classes
  LEARNER_TYPES.forEach(lt => document.body.classList.remove(lt.mode));
  if (!types || !types.length) return;
  // Apply all matching modes
  types.forEach(type => {
    const lt = LEARNER_TYPES.find(l => l.key === type ||
      (type === 'autism' && l.key === 'autism') ||
      (type === 'non-native' && l.key === 'non-native') ||
      (type === 'reading' && l.key === 'reading'));
    if (lt) document.body.classList.add(lt.mode);
  });
}

// ── LANDING PAGE LEARNER SHOWCASE ─────────────────────────────────────────────
function renderLearnerShowcase(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const cards = LEARNER_TYPES.map(lt => {
    const { svg, cls } = lt.anim(260, 140);
    return `
      <div class="learner-type-card">
        <div class="lt-canvas ${cls}">${svg}</div>
        <div class="lt-body">
          <div class="lt-name">${lt.icon} ${lt.name}</div>
          <div class="lt-desc">${lt.desc}</div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="learner-showcase-header">
      <div class="ls-label">Built for every mind</div>
      <h2>Learning that <em>adapts<br/>to you</em></h2>
      <p>EduVision detects your learning style and transforms every PDF into exactly the kind of content your brain craves.</p>
    </div>
    <div class="learner-type-grid">${cards}</div>
  `;
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function _esc(str) {
  return (str || '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

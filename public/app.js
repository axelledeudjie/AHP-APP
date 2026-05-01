const AHP_SCALE = [
  { v: 9,     d: '9',   hint: 'Extremely more important' },
  { v: 8,     d: '8',   hint: 'Between extreme and very strong' },
  { v: 7,     d: '7',   hint: 'Very strongly more important' },
  { v: 6,     d: '6',   hint: 'Between very strong and strong' },
  { v: 5,     d: '5',   hint: 'Strongly more important' },
  { v: 4,     d: '4',   hint: 'Between strong and moderate' },
  { v: 3,     d: '3',   hint: 'Moderately more important' },
  { v: 2,     d: '2',   hint: 'Between moderate and equal' },
  { v: 1,     d: '1',   hint: 'Equal importance' },
  { v: 1/2,   d: '1/2', hint: 'Between equal and moderate (inverse)' },
  { v: 1/3,   d: '1/3', hint: 'Moderately less important' },
  { v: 1/4,   d: '1/4', hint: 'Between moderate and strong (inverse)' },
  { v: 1/5,   d: '1/5', hint: 'Strongly less important' },
  { v: 1/6,   d: '1/6', hint: 'Between strong and very strong (inverse)' },
  { v: 1/7,   d: '1/7', hint: 'Very strongly less important' },
  { v: 1/8,   d: '1/8', hint: 'Between very strong and extreme (inverse)' },
  { v: 1/9,   d: '1/9', hint: 'Extremely less important' },
];

const state = {
  criteria: [],      // [{name, type, scale:[]}]
  alternatives: [],  // [string]
  scores: [],        // [altIdx][critIdx] = value
  matrix: []         // [i][j] = AHP value (upper triangle, rest inferred)
};

function goTo(step) {
  document.querySelectorAll('.step-section').forEach(s => s.classList.add('hidden'));
  document.getElementById(`sec-${step}`).classList.remove('hidden');
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`prog-${i}`);
    el.classList.remove('active', 'done');
    if (i < step) el.classList.add('done');
    if (i === step) el.classList.add('active');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showErr(sectionId, msg) {
  document.querySelectorAll(`#${sectionId} .error-msg`).forEach(e => e.remove());
  if (!msg) return;
  const div = document.createElement('div');
  div.className = 'error-msg';
  div.textContent = msg;
  document.querySelector(`#${sectionId} .step-nav`).before(div);
}

function renderCriteria() {
  const wrap = document.getElementById('criteria-wrap');
  wrap.innerHTML = '';
  state.criteria.forEach((c, idx) => {
    const card = document.createElement('div');
    card.className = 'crit-card';
    card.innerHTML = `
      <div class="crit-header">
        <div class="crit-num">${idx + 1}</div>
        <h3>Criterion ${idx + 1}</h3>
      </div>
      ${state.criteria.length > 1
        ? `<button class="rm-btn" onclick="removeCrit(${idx})" title="Remove">×</button>`
        : ''}
      <div class="crit-row">
        <div class="form-group">
          <label>Name</label>
          <input type="text" value="${esc(c.name)}" placeholder="e.g. Price, Speed, Quality"
            oninput="state.criteria[${idx}].name = this.value">
        </div>
        <div class="form-group">
          <label>Type</label>
          <select onchange="changeCritType(${idx}, this.value)">
            <option value="numerical"   ${c.type === 'numerical'   ? 'selected' : ''}>Numerical</option>
            <option value="categorical" ${c.type === 'categorical' ? 'selected' : ''}>Categorical</option>
          </select>
        </div>
      </div>
      ${c.type === 'categorical' ? renderScaleEditor(idx, c.scale) : ''}
    `;
    wrap.appendChild(card);
  });
}

function renderScaleEditor(idx, scale) {
  const chips = scale.map((item, i) => `
    <div class="chip">
      <span class="chip-rank">${i + 1}.</span>
      <span>${esc(item)}</span>
      <button class="rm-chip" onclick="removeScale(${idx}, ${i})">×</button>
    </div>
  `).join('');
  return `
    <div class="scale-editor">
      <h4>Preference Scale — ordered worst → best</h4>
      <div class="scale-chips">${chips || '<span style="color:var(--muted);font-size:.82rem">No categories yet</span>'}</div>
      <div class="scale-add">
        <input type="text" id="si-${idx}" placeholder="Add category…"
          onkeydown="if(event.key==='Enter'){event.preventDefault();addScale(${idx})}">
        <button class="btn btn-secondary" onclick="addScale(${idx})">Add</button>
      </div>
    </div>
  `;
}

function changeCritType(idx, type) {
  saveCritNames();
  state.criteria[idx].type = type;
  if (type === 'categorical') state.criteria[idx].scale = [];
  renderCriteria();
}

function addCrit() {
  saveCritNames();
  state.criteria.push({ name: '', type: 'numerical', scale: [] });
  renderCriteria();
}

function removeCrit(idx) {
  saveCritNames();
  state.criteria.splice(idx, 1);
  renderCriteria();
}

function addScale(idx) {
  const inp = document.getElementById(`si-${idx}`);
  const val = inp.value.trim();
  if (!val) return;
  state.criteria[idx].scale.push(val);
  renderCriteria();
}

function removeScale(idx, i) {
  state.criteria[idx].scale.splice(i, 1);
  renderCriteria();
}

function saveCritNames() {
  document.querySelectorAll('#criteria-wrap input[type="text"]:not(.scale-add input)').forEach((inp, i) => {
    if (state.criteria[i]) state.criteria[i].name = inp.value;
  });
}

function validateStep1() {
  saveCritNames();
  if (state.criteria.length < 3) return 'You need at least 3 criteria.';
  for (const c of state.criteria) {
    if (!c.name.trim()) return 'All criteria must have a name.';
    if (c.type === 'categorical' && c.scale.length < 2)
      return `Criterion "${c.name}" needs at least 2 scale categories.`;
  }
  return null;
}

function renderAlts() {
  const wrap = document.getElementById('alts-wrap');
  wrap.innerHTML = '';
  state.alternatives.forEach((a, idx) => {
    const card = document.createElement('div');
    card.className = 'alt-card';
    card.innerHTML = `
      <div class="alt-num">${idx + 1}</div>
      <input type="text" value="${esc(a)}" placeholder="e.g. Option A, Product X"
        oninput="state.alternatives[${idx}] = this.value">
      ${state.alternatives.length > 1
        ? `<button class="btn btn-danger" onclick="removeAlt(${idx})">Remove</button>`
        : ''}
    `;
    wrap.appendChild(card);
  });
}

function addAlt() {
  saveAltNames();
  state.alternatives.push('');
  renderAlts();
}

function removeAlt(idx) {
  saveAltNames();
  state.alternatives.splice(idx, 1);
  renderAlts();
}

function saveAltNames() {
  document.querySelectorAll('#alts-wrap input[type="text"]').forEach((inp, i) => {
    if (state.alternatives[i] !== undefined) state.alternatives[i] = inp.value;
  });
}

function validateStep2() {
  saveAltNames();
  if (state.alternatives.length < 2) return 'You need at least 2 alternatives.';
  for (const a of state.alternatives) {
    if (!a.trim()) return 'All alternatives must have a name.';
  }
  return null;
}

function renderScores() {
  const n = state.criteria.length;
  const m = state.alternatives.length;
  if (state.scores.length !== m) {
    state.scores = Array.from({ length: m }, (_, aIdx) =>
      Array.from({ length: n }, (_, cIdx) => state.scores[aIdx]?.[cIdx] ?? '')
    );
  }

  let html = '<div class="scroll-x"><table class="scores-tbl"><thead><tr><th>Alternative</th>';
  state.criteria.forEach(c => {
    html += `<th>${esc(c.name)}<br><small style="font-weight:400;text-transform:none;letter-spacing:0">${c.type}</small></th>`;
  });
  html += '</tr></thead><tbody>';

  state.alternatives.forEach((alt, aIdx) => {
    html += `<tr><td class="alt-cell">${esc(alt)}</td>`;
    state.criteria.forEach((crit, cIdx) => {
      const cur = state.scores[aIdx]?.[cIdx] ?? '';
      if (crit.type === 'categorical') {
        const opts = crit.scale.map(item =>
          `<option value="${esc(item)}" ${cur === item ? 'selected' : ''}>${esc(item)}</option>`
        ).join('');
        html += `<td><select onchange="state.scores[${aIdx}][${cIdx}]=this.value">
          <option value="">select</option>${opts}
        </select></td>`;
      } else {
        html += `<td><input type="number" min="0" step="any" value="${esc(String(cur))}"
          placeholder="0" oninput="state.scores[${aIdx}][${cIdx}]=this.value"></td>`;
      }
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  document.getElementById('scores-wrap').innerHTML = html;
}

function validateStep3() {
  for (let a = 0; a < state.alternatives.length; a++) {
    for (let c = 0; c < state.criteria.length; c++) {
      const v = state.scores[a]?.[c];
      if (v === '' || v === undefined || v === null)
        return `Missing score: "${state.alternatives[a]}" — "${state.criteria[c].name}".`;
      if (state.criteria[c].type === 'numerical' && isNaN(parseFloat(v)))
        return `Invalid number: "${state.alternatives[a]}" — "${state.criteria[c].name}".`;
    }
  }
  return null;
}

function initMatrix() {
  const n = state.criteria.length;
  state.matrix = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      (state.matrix[i]?.[j] !== undefined && state.matrix[i]?.[j] !== null)
        ? state.matrix[i][j]
        : 1
    )
  );
}

function renderComparison() {
  initMatrix();
  const n = state.criteria.length;
  let html = '<div class="pairs-list">';

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const cur = state.matrix[i][j];
      const opts = AHP_SCALE.map(s =>
        `<option value="${s.v}" ${Math.abs(s.v - cur) < 1e-9 ? 'selected' : ''}>${s.d}</option>`
      ).join('');
      // find current hint
      const curHint = AHP_SCALE.find(s => Math.abs(s.v - cur) < 1e-9)?.hint ?? '';
      html += `
        <div class="pair-row">
          <div class="pair-name left">${esc(state.criteria[i].name)}</div>
          <div class="pair-select-wrap">
            <select onchange="setPair(${i},${j},parseFloat(this.value));updateHint(this,'hint-${i}-${j}')">
              ${opts}
            </select>
          </div>
          <div class="pair-name right">${esc(state.criteria[j].name)}</div>
          <div class="pair-hint" id="hint-${i}-${j}">${curHint}</div>
        </div>`;
    }
  }
  html += '</div>';
  document.getElementById('pairs-wrap').innerHTML = html;
}

function setPair(i, j, val) {
  state.matrix[i][j] = val;
  state.matrix[j][i] = 1 / val;
}

function updateHint(selectEl, hintId) {
  const val = parseFloat(selectEl.value);
  const entry = AHP_SCALE.find(s => Math.abs(s.v - val) < 1e-9);
  const el = document.getElementById(hintId);
  if (el && entry) el.textContent = entry.hint;
}

async function calculate() {
  document.getElementById('results-wrap').innerHTML =
    '<div class="spinner-wrap"><div class="spinner"></div><p>Calculating…</p></div>';
  goTo(5);

  try {
    const res = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        criteria: state.criteria,
        alternatives: state.alternatives,
        scores: state.scores,
        comparisonMatrix: state.matrix
      })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    renderResults(data);
  } catch (e) {
    document.getElementById('results-wrap').innerHTML =
      `<div class="error-msg">Error: ${esc(e.message)}</div>`;
  }
}

function renderResults(r) {
  const crPct = (r.CR * 100).toFixed(2);
  let html = '';

  if (!r.isConsistent) {
    html += `
      <div class="result-block bad">
        <h3>Matrix is Inconsistent</h3>
        <div class="badges">
          <span class="badge badge-red">CR = ${crPct}% &gt; 10%</span>
          <span class="badge badge-blue">CI = ${r.CI.toFixed(4)}</span>
          <span class="badge badge-blue">λmax = ${r.lambdaMax.toFixed(4)}</span>
        </div>
        <p style="margin-top:.9rem;color:#991b1b">${esc(r.message)}</p>
        <p style="margin-top:.6rem;font-size:.88rem;color:#7f1d1d">
          <strong>Why inconsistent?</strong>
          The transitivity property is violated: if criterion A is preferred over B and B over C,
          the comparison A vs C must reflect that chain. Your values break this logical chain in at
          least one triple of criteria.
        </p>
        <p style="margin-top:.6rem;font-size:.88rem;color:#7f1d1d">
          <strong>How to fix:</strong> Go back (Step 4), identify which comparisons are out of
          line, and revise them so that each triple of criteria is transitively consistent.
          Start from the most important criterion and build outward.
        </p>
    `;
    if (r.inconsistencies?.length) {
      html += `<p style="margin-top:1rem;font-weight:700;color:#991b1b">Problematic triples detected:</p>`;
      r.inconsistencies.forEach(inc => {
        html += `<div class="inc-item">
          <strong>${inc.triple.join(' → ')}</strong>
          ${esc(inc.detail)}
        </div>`;
      });
    }
    html += '</div>';
  } else {
    // Best alternative banner
    html += `
      <div class="best-box">
        <div class="label">Best Alternative</div>
        <div class="name">${esc(r.bestAlternative)}</div>
      </div>
    `;

    // Consistency info
    html += `
      <div class="result-block ok">
        <h3>Matrix is Consistent</h3>
        <div class="badges">
          <span class="badge badge-green">CR = ${crPct}% ≤ 10%</span>
          <span class="badge badge-blue">CI = ${r.CI.toFixed(4)}</span>
          <span class="badge badge-blue">λmax = ${r.lambdaMax.toFixed(4)}</span>
        </div>
      </div>
    `;

    // Criteria weights
    html += '<h3 style="margin-bottom:.5rem">Criteria Weights</h3><div class="weights-grid">';
    r.weights.forEach(w => {
      html += `<div class="w-card">
        <div class="w-name">${esc(w.name)}</div>
        <div class="w-val">${(w.weight * 100).toFixed(1)}%</div>
      </div>`;
    });
    html += '</div>';

    // Ranking
    const maxScore = r.ranking[0].score;
    html += '<h3 style="margin-bottom:.5rem">Alternatives Ranking</h3><ul class="ranking-list">';
    r.ranking.forEach(alt => {
      const pct = (alt.score * 100).toFixed(1);
      const barW = ((alt.score / maxScore) * 100).toFixed(1);
      html += `<li class="rank-item ${alt.rank === 1 ? 'rank-1' : ''}">
        <div class="rank-badge">${alt.rank === 1 ? '★' : alt.rank}</div>
        <div class="rank-name">${esc(alt.name)}</div>
        <div class="bar-wrap">
          <div class="bar-bg"><div class="bar-fill" style="width:${barW}%"></div></div>
          <div class="score-pct">${pct}%</div>
        </div>
      </li>`;
    });
    html += '</ul>';
  }

  document.getElementById('results-wrap').innerHTML = html;
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', () => {
  // Default state: 3 criteria, 2 alternatives
  state.criteria = [
    { name: '', type: 'numerical', scale: [] },
    { name: '', type: 'numerical', scale: [] },
    { name: '', type: 'numerical', scale: [] }
  ];
  state.alternatives = ['', ''];

  renderCriteria();
  renderAlts();

  // Step 1
  document.getElementById('btn-add-crit').addEventListener('click', addCrit);
  document.getElementById('btn-next-1').addEventListener('click', () => {
    const err = validateStep1();
    showErr('sec-1', err);
    if (!err) { goTo(2); renderAlts(); }
  });

  // Step 2
  document.getElementById('btn-add-alt').addEventListener('click', addAlt);
  document.getElementById('btn-back-2').addEventListener('click', () => goTo(1));
  document.getElementById('btn-next-2').addEventListener('click', () => {
    const err = validateStep2();
    showErr('sec-2', err);
    if (!err) {
      state.scores = [];
      goTo(3);
      renderScores();
    }
  });

  // Step 3
  document.getElementById('btn-back-3').addEventListener('click', () => goTo(2));
  document.getElementById('btn-next-3').addEventListener('click', () => {
    const err = validateStep3();
    showErr('sec-3', err);
    if (!err) { goTo(4); renderComparison(); }
  });

  // Step 4
  document.getElementById('btn-back-4').addEventListener('click', () => goTo(3));
  document.getElementById('btn-calc').addEventListener('click', calculate);

  // Step 5
  document.getElementById('btn-restart').addEventListener('click', () => {
    state.criteria = [
      { name: '', type: 'numerical', scale: [] },
      { name: '', type: 'numerical', scale: [] },
      { name: '', type: 'numerical', scale: [] }
    ];
    state.alternatives = ['', ''];
    state.scores = [];
    state.matrix = [];
    renderCriteria();
    renderAlts();
    goTo(1);
  });
});

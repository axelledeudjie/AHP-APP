// ============================================================
// AHP Scale
// ============================================================
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

// Saaty's Random Index for n = 1..10
const RANDOM_INDEX = [0, 0, 0.58, 0.90, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49];

// ============================================================
// AHP Calculation (runs entirely in the browser)
// ============================================================
function buildFullMatrix(upper, n) {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 1;
      if (i < j) return upper[i][j];
      return 1 / upper[j][i];
    })
  );
}

function computeWeights(matrix) {
  const n = matrix.length;
  const colSums = Array(n).fill(0);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      colSums[j] += matrix[i][j];

  const weights = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++)
      weights[i] += matrix[i][j] / colSums[j];
    weights[i] /= n;
  }
  return weights;
}

function computeConsistency(matrix, weights) {
  const n = matrix.length;
  let lambdaMax = 0;
  for (let i = 0; i < n; i++) {
    let wSum = 0;
    for (let j = 0; j < n; j++) wSum += matrix[i][j] * weights[j];
    lambdaMax += wSum / weights[i];
  }
  lambdaMax /= n;
  const CI = n > 1 ? (lambdaMax - n) / (n - 1) : 0;
  const RI = RANDOM_INDEX[n - 1] ?? 0;
  const CR = RI === 0 ? 0 : CI / RI;
  return { lambdaMax, CI, CR };
}

function scoreToNumber(score, criterion) {
  if (criterion.type === 'categorical') {
    const idx = criterion.scale.indexOf(score);
    return idx >= 0 ? idx + 1 : 0;
  }
  return parseFloat(score) || 0;
}

function fmtVal(v) {
  if (v >= 1) return v % 1 === 0 ? String(v) : v.toFixed(2);
  return `1/${Math.round(1 / v)}`;
}

function findInconsistentTriples(matrix, criteria) {
  const n = matrix.length;
  const issues = [];
  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 1; j < n - 1; j++) {
      for (let k = j + 1; k < n; k++) {
        const aij = matrix[i][j], ajk = matrix[j][k], aik = matrix[i][k];
        const expected = aij * ajk;
        const ratio = Math.max(expected, aik) / Math.min(expected, aik);
        if (ratio > 2) {
          issues.push({
            triple: [criteria[i].name, criteria[j].name, criteria[k].name],
            detail: `"${criteria[i].name}" vs "${criteria[j].name}" = ${fmtVal(aij)}, ` +
                    `"${criteria[j].name}" vs "${criteria[k].name}" = ${fmtVal(ajk)}, ` +
                    `but "${criteria[i].name}" vs "${criteria[k].name}" = ${fmtVal(aik)} ` +
                    `(logically expected ≈ ${fmtVal(expected)})`
          });
        }
      }
    }
  }
  return issues;
}

function runAHP({ criteria, alternatives, scores, comparisonMatrix }) {
  const n = criteria.length;
  const m = alternatives.length;

  const matrix = buildFullMatrix(comparisonMatrix, n);
  const weights = computeWeights(matrix);
  const { lambdaMax, CI, CR } = computeConsistency(matrix, weights);
  const isConsistent = n <= 2 || CR <= 0.10;

  if (!isConsistent) {
    return {
      isConsistent: false, CR, CI, lambdaMax,
      inconsistencies: findInconsistentTriples(matrix, criteria),
      message: `Consistency Ratio CR = ${(CR * 100).toFixed(1)}% exceeds the 10% threshold. ` +
               `Your pairwise comparisons are not logically coherent.`
    };
  }

  const normalizedScores = Array.from({ length: n }, (_, cIdx) => {
    const raw = alternatives.map((_, aIdx) => scoreToNumber(scores[aIdx][cIdx], criteria[cIdx]));
    const total = raw.reduce((a, b) => a + b, 0);
    return raw.map(s => total > 0 ? s / total : 1 / m);
  });

  const finalScores = alternatives.map((name, aIdx) => ({
    name,
    score: weights.reduce((sum, w, cIdx) => sum + w * normalizedScores[cIdx][aIdx], 0)
  })).sort((a, b) => b.score - a.score);

  return {
    isConsistent: true, CR, CI, lambdaMax,
    weights: weights.map((w, i) => ({ name: criteria[i].name, weight: w })),
    ranking: finalScores.map((alt, idx) => ({ rank: idx + 1, ...alt })),
    bestAlternative: finalScores[0].name
  };
}

// ============================================================
// Application state
// ============================================================
const state = {
  criteria: [],
  alternatives: [],
  scores: [],
  matrix: []
};

// ============================================================
// Navigation
// ============================================================
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

// ============================================================
// STEP 1 — Criteria
// ============================================================
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
  document.querySelectorAll('#criteria-wrap .crit-card').forEach((card, i) => {
    const inp = card.querySelector('input[type="text"]');
    if (inp && state.criteria[i]) state.criteria[i].name = inp.value;
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

// ============================================================
// STEP 2 — Alternatives
// ============================================================
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

// ============================================================
// STEP 3 — Scores
// ============================================================
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
          <option value="">— select —</option>${opts}
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

// ============================================================
// STEP 4 — Pairwise comparison
// ============================================================
function initMatrix() {
  const n = state.criteria.length;
  state.matrix = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) =>
      (state.matrix[i]?.[j] != null) ? state.matrix[i][j] : 1
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
      const curHint = AHP_SCALE.find(s => Math.abs(s.v - cur) < 1e-9)?.hint ?? '';
      html += `
        <div class="pair-row">
          <div class="pair-name left">${esc(state.criteria[i].name)}</div>
          <div class="pair-select-wrap">
            <select onchange="setPair(${i},${j},parseFloat(this.value));updateHint(this,'hint-${i}-${j}')">${opts}</select>
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

// ============================================================
// STEP 5 — Results (runs locally, no server)
// ============================================================
function calculate() {
  document.getElementById('results-wrap').innerHTML =
    '<div class="spinner-wrap"><div class="spinner"></div><p>Calculating…</p></div>';
  goTo(5);

  try {
    const result = runAHP({
      criteria: state.criteria,
      alternatives: state.alternatives,
      scores: state.scores,
      comparisonMatrix: state.matrix
    });
    renderResults(result);
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
        <h3>✗ Matrix is Inconsistent</h3>
        <div class="badges">
          <span class="badge badge-red">CR = ${crPct}% &gt; 10%</span>
          <span class="badge badge-blue">CI = ${r.CI.toFixed(4)}</span>
          <span class="badge badge-blue">λmax = ${r.lambdaMax.toFixed(4)}</span>
        </div>
        <p style="margin-top:.9rem;color:#991b1b">${esc(r.message)}</p>
        <p style="margin-top:.6rem;font-size:.88rem;color:#7f1d1d">
          <strong>Why inconsistent?</strong>
          The transitivity property is violated: if A is preferred over B and B over C,
          the comparison A vs C must reflect that chain. Your values break this logical chain.
        </p>
        <p style="margin-top:.6rem;font-size:.88rem;color:#7f1d1d">
          <strong>How to fix:</strong> Go back to Step 4, identify which comparisons are out of
          line, and revise them so that each triple of criteria is transitively consistent.
        </p>
    `;
    if (r.inconsistencies?.length) {
      html += `<p style="margin-top:1rem;font-weight:700;color:#991b1b">Problematic triples detected:</p>`;
      r.inconsistencies.forEach(inc => {
        html += `<div class="inc-item"><strong>${inc.triple.join(' → ')}</strong>${esc(inc.detail)}</div>`;
      });
    }
    html += '</div>';
  } else {
    html += `
      <div class="best-box">
        <div class="label">Best Alternative</div>
        <div class="name">${esc(r.bestAlternative)}</div>
      </div>
      <div class="result-block ok">
        <h3>✓ Matrix is Consistent</h3>
        <div class="badges">
          <span class="badge badge-green">CR = ${crPct}% ≤ 10%</span>
          <span class="badge badge-blue">CI = ${r.CI.toFixed(4)}</span>
          <span class="badge badge-blue">λmax = ${r.lambdaMax.toFixed(4)}</span>
        </div>
      </div>
      <h3 style="margin-bottom:.5rem">Criteria Weights</h3>
      <div class="weights-grid">
        ${r.weights.map(w => `
          <div class="w-card">
            <div class="w-name">${esc(w.name)}</div>
            <div class="w-val">${(w.weight * 100).toFixed(1)}%</div>
          </div>`).join('')}
      </div>
      <h3 style="margin-bottom:.5rem">Alternatives Ranking</h3>
      <ul class="ranking-list">
        ${r.ranking.map(alt => {
          const pct = (alt.score * 100).toFixed(1);
          const barW = ((alt.score / r.ranking[0].score) * 100).toFixed(1);
          return `<li class="rank-item ${alt.rank === 1 ? 'rank-1' : ''}">
            <div class="rank-badge">${alt.rank === 1 ? '★' : alt.rank}</div>
            <div class="rank-name">${esc(alt.name)}</div>
            <div class="bar-wrap">
              <div class="bar-bg"><div class="bar-fill" style="width:${barW}%"></div></div>
              <div class="score-pct">${pct}%</div>
            </div>
          </li>`;
        }).join('')}
      </ul>
    `;
  }

  document.getElementById('results-wrap').innerHTML = html;
}

// ============================================================
// Utility
// ============================================================
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// Bootstrap
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  state.criteria = [
    { name: '', type: 'numerical', scale: [] },
    { name: '', type: 'numerical', scale: [] },
    { name: '', type: 'numerical', scale: [] }
  ];
  state.alternatives = ['', ''];

  renderCriteria();
  renderAlts();

  document.getElementById('btn-add-crit').addEventListener('click', addCrit);
  document.getElementById('btn-next-1').addEventListener('click', () => {
    const err = validateStep1();
    showErr('sec-1', err);
    if (!err) { goTo(2); renderAlts(); }
  });

  document.getElementById('btn-add-alt').addEventListener('click', addAlt);
  document.getElementById('btn-back-2').addEventListener('click', () => goTo(1));
  document.getElementById('btn-next-2').addEventListener('click', () => {
    const err = validateStep2();
    showErr('sec-2', err);
    if (!err) { state.scores = []; goTo(3); renderScores(); }
  });

  document.getElementById('btn-back-3').addEventListener('click', () => goTo(2));
  document.getElementById('btn-next-3').addEventListener('click', () => {
    const err = validateStep3();
    showErr('sec-3', err);
    if (!err) { goTo(4); renderComparison(); }
  });

  document.getElementById('btn-back-4').addEventListener('click', () => goTo(3));
  document.getElementById('btn-calc').addEventListener('click', calculate);

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

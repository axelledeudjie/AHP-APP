const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const RANDOM_INDEX = [0, 0, 0.58, 0.90, 1.12, 1.24, 1.32, 1.41, 1.45, 1.49];

function buildFullMatrix(upperTriangle, n) {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      if (i === j) return 1;
      if (i < j) return upperTriangle[i][j];
      return 1 / upperTriangle[j][i];
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

function findInconsistentTriples(matrix, criteria) {
  const n = matrix.length;
  const issues = [];
  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 1; j < n - 1; j++) {
      for (let k = j + 1; k < n; k++) {
        const aij = matrix[i][j];
        const ajk = matrix[j][k];
        const aik = matrix[i][k];
        const expected = aij * ajk;
        const ratio = Math.max(expected, aik) / Math.min(expected, aik);
        if (ratio > 2) {
          issues.push({
            triple: [criteria[i].name, criteria[j].name, criteria[k].name],
            detail: `"${criteria[i].name}" vs "${criteria[j].name}" = ${fmt(aij)}, ` +
                    `"${criteria[j].name}" vs "${criteria[k].name}" = ${fmt(ajk)}, ` +
                    `but "${criteria[i].name}" vs "${criteria[k].name}" = ${fmt(aik)} ` +
                    `(logically expected ≈ ${fmt(expected)})`
          });
        }
      }
    }
  }
  return issues;
}

function fmt(v) {
  if (v >= 1) return v % 1 === 0 ? String(v) : v.toFixed(2);
  return `1/${Math.round(1 / v)}`;
}

app.post('/api/calculate', (req, res) => {
  try {
    const { criteria, alternatives, scores, comparisonMatrix } = req.body;
    const n = criteria.length;
    const m = alternatives.length;

    if (n < 3) return res.status(400).json({ error: 'At least 3 criteria required.' });
    if (m < 2) return res.status(400).json({ error: 'At least 2 alternatives required.' });

    const matrix = buildFullMatrix(comparisonMatrix, n);
    const weights = computeWeights(matrix);
    const { lambdaMax, CI, CR } = computeConsistency(matrix, weights);
    const isConsistent = n <= 2 || CR <= 0.10;

    if (!isConsistent) {
      const inconsistencies = findInconsistentTriples(matrix, criteria);
      return res.json({
        isConsistent: false,
        CR, CI, lambdaMax,
        inconsistencies,
        message: `Consistency Ratio CR = ${(CR * 100).toFixed(1)}% exceeds the 10% threshold. ` +
                 `Your pairwise comparisons are not logically coherent.`
      });
    }

    // Normalize scores per criterion then compute weighted sum
    const normalizedScores = Array.from({ length: n }, (_, cIdx) => {
      const raw = alternatives.map((_, aIdx) =>
        scoreToNumber(scores[aIdx][cIdx], criteria[cIdx])
      );
      const total = raw.reduce((a, b) => a + b, 0);
      return raw.map(s => total > 0 ? s / total : 1 / m);
    });

    const finalScores = alternatives.map((name, aIdx) => ({
      name,
      score: weights.reduce((sum, w, cIdx) => sum + w * normalizedScores[cIdx][aIdx], 0)
    })).sort((a, b) => b.score - a.score);

    res.json({
      isConsistent: true,
      CR, CI, lambdaMax,
      weights: weights.map((w, i) => ({ name: criteria[i].name, weight: w })),
      ranking: finalScores.map((alt, idx) => ({ rank: idx + 1, ...alt })),
      bestAlternative: finalScores[0].name
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AHP server running at http://localhost:${PORT}`));

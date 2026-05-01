# AHP Decision Maker

A web application for multi-criteria decision analysis using the Analytical Hierarchy Process (AHP).

## Features

- Define **3+ criteria** of two types:
  - **Numerical** raw numeric scores (higher = better)
  - **Categorical** ordered scale you define (e.g. Poor -> Fair -> Good -> Excellent)
- Define **2+ alternatives** to compare
- Score every alternative on every criterion
- Fill in a **pairwise comparison matrix** using Saaty's 1-9 scale
- Automatic **consistency check** (Consistency Ratio must be ≤ 10%)
  - If consistent -> best alternative displayed with full ranking
  - If inconsistent -> explanation with specific problematic triples identified

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher

### Installation

bash
git clone https://github.com/axelledeudjie/AHP-APP.git
cd ahp-app
npm install


### Run

bash
npm start


Open your browser at **http://localhost:3000**

## How to Use

Follow the 5-step wizard:

### Step 1 — Define Criteria
- Click **+ Add Criterion** to add criteria (minimum 3)
- Give each criterion a name
- Choose type: **Numerical** or **Categorical**
- For categorical criteria, add ordered categories from worst to best (e.g. `Low`, `Medium`, `High`)

### Step 2 — Define Alternatives
- Click **+ Add Alternative** to add options to compare (minimum 2)

### Step 3 — Score Alternatives
- For numerical criteria: enter a positive number (higher = better)
- For categorical criteria: select from the dropdown

### Step 4 — Pairwise Comparison
For each pair of criteria, answer: *"How much more important is the left criterion compared to the right?"*

| Value | Meaning |
|-------|---------|
| 9     | Extremely more important |
| 7     | Very strongly more important |
| 5     | Strongly more important |
| 3     | Moderately more important |
| 1     | Equal importance |
| 1/3   | Moderately less important |
| 1/5   | Strongly less important |
| 1/7   | Very strongly less important |
| 1/9   | Extremely less important |

### Step 5 — Results
- **Consistent matrix (CR ≤ 10%)**: See criteria weights and the ranked list of alternatives with the best choice highlighted.
- **Inconsistent matrix (CR > 10%)**: See the Consistency Ratio, an explanation of why the comparisons are illogical, and which specific criterion triples violate transitivity. Go back and revise.

## API

`POST /api/calculate`

```json
{
  "criteria": [{"name": "Price", "type": "numerical", "scale": []}],
  "alternatives": ["Option A", "Option B"],
  "scores": [["800", "1200"]],
  "comparisonMatrix": [[1, 3], [0.33, 1]]
}
```

Returns consistency info, criteria weights, and ranked alternatives.

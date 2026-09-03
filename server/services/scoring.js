// Weighted 0-100 score combining the signals the plan itself calls out: headcount fit,
// verified marketing count, absence of an ops hire, hiring signal, growth, and funding
// stage. Missing data (most commonly funding_stage, since ~70% of companies have none
// on file) is treated as neutral, never penalized -- a company isn't worse for lacking
// a data point Apollo simply doesn't have.
function computeScore(company) {
  let score = 0;

  if (company.employee_count != null) {
    if (company.employee_count >= 20 && company.employee_count <= 70) score += 25;
    else if (company.employee_count >= 10 && company.employee_count <= 100) score += 12;
  }

  if (company.marketing_headcount != null) {
    if (company.marketing_headcount >= 1 && company.marketing_headcount <= 3) score += 20;
    else if (company.marketing_headcount === 0 || (company.marketing_headcount >= 4 && company.marketing_headcount <= 6)) score += 6;
  }

  if (company.has_ops_hire === false) score += 20;

  if (company.hiring_signal) score += 20;

  if (company.headcount_growth_pct != null) {
    if (company.headcount_growth_pct >= 10) score += 15;
    else if (company.headcount_growth_pct >= 0) score += 8;
  }

  const stage = (company.funding_stage || '').toLowerCase();
  if (/(seed|pre-seed|series a)/.test(stage)) score += 5;
  else if (/(series [b-e]|ipo|private equity)/.test(stage)) score -= 15;

  return Math.max(0, Math.min(100, Math.round(score)));
}

module.exports = { computeScore };

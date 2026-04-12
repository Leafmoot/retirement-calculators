// ── IRS & Plan Constants ──────────────────────────────────────────────────────
// Update these each January when the IRS announces new limits.
// Changing a value here updates every calculator that imports it.

// ── Plan year ────────────────────────────────────────────────────────────────
export const PLAN_YEAR = 2026;

// ── 402(g) Elective deferral limits ──────────────────────────────────────────
export const LIMIT_402G = 24500;          // Standard elective deferral limit
export const LIMIT_CATCHUP_50 = 8000;     // Catch-up: ages 50–59 and 64+
export const LIMIT_CATCHUP_6063 = 11250;  // Enhanced catch-up: ages 60–63 (SECURE 2.0)

// ── 415(c) Annual additions limit ────────────────────────────────────────────
export const LIMIT_415C = 72000;

// ── 457(b) limit ─────────────────────────────────────────────────────────────
export const LIMIT_457B = 24500;          // No catch-up for Baptist Health plan

// ── FICA / SECURE 2.0 catch-up threshold ─────────────────────────────────────
// Employees earning more than this in the prior year must make catch-up
// contributions as Roth (applies to ERISA plans only — not Baptist Health)
export const FICA_CATCHUP_THRESHOLD = 150000;
export const FICA_THRESHOLD_DISPLAY = FICA_CATCHUP_THRESHOLD.toLocaleString("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0,
});

// ── 401(a)(17) Compensation cap ───────────────────────────────────────────────
// Earnings above this amount are excluded from employer match calculations
export const COMP_LIMIT = 360000;

// ── 2026 Federal Tax Brackets ─────────────────────────────────────────────────
// Used by True Cost and HPH Combined calculators
export const FEDERAL_BRACKETS = {
  single: [
    { limit: 11925, rate: 0.10 }, { limit: 48475, rate: 0.12 },
    { limit: 103350, rate: 0.22 }, { limit: 197300, rate: 0.24 },
    { limit: 250525, rate: 0.32 }, { limit: 626350, rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
  married: [
    { limit: 23850, rate: 0.10 }, { limit: 96950, rate: 0.12 },
    { limit: 206700, rate: 0.22 }, { limit: 394600, rate: 0.24 },
    { limit: 501050, rate: 0.32 }, { limit: 751600, rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
  hoh: [
    { limit: 17000, rate: 0.10 }, { limit: 64850, rate: 0.12 },
    { limit: 103350, rate: 0.22 }, { limit: 197300, rate: 0.24 },
    { limit: 250500, rate: 0.32 }, { limit: 626350, rate: 0.35 },
    { limit: Infinity, rate: 0.37 },
  ],
};

export const STANDARD_DEDUCTION = {
  single: 15000,
  married: 30000,
  hoh: 22500,
};

// ── Helper: get marginal federal tax rate ────────────────────────────────────
export function getMarginalRate(annualSalary, filingStatus) {
  const taxableIncome = Math.max(0, annualSalary - STANDARD_DEDUCTION[filingStatus]);
  for (const bracket of FEDERAL_BRACKETS[filingStatus]) {
    if (taxableIncome <= bracket.limit) return bracket.rate;
  }
  return FEDERAL_BRACKETS[filingStatus].at(-1).rate;
}

// ── Helper: get catch-up amount for a given age ───────────────────────────────
export function getCatchUp(age) {
  if (age >= 60 && age <= 63) return LIMIT_CATCHUP_6063;
  if (age >= 50) return LIMIT_CATCHUP_50;
  return 0;
}

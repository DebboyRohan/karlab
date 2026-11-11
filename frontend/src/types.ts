// Mirrors backend/src/karlab/schemas.py. Keep the two in sync.

export type Region = "urban" | "semi_urban" | "rural";
export type DistKind = "lognormal" | "lognormal_pareto" | "pareto";
export type Mode = "M0" | "M1" | "M2" | "M3";

export interface Distribution {
  kind: DistKind;
  median: number;
  sigma: number;
  pareto_alpha: number;
  tail_start_quantile: number;
}

export interface PopulationSet {
  id: string;
  name: string;
  description: string;
  region: Region;
  population: number;
  tags: string[];
  demographics: { household_size: number; earners_per_household: number };
  income: Distribution;
  income_sources: { wage: number; self_employment: number; agriculture: number; capital: number };
  formal_share: number;
  wealth: Distribution;
  inherited_wealth_share: number;
  income_wealth_correlation: number;
  consumption: {
    apc_at_median: number;
    apc_income_elasticity: number;
    apc_dispersion: number;
    basket: Record<string, number>;
    informal_purchase_share: number;
  };
  behavior: {
    eti: number;
    mobility: number;
    informality_penalty: number;
    evadable_share: number;
    risk_aversion: number;
    tax_morale: number;
    avoidance_access: number;
  };
  information: {
    literacy: number;
    awareness: Record<string, number>;
    rate_perception: "exact" | "average";
    perceived_audit_prob: number | null;
    compliance_cost: number;
    peer_learning: number;
  };
  sources: string[];
}

export interface CalibrationTargets {
  population: number | null;
  total_income: number | null;
  income_tax_revenue: number | null;
  gst_revenue: number | null;
  income_tax_payers: number | null;
  gini_income: number | null;
}

export interface Economy {
  id: string;
  name: string;
  description: string;
  currency: string;
  year: string;
  sets: PopulationSet[];
  targets: CalibrationTargets;
  settings: { samples_per_set: number; poverty_line_per_capita: number; seed: number };
}

export interface EconomySummary {
  id: string;
  name: string;
  description: string;
  year: string;
  set_count: number;
  population: number;
}

export interface Slab {
  threshold: number;
  rate: number;
}

export interface Transfer {
  id: string;
  name: string;
  kind: "universal" | "targeted";
  amount_per_household: number;
  target: { regions: Region[] | null; tags_any: string[] | null; max_reported_income: number | null };
  requires_claim: boolean;
  leakage: number;
  exclusion_error: number;
  inclusion_error: number;
}

export interface IncomeTax {
  enabled: boolean;
  slabs: Slab[];
  standard_deduction: number;
  rebate_threshold: number;
  rebate_max: number;
  rebate_requires_claim: boolean;
  optional_deduction_cap: number;
  exempt_agriculture: boolean;
  cess: number;
}

export interface Policy {
  id: string;
  name: string;
  description: string;
  origin: "user" | "baseline" | "theory";
  income_tax: IncomeTax;
  consumption_tax: { enabled: boolean; rates: Record<string, number> };
  wealth_tax: { enabled: boolean; threshold: number; rate: number };
  transfers: Transfer[];
  enforcement: { audit_prob: number; penalty_rate: number; audit_capacity: number | null };
  outreach: number;
}

export interface Meta {
  version: string;
  modes: Record<Mode, string>;
  gst_categories: string[];
  awareness_keys: string[];
  templates: { population_set: PopulationSet; policy: Policy };
}

export interface Stats {
  mean: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p99: number;
}

export interface HistBin {
  lo: number;
  hi: number;
  share: number;
}

export interface SetPreview {
  households: number;
  income_household: Stats;
  income_per_capita: Stats;
  wealth_household: Stats;
  income_histogram: HistBin[];
  wealth_histogram: HistBin[];
  spending_share: number;
  total_income: number;
}

export interface CalibrationRow {
  key: string;
  label: string;
  unit: "people" | "money" | "ratio";
  simulated: number;
  target: number | null;
  ratio: number | null;
  status: "good" | "warn" | "bad" | null;
}

export interface SchedulePoint {
  income: number;
  tax: number;
  average_rate: number;
  marginal_rate: number;
}

export interface RunRequest {
  economy_id: string;
  baseline_policy_id: string;
  policy_ids: string[];
  mode: Mode;
  periods: number;
  revenue_neutral: boolean;
  inequality_aversion: number;
  samples_per_set: number | null;
  seed: number | null;
  name: string;
}

export interface SetRow {
  id: string;
  name: string;
  population: number;
  households: number;
  pretax_pc: number;
  disposable_pc: number;
  utility_pc: number;
  income_tax_pc: number;
  gst_pc: number;
  transfers_pc: number;
  net_tax_pc: number;
  effective_tax_rate: number;
  formal_share: number;
  evader_share: number;
  benefit_capture: number | null;
  unaware_extra_tax_pc: number;
  poverty_rate: number;
  gini: number;
}

export interface Summary {
  revenue: Record<
    "income_tax" | "penalties" | "gst" | "wealth_tax" | "transfer_spending" | "transfers_received" | "lump_sum" | "gross" | "leakage" | "net",
    number
  >;
  equality: {
    gini_pretax: number;
    gini_disposable: number;
    theil: { total: number; within: number; between: number };
    atkinson: number;
    top1: number;
    top10: number;
    bottom50: number;
    palma: number | null;
    poverty_headcount: number;
    poverty_gap: number;
  };
  equity: { kakwani: number; reynolds_smith: number; effective_tax_rate: number };
  efficiency: { output: number; potential_output: number; output_loss_share: number; excess_burden: number };
  welfare: { mean_utility_pc: number; ede_utility_pc: number; mean_disposable_pc: number; inequality_aversion: number };
  compliance: {
    formal_share: number;
    evader_share_of_formal: number;
    tax_gap_share: number;
    audit_prob: number;
    equilibrium_iterations: number;
    equilibrium_converged: boolean;
  };
  information: {
    benefit_capture_rate: number | null;
    unclaimed_benefits: number;
    extra_tax_from_unawareness: number;
    statutory_liability: number;
    awareness: Record<string, number>;
  };
  taxpayers: number;
}

export interface Versus {
  mean_gain_pc: number;
  better_off: number;
  worse_off: number;
  pareto_sets: boolean;
  pareto_households: boolean;
  losing_sets: string[];
  sets: { id: string; name: string; gain_pc: number; gain_pct: number | null; better_off: number; worse_off: number }[];
}

export interface Report {
  summary: Summary;
  sets: SetRow[];
  bands: { band: string; income_tax: number; gst: number; wealth_tax: number; transfers: number; net: number }[];
  lorenz: { pretax: { p: number; share: number }[]; disposable: { p: number; share: number }[] };
  transfers: { id: string; name: string; beneficiary_households: number; spending: number; received: number; capture_rate: number | null }[];
  versus_baseline?: Versus;
}

export interface PeriodSummary {
  period: number;
  net_revenue: number;
  gini_disposable: number;
  benefit_capture_rate: number | null;
  evader_share_of_formal: number;
  audit_prob: number;
  aware_rebate: number;
  aware_deductions: number;
  aware_transfers: number;
}

export interface PolicyResult {
  policy_id: string;
  policy_name: string;
  origin: Policy["origin"];
  is_baseline: boolean;
  balancing_lump_sum: number;
  report: Report;
  history: PeriodSummary[];
  full_information?: {
    ede_utility_pc: number;
    gini_disposable: number;
    net_revenue: number;
    benefit_capture_rate: number | null;
    sets: { id: string; utility_pc: number }[];
  };
}

export interface Run {
  id: string;
  name: string;
  created_at: string;
  request: RunRequest;
  economy: { id: string; name: string; sets: number };
  mode_label: string;
  sampled_households: number;
  represented_population: number;
  seconds: number;
  results: PolicyResult[];
}

export interface RunSummary {
  id: string;
  name: string;
  created_at: string;
  mode: Mode;
  mode_label: string;
  economy: { id: string; name: string; sets: number };
  policies: string[];
  seconds: number;
}

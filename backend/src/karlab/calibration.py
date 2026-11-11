"""Check that the aggregated population sets reproduce known national totals."""

from __future__ import annotations

import numpy as np

from karlab.analytics import gini, summarize
from karlab.engine import simulate
from karlab.population.sampler import sample_economy
from karlab.schemas import Economy, Mode, Policy

ROWS = [
    ("population", "Population", "people"),
    ("total_income", "Total pre-tax income", "money"),
    ("income_tax_revenue", "Personal income tax revenue", "money"),
    ("gst_revenue", "GST revenue", "money"),
    ("income_tax_payers", "Income tax payers", "people"),
    ("gini_income", "Gini of pre-tax income (per capita)", "ratio"),
]


def calibrate(economy: Economy, policy: Policy, mode: Mode = "M2") -> list[dict]:
    hh = sample_economy(economy)
    out = simulate(policy, hh, mode)[-1]
    rep = summarize(out, hh, policy, economy.settings.poverty_line_per_capita, 1.0)
    simulated = {
        "population": float(hh.persons.sum()),
        "total_income": float(np.sum(out["pretax_income"] * hh.weight)),
        "income_tax_revenue": rep["summary"]["revenue"]["income_tax"],
        "gst_revenue": rep["summary"]["revenue"]["gst"],
        "income_tax_payers": rep["summary"]["taxpayers"],
        "gini_income": gini(out["pretax_income"] / hh.hh_size, hh.persons),
    }
    targets = economy.targets.model_dump()
    rows = []
    for key, label, unit in ROWS:
        target = targets.get(key)
        sim = simulated[key]
        ratio = sim / target if target else None
        status = None if ratio is None else ("good" if abs(ratio - 1) <= 0.1 else "warn" if abs(ratio - 1) <= 0.3 else "bad")
        rows.append({"key": key, "label": label, "unit": unit, "simulated": sim, "target": target, "ratio": ratio, "status": status})
    return rows

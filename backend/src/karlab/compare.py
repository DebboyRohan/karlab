"""Run a baseline and any number of policies on the same synthetic population and compare them."""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone

import numpy as np

from karlab.analytics import period_summary, summarize
from karlab.engine import Outcome, simulate
from karlab.population.sampler import Households, sample_economy
from karlab.schemas import MODE_LABELS, Economy, Policy, RunRequest

REVENUE_NEUTRAL_ITERATIONS = 4


def net_revenue(out: Outcome, hh: Households) -> float:
    a, w = out.arrays, hh.weight
    gross = a["income_tax"] + a["penalty"] + a["gst"] + a["wealth_tax"]
    return float(np.sum((gross - a["transfer_cost"] - a["lump_sum"]) * w))


def _run_policy(policy: Policy, hh: Households, req: RunRequest, seed: int, target_revenue: float | None):
    """Simulate one policy. With a revenue target, a uniform lump-sum transfer (or poll tax)
    is adjusted until net revenue matches the target, so policies are compared at equal revenue."""
    lump = 0.0
    outs = simulate(policy, hh, req.mode, req.periods, lump, seed)
    if target_revenue is not None:
        households = float(hh.weight.sum())
        for _ in range(REVENUE_NEUTRAL_ITERATIONS):
            gap = net_revenue(outs[-1], hh) - target_revenue
            if abs(gap) < 1e-6 * max(abs(target_revenue), 1.0):
                break
            lump += gap / households
            outs = simulate(policy, hh, req.mode, req.periods, lump, seed)
    return outs, lump


def run_comparison(economy: Economy, baseline: Policy, policies: list[Policy], req: RunRequest) -> dict:
    started = time.perf_counter()
    seed = economy.settings.seed if req.seed is None else req.seed
    hh = sample_economy(economy, req.samples_per_set, seed)
    line = economy.settings.poverty_line_per_capita
    eps = req.inequality_aversion

    base_outs, _ = _run_policy(baseline, hh, req, seed, None)
    base_final = base_outs[-1]
    base_net = net_revenue(base_final, hh)

    def entry(policy: Policy, outs: list[Outcome], lump: float, is_baseline: bool) -> dict:
        report = summarize(outs[-1], hh, policy, line, eps, baseline=None if is_baseline else base_final)
        result = {
            "policy_id": policy.id,
            "policy_name": policy.name,
            "origin": policy.origin,
            "is_baseline": is_baseline,
            "balancing_lump_sum": lump,
            "report": report,
            "history": [period_summary(o, hh) for o in outs] if req.mode == "M3" else [],
        }
        if req.mode in ("M2", "M3"):
            full_info = simulate(policy, hh, "M1", 1, lump, seed)[-1]
            full = summarize(full_info, hh, policy, line, eps)
            result["full_information"] = {
                "ede_utility_pc": full["summary"]["welfare"]["ede_utility_pc"],
                "gini_disposable": full["summary"]["equality"]["gini_disposable"],
                "net_revenue": full["summary"]["revenue"]["net"],
                "benefit_capture_rate": full["summary"]["information"]["benefit_capture_rate"],
                "sets": [{"id": s["id"], "utility_pc": s["utility_pc"]} for s in full["sets"]],
            }
        return result

    results = [entry(baseline, base_outs, 0.0, True)]
    for pol in policies:
        if pol.id == baseline.id:
            continue
        outs, lump = _run_policy(pol, hh, req, seed, base_net if req.revenue_neutral else None)
        results.append(entry(pol, outs, lump, False))

    return {
        "id": uuid.uuid4().hex[:12],
        "name": req.name or f"{economy.name}: {MODE_LABELS[req.mode]}",
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "request": req.model_dump(),
        "economy": {"id": economy.id, "name": economy.name, "sets": len(economy.sets)},
        "mode_label": MODE_LABELS[req.mode],
        "sampled_households": hh.n,
        "represented_population": float(hh.persons.sum()),
        "seconds": round(time.perf_counter() - started, 2),
        "results": results,
    }

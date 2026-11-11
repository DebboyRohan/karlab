"""Equality, equity, efficiency, welfare and information-gap measures.

All measures are weighted by the number of real people each sampled household represents.
Income-type measures use per-capita values.
"""

from __future__ import annotations

import numpy as np

from karlab.engine import Outcome
from karlab.population.sampler import Households
from karlab.responders import effort_cost
from karlab.schemas import AWARENESS_KEYS, Policy

INCOME_BANDS = [(0, 10), (10, 20), (20, 30), (30, 40), (40, 50), (50, 60), (60, 70), (70, 80), (80, 90), (90, 99), (99, 100)]
BETTER_OFF_TOLERANCE = 1.0  # rupees per person per year


# --------------------------------------------------------------------------- primitives


def _sorted(x: np.ndarray, w: np.ndarray, by: np.ndarray | None = None):
    order = np.argsort(x if by is None else by, kind="stable")
    return x[order], w[order]


def lorenz(x: np.ndarray, w: np.ndarray, by: np.ndarray | None = None) -> tuple[np.ndarray, np.ndarray]:
    xs, ws = _sorted(x, w, by)
    cum_w = np.concatenate([[0.0], np.cumsum(ws)]) / ws.sum()
    cum_x = np.concatenate([[0.0], np.cumsum(xs * ws)])
    total = cum_x[-1]
    return cum_w, cum_x / total if total != 0 else cum_x


def gini(x: np.ndarray, w: np.ndarray, by: np.ndarray | None = None) -> float:
    """Gini of x; with `by`, the concentration index of x ranked by `by`."""
    p, l = lorenz(x, w, by)
    return float(1 - np.sum((p[1:] - p[:-1]) * (l[1:] + l[:-1])))


def lorenz_points(x: np.ndarray, w: np.ndarray, n: int = 21) -> list[dict]:
    p, l = lorenz(np.maximum(x, 0.0), w)
    grid = np.linspace(0, 1, n)
    return [{"p": float(g), "share": float(np.interp(g, p, l))} for g in grid]


def weighted_quantile(x: np.ndarray, w: np.ndarray, q: np.ndarray) -> np.ndarray:
    xs, ws = _sorted(x, w)
    cdf = (np.cumsum(ws) - 0.5 * ws) / ws.sum()
    return np.interp(q, cdf, xs)


def theil(x: np.ndarray, w: np.ndarray, groups: np.ndarray) -> dict[str, float]:
    x = np.maximum(x, 1.0)
    mu = np.average(x, weights=w)
    total = float(np.average((x / mu) * np.log(x / mu), weights=w))
    within = 0.0
    for g in np.unique(groups):
        m = groups == g
        mu_g = np.average(x[m], weights=w[m])
        share = (w[m].sum() * mu_g) / (w.sum() * mu)
        within += share * np.average((x[m] / mu_g) * np.log(x[m] / mu_g), weights=w[m])
    return {"total": total, "within": float(within), "between": float(total - within)}


def atkinson_ede(x: np.ndarray, w: np.ndarray, eps: float) -> float:
    """Equally distributed equivalent: the equal per-person value with the same social welfare."""
    x = np.maximum(x, 1.0)
    if abs(eps - 1) < 1e-9:
        return float(np.exp(np.average(np.log(x), weights=w)))
    return float(np.average(x ** (1 - eps), weights=w) ** (1 / (1 - eps)))


def shares(x: np.ndarray, w: np.ndarray) -> dict[str, float]:
    p, l = lorenz(np.maximum(x, 0.0), w)
    at = lambda q: float(np.interp(q, p, l))  # noqa: E731
    bottom40 = at(0.4)
    return {
        "top1": 1 - at(0.99),
        "top10": 1 - at(0.9),
        "bottom50": at(0.5),
        "palma": (1 - at(0.9)) / bottom40 if bottom40 > 0 else float("inf"),
    }


def _wsum(x: np.ndarray, w: np.ndarray) -> float:
    return float(np.sum(x * w))


def _clean(obj):
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean(v) for v in obj]
    if isinstance(obj, (float, np.floating)):
        v = float(obj)
        return v if np.isfinite(v) else None
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, np.bool_):
        return bool(obj)
    return obj


# --------------------------------------------------------------------------- report


def summarize(
    out: Outcome,
    hh: Households,
    policy: Policy,
    poverty_line: float,
    eps: float,
    baseline: Outcome | None = None,
) -> dict:
    a = out.arrays
    w = hh.weight
    persons = hh.persons
    size = hh.hh_size

    pretax_pc = a["pretax_income"] / size
    disp_pc = a["disposable"] / size
    util_pc = a["utility"] / size
    taxes = a["income_tax"] + a["penalty"] + a["gst"] + a["wealth_tax"]
    net_tax = taxes - a["transfers"] - a["lump_sum"]

    revenue = {
        "income_tax": _wsum(a["income_tax"], w),
        "penalties": _wsum(a["penalty"], w),
        "gst": _wsum(a["gst"], w),
        "wealth_tax": _wsum(a["wealth_tax"], w),
        "transfer_spending": _wsum(a["transfer_cost"], w),
        "transfers_received": _wsum(a["transfers"], w),
        "lump_sum": _wsum(a["lump_sum"], w),
    }
    revenue["gross"] = revenue["income_tax"] + revenue["penalties"] + revenue["gst"] + revenue["wealth_tax"]
    revenue["leakage"] = revenue["transfer_spending"] - revenue["transfers_received"]
    revenue["net"] = revenue["gross"] - revenue["transfer_spending"] - revenue["lump_sum"]

    gini_pre = gini(pretax_pc, persons)
    gini_post = gini(disp_pc, persons)
    potential_utility = hh.y0 - effort_cost(hh.y0, hh.y0, hh.eti)
    output = _wsum(a["pretax_income"], w)
    potential = _wsum(hh.y0, w)

    statutory = a["income_tax_statutory"] + a["wealth_tax_statutory"]
    full_report = a["income_tax_full_report"]
    entitled = sum((t["entitled"] for t in out.transfers.values()), np.zeros(hh.n))
    captured = sum((np.minimum(t["received"], t["entitled"]) for t in out.transfers.values()), np.zeros(hh.n))

    summary = {
        "revenue": revenue,
        "equality": {
            "gini_pretax": gini_pre,
            "gini_disposable": gini_post,
            "theil": theil(disp_pc, persons, hh.set_idx),
            "atkinson": 1 - atkinson_ede(disp_pc, persons, eps) / np.average(np.maximum(disp_pc, 1.0), weights=persons),
            **shares(disp_pc, persons),
            "poverty_headcount": float(np.average(disp_pc < poverty_line, weights=persons)),
            "poverty_gap": float(np.average(np.maximum(poverty_line - disp_pc, 0) / poverty_line, weights=persons)),
        },
        "equity": {
            "kakwani": gini(taxes, w, by=pretax_pc) - gini(a["pretax_income"], w, by=pretax_pc),
            "reynolds_smith": gini_pre - gini_post,
            "effective_tax_rate": _wsum(net_tax, w) / max(output, 1.0),
        },
        "efficiency": {
            "output": output,
            "potential_output": potential,
            "output_loss_share": 1 - output / max(potential, 1.0),
            "excess_burden": _wsum(potential_utility - a["utility"], w) - revenue["net"],
        },
        "welfare": {
            "mean_utility_pc": float(np.average(util_pc, weights=persons)),
            "ede_utility_pc": atkinson_ede(util_pc, persons, eps),
            "mean_disposable_pc": float(np.average(disp_pc, weights=persons)),
            "inequality_aversion": eps,
        },
        "compliance": {
            "formal_share": float(np.average(a["formal"], weights=persons)),
            "evader_share_of_formal": float(
                np.sum(w * a["evading"]) / max(np.sum(w * a["formal"]), 1e-12)
            ),
            "tax_gap_share": _wsum(a["evaded_tax"], w) / max(_wsum(full_report, w), 1.0),
            "audit_prob": out.audit_prob,
            "equilibrium_iterations": out.iterations,
            "equilibrium_converged": out.converged,
        },
        "information": {
            "benefit_capture_rate": _wsum(captured, w) / _wsum(entitled, w) if _wsum(entitled, w) > 0 else None,
            "unclaimed_benefits": _wsum(entitled - captured, w),
            "extra_tax_from_unawareness": _wsum(full_report - a["income_tax_statutory"], w),
            "statutory_liability": _wsum(statutory, w),
            "awareness": out.aware_share,
        },
        "taxpayers": float(np.sum(w * (a["income_tax"] > 0) * hh.earners)),
    }

    report = {
        "summary": summary,
        "sets": _per_set(out, hh, poverty_line, baseline),
        "bands": _bands(out, hh),
        "lorenz": {"pretax": lorenz_points(pretax_pc, persons), "disposable": lorenz_points(disp_pc, persons)},
        "transfers": [
            {
                "id": tr.id,
                "name": tr.name,
                "beneficiary_households": float(np.sum(w * (out.transfers[tr.id]["received"] > 0))),
                "spending": _wsum(out.transfers[tr.id]["cost"], w),
                "received": _wsum(out.transfers[tr.id]["received"], w),
                "capture_rate": (
                    _wsum(np.minimum(out.transfers[tr.id]["received"], out.transfers[tr.id]["entitled"]), w)
                    / _wsum(out.transfers[tr.id]["entitled"], w)
                    if _wsum(out.transfers[tr.id]["entitled"], w) > 0
                    else None
                ),
            }
            for tr in policy.transfers
        ],
    }
    if baseline is not None:
        report["versus_baseline"] = _versus(out, baseline, hh, report["sets"])
    return _clean(report)


def _per_set(out: Outcome, hh: Households, poverty_line: float, baseline: Outcome | None) -> list[dict]:
    a = out.arrays
    rows = []
    for i, (sid, name) in enumerate(zip(hh.set_ids, hh.set_names)):
        m = hh.set_idx == i
        w, persons, size = hh.weight[m], hh.persons[m], hh.hh_size[m]
        pre = a["pretax_income"][m]
        taxes = a["income_tax"][m] + a["penalty"][m] + a["gst"][m] + a["wealth_tax"][m]
        net = taxes - a["transfers"][m] - a["lump_sum"][m]
        ent = sum((t["entitled"][m] for t in out.transfers.values()), np.zeros(m.sum()))
        cap = sum((np.minimum(t["received"][m], t["entitled"][m]) for t in out.transfers.values()), np.zeros(m.sum()))
        pc = lambda x: float(np.sum(x * w) / np.sum(persons))  # noqa: E731
        rows.append(
            {
                "id": sid,
                "name": name,
                "population": float(np.sum(persons)),
                "households": float(np.sum(w)),
                "pretax_pc": pc(pre),
                "disposable_pc": pc(a["disposable"][m]),
                "utility_pc": pc(a["utility"][m]),
                "income_tax_pc": pc(a["income_tax"][m]),
                "gst_pc": pc(a["gst"][m]),
                "transfers_pc": pc(a["transfers"][m]),
                "net_tax_pc": pc(net),
                "effective_tax_rate": float(np.sum(net * w) / max(np.sum(pre * w), 1.0)),
                "formal_share": float(np.average(a["formal"][m], weights=w)),
                "evader_share": float(np.average(a["evading"][m], weights=w)),
                "benefit_capture": float(np.sum(cap * w) / np.sum(ent * w)) if np.sum(ent * w) > 0 else None,
                "unaware_extra_tax_pc": pc(a["income_tax_full_report"][m] - a["income_tax_statutory"][m]),
                "poverty_rate": float(np.average(a["disposable"][m] / size < poverty_line, weights=persons)),
                "gini": gini(a["disposable"][m] / size, persons),
            }
        )
    return rows


def _bands(out: Outcome, hh: Households) -> list[dict]:
    a = out.arrays
    pre_pc = a["pretax_income"] / hh.hh_size
    edges = weighted_quantile(pre_pc, hh.persons, np.array([b / 100 for b, _ in INCOME_BANDS] + [1.0]))
    rows = []
    for j, (lo, hi) in enumerate(INCOME_BANDS):
        upper = edges[j + 1] if hi < 100 else np.inf
        m = (pre_pc >= edges[j]) & (pre_pc < upper) if hi < 100 else pre_pc >= edges[j]
        if not m.any():
            continue
        w = hh.weight[m]
        pre = max(np.sum(a["pretax_income"][m] * w), 1.0)
        share = lambda key: float(np.sum(a[key][m] * w) / pre)  # noqa: E731
        rows.append(
            {
                "band": f"P{lo}–{hi}",
                "income_tax": share("income_tax") + share("penalty"),
                "gst": share("gst"),
                "wealth_tax": share("wealth_tax"),
                "transfers": -(share("transfers") + share("lump_sum")),
                "net": share("income_tax") + share("penalty") + share("gst") + share("wealth_tax")
                - share("transfers") - share("lump_sum"),
            }
        )
    return rows


def _versus(out: Outcome, base: Outcome, hh: Households, set_rows: list[dict]) -> dict:
    gain_pc = (out["utility"] - base["utility"]) / hh.hh_size
    persons = hh.persons
    better = gain_pc > BETTER_OFF_TOLERANCE
    worse = gain_pc < -BETTER_OFF_TOLERANCE
    per_set = []
    for i, sid in enumerate(hh.set_ids):
        m = hh.set_idx == i
        base_u = float(np.average(base["utility"][m] / hh.hh_size[m], weights=persons[m]))
        g = float(np.average(gain_pc[m], weights=persons[m]))
        per_set.append(
            {
                "id": sid,
                "name": hh.set_names[i],
                "gain_pc": g,
                "gain_pct": g / base_u if base_u else None,
                "better_off": float(np.average(better[m], weights=persons[m])),
                "worse_off": float(np.average(worse[m], weights=persons[m])),
            }
        )
    losing_sets = [s["name"] for s in per_set if s["gain_pc"] < -BETTER_OFF_TOLERANCE]
    return {
        "mean_gain_pc": float(np.average(gain_pc, weights=persons)),
        "better_off": float(np.average(better, weights=persons)),
        "worse_off": float(np.average(worse, weights=persons)),
        "pareto_sets": not losing_sets,
        "pareto_households": not worse.any(),
        "losing_sets": losing_sets,
        "sets": per_set,
    }


def period_summary(out: Outcome, hh: Households) -> dict:
    a, w, persons = out.arrays, hh.weight, hh.persons
    disp_pc = a["disposable"] / hh.hh_size
    entitled = sum((t["entitled"] for t in out.transfers.values()), np.zeros(hh.n))
    captured = sum((np.minimum(t["received"], t["entitled"]) for t in out.transfers.values()), np.zeros(hh.n))
    gross = _wsum(a["income_tax"] + a["penalty"] + a["gst"] + a["wealth_tax"], w)
    return _clean(
        {
            "period": out.period,
            "net_revenue": gross - _wsum(a["transfer_cost"], w) - _wsum(a["lump_sum"], w),
            "gini_disposable": gini(disp_pc, persons),
            "benefit_capture_rate": _wsum(captured, w) / _wsum(entitled, w) if _wsum(entitled, w) > 0 else None,
            "evader_share_of_formal": float(np.sum(w * a["evading"]) / max(np.sum(w * a["formal"]), 1e-12)),
            "audit_prob": out.audit_prob,
            **{f"aware_{k}": out.aware_share.get(k) for k in AWARENESS_KEYS},
        }
    )

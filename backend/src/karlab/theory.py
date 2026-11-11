"""Textbook optimal-tax baselines, computed from the economy's own population sets.

These apply the classical formulas under their own assumptions (honest, formal,
fully informed taxpayers), which is exactly what makes them a fair "ideal theory" baseline.
"""

from __future__ import annotations

import numpy as np

from karlab.population.sampler import sample_economy
from karlab.responders import effort_cost
from karlab.schemas import ConsumptionTax, Economy, IncomeTax, Policy, Slab, Transfer, WealthTax


def linear_optimum(economy: Economy, eps: float, n_per_set: int | None = None, tol: float = 1e-7) -> dict:
    """Optimal flat tax with a universal demogrant (Piketty and Saez 2013, eq. 3 of NBER WP 18521):

        tau = (1 - g) / (1 - g + e)

    where g is the income-weighted average social marginal welfare weight and e the
    elasticity of aggregate income. Iterated because g depends on tau.
    """
    hh = sample_economy(economy, n_per_set)
    w, y0, e, size = hh.weight, hh.y0, hh.eti, hh.hh_size
    tau = 0.3
    for _ in range(500):
        z = y0 * (1 - tau) ** e
        grant = tau * np.sum(w * z) / np.sum(w)
        u_pc = np.maximum(((1 - tau) * z + grant - effort_cost(z, y0, e)) / size, 1.0)
        g = u_pc ** (-eps)
        z_mean = np.sum(w * z) / np.sum(w)
        g_bar = np.sum(w * g * z) / (np.sum(w * g) * z_mean)
        e_agg = np.sum(w * z * e) / np.sum(w * z)
        tau_next = (1 - g_bar) / (1 - g_bar + e_agg)
        if abs(tau_next - tau) < tol:
            tau = tau_next
            break
        tau = 0.5 * tau + 0.5 * tau_next
    z = y0 * (1 - tau) ** e
    grant = tau * np.sum(w * z) / np.sum(w)
    return {"rate": float(tau), "grant_per_household": float(grant), "g_bar": float(g_bar), "elasticity": float(e_agg)}


def linear_optimum_policy(economy: Economy, eps: float, policy_id: str) -> Policy:
    sol = linear_optimum(economy, eps)
    return Policy(
        id=policy_id,
        name=f"Theory: optimal flat tax + demogrant (ε={eps:g})",
        description=(
            f"Piketty–Saez linear optimum for this economy: flat rate {sol['rate']:.1%} on all income and a "
            f"universal grant of ₹{sol['grant_per_household']:,.0f} per household. Assumes full compliance, "
            "no informality and no GST."
        ),
        origin="theory",
        income_tax=IncomeTax(slabs=[Slab(threshold=0, rate=round(sol["rate"], 4))], exempt_agriculture=False),
        consumption_tax=ConsumptionTax(enabled=False),
        wealth_tax=WealthTax(enabled=False),
        transfers=[
            Transfer(
                id="demogrant",
                name="Universal demogrant",
                kind="universal",
                amount_per_household=round(sol["grant_per_household"]),
                requires_claim=False,
            )
        ],
    )


def saez_top_rate(economy: Economy, policy: Policy, eps: float) -> dict:
    """Saez (2001) top rate in the single-elasticity form of Piketty and Saez (2013, eq. 7):
    tau = (1 - g) / (1 - g + a e), above the policy's top threshold.

    a is the Pareto parameter of incomes above the threshold, e the elasticity of top
    earners, g the social welfare weight on top earners relative to the average.
    """
    hh = sample_economy(economy)
    exempt = hh.agri_share if policy.income_tax.exempt_agriculture else 0.0
    per_earner = hh.y0 * (1 - exempt) / hh.earners
    earners_w = hh.weight * hh.earners
    threshold = policy.income_tax.slabs[-1].threshold
    top = per_earner > threshold
    if top.sum() < 5:
        raise ValueError("too few sampled earners above the top threshold to estimate the tail")
    mean_top = np.average(per_earner[top], weights=earners_w[top])
    a = mean_top / (mean_top - threshold)
    e = float(np.average(hh.eti[top], weights=earners_w[top] * per_earner[top]))
    u_pc = np.maximum(hh.y0 / hh.hh_size, 1.0)
    weights = u_pc ** (-eps)
    g = float(np.average(weights[top], weights=hh.persons[top]) / np.average(weights, weights=hh.persons))
    tau = (1 - g) / (1 - g + a * e)
    return {"rate": float(tau), "pareto_a": float(a), "elasticity": e, "g_top": g, "threshold": float(threshold)}


def saez_top_policy(economy: Economy, policy: Policy, eps: float, policy_id: str) -> Policy:
    sol = saez_top_rate(economy, policy, eps)
    statutory = sol["rate"] / (1 + policy.income_tax.cess)
    new = policy.model_copy(deep=True)
    new.id = policy_id
    new.origin = "theory"
    new.name = f"Theory: {policy.name} with Saez top rate"
    new.description = (
        f"Same as “{policy.name}” but the top slab (above ₹{sol['threshold']:,.0f}) is set by Saez (2001): "
        f"a = {sol['pareto_a']:.2f}, e = {sol['elasticity']:.2f}, g = {sol['g_top']:.3f} → "
        f"{sol['rate']:.1%} including cess."
    )
    new.income_tax.slabs[-1].rate = round(min(max(statutory, 0.0), 0.95), 4)
    return new

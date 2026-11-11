"""Vectorised tax and transfer rules. All functions work on whole household arrays."""

from __future__ import annotations

import numpy as np

from karlab.population.sampler import REGION_CODES, Households
from karlab.schemas import GST_CATEGORIES, ConsumptionTax, IncomeTax, Transfer, WealthTax


def slab_tax(x: np.ndarray, thresholds: np.ndarray, rates: np.ndarray) -> np.ndarray:
    """Tax on `x` under a progressive slab schedule. Works for any array shape."""
    flat = np.asarray(x, dtype=float).reshape(-1)
    upper = np.append(thresholds[1:], np.inf)
    width = upper - thresholds
    band = np.clip(flat[:, None] - thresholds[None, :], 0.0, width[None, :])
    return (band @ rates).reshape(np.shape(x))


def schedule(it: IncomeTax) -> tuple[np.ndarray, np.ndarray]:
    return (
        np.array([s.threshold for s in it.slabs], dtype=float),
        np.array([s.rate for s in it.slabs], dtype=float),
    )


def income_tax(
    it: IncomeTax,
    base: np.ndarray,
    wage_income: np.ndarray,
    savings: np.ndarray,
    earners: np.ndarray,
    claims_rebate: np.ndarray,
    uses_deductions: np.ndarray,
) -> np.ndarray:
    """Household income tax. Income is split equally across earners and each is taxed individually.

    `base` may carry an extra trailing axis (for example a grid of reporting choices);
    the other arguments broadcast against it.
    """
    if not it.enabled:
        return np.zeros(np.shape(base))
    thresholds, rates = schedule(it)
    per_earner = np.maximum(base, 0.0) / earners
    deduction = np.minimum(it.standard_deduction, np.maximum(wage_income, 0.0) / earners)
    optional = np.where(uses_deductions, np.minimum(it.optional_deduction_cap, np.maximum(savings, 0.0) / earners), 0.0)
    taxable = np.maximum(per_earner - deduction - optional, 0.0)
    tax = slab_tax(taxable, thresholds, rates)
    if it.rebate_max > 0:
        claimed = claims_rebate | (not it.rebate_requires_claim)
        tax = tax - np.where(claimed & (taxable <= it.rebate_threshold), np.minimum(tax, it.rebate_max), 0.0)
    return tax * (1 + it.cess) * earners


def gst_share(ct: ConsumptionTax, hh: Households) -> np.ndarray:
    """Share of each household's (tax-inclusive) spending that is GST."""
    if not ct.enabled:
        return np.zeros(hh.n)
    rates = np.array([ct.rates.get(k, 0.0) for k in GST_CATEGORIES])
    return (1 - hh.informal_purchase_share) * (hh.basket @ (rates / (1 + rates)))


def wealth_tax(wt: WealthTax, hh: Households, avoidance: np.ndarray) -> np.ndarray:
    if not wt.enabled:
        return np.zeros(hh.n)
    base = hh.wealth * (1 - avoidance) - wt.threshold
    return wt.rate * np.maximum(base, 0.0)


def transfer_eligible(tr: Transfer, hh: Households, reported_income: np.ndarray) -> np.ndarray:
    ok = np.ones(hh.n, dtype=bool)
    if tr.kind == "universal":
        return ok
    rule = tr.target
    if rule.regions:
        ok &= np.isin(hh.region, [REGION_CODES[r] for r in rule.regions])
    if rule.tags_any:
        set_ok = np.array([bool(set(tags) & set(rule.tags_any)) for tags in hh.set_tags])
        ok &= set_ok[hh.set_idx]
    if rule.max_reported_income is not None:
        ok &= reported_income <= rule.max_reported_income
    return ok

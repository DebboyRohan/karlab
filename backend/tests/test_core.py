import numpy as np
import pytest

from karlab.analytics import gini, summarize
from karlab.compare import run_comparison
from karlab.engine import simulate
from karlab.policy.taxes import income_tax, slab_tax
from karlab.population.sampler import sample_economy
from karlab.presets import NEW_REGIME_SLABS, india_economy, india_policies
from karlab.schemas import (
    Behavior,
    ConsumptionTax,
    Distribution,
    Economy,
    IncomeSources,
    IncomeTax,
    Policy,
    PopulationSet,
    RunRequest,
    Slab,
    Transfer,
)
from karlab.theory import linear_optimum

LAKH = 1e5


def _one(x):
    return np.array([x], dtype=float)


def test_new_regime_tax_by_hand():
    it = IncomeTax(slabs=NEW_REGIME_SLABS, standard_deduction=75_000, rebate_threshold=12 * LAKH,
                   rebate_max=60_000, rebate_requires_claim=False, cess=0.04)
    kw = dict(savings=_one(0), earners=_one(1), claims_rebate=_one(True).astype(bool), uses_deductions=_one(False).astype(bool))
    # ₹12.75 lakh salary -> taxable ₹12 lakh -> rebate wipes out the ₹60,000
    assert income_tax(it, _one(12.75 * LAKH), wage_income=_one(12.75 * LAKH), **kw)[0] == pytest.approx(0.0)
    # ₹16.75 lakh salary -> taxable 16L: 20k + 40k + 60k = 1.2L, plus 4% cess
    assert income_tax(it, _one(16.75 * LAKH), wage_income=_one(16.75 * LAKH), **kw)[0] == pytest.approx(124_800)


def test_slab_tax_shapes():
    th, r = np.array([0.0, 100.0]), np.array([0.0, 0.5])
    assert slab_tax(np.array([[50.0, 300.0]]), th, r).tolist() == [[0.0, 100.0]]


def test_gini_extremes():
    w = np.ones(1000)
    assert gini(np.ones(1000), w) == pytest.approx(0.0, abs=1e-9)
    x = np.zeros(1000)
    x[-1] = 1.0
    assert gini(x, w) == pytest.approx(1.0, abs=2e-3)


def _ideal_economy(eti: float = 0.25) -> Economy:
    ps = PopulationSet(
        id="ideal", name="Ideal", population=1e6, formal_share=1.0,
        income=Distribution(kind="lognormal", median=5 * LAKH, sigma=0.7),
        income_sources=IncomeSources(wage=1, self_employment=0, agriculture=0, capital=0),
        behavior=Behavior(eti=eti, mobility=0.0, evadable_share=0.0),
    )
    ps.demographics.earners_per_household = 1.0
    return Economy(id="ideal", name="Ideal", sets=[ps])


def _flat_policy(rate: float, grant: float) -> Policy:
    return Policy(
        id=f"flat_{rate}", name="flat",
        income_tax=IncomeTax(slabs=[Slab(threshold=0, rate=rate)], exempt_agriculture=False),
        consumption_tax=ConsumptionTax(enabled=False),
        transfers=[Transfer(id="g", name="grant", kind="universal", amount_per_household=grant, requires_claim=False)],
    )


def test_engine_reproduces_linear_optimal_tax():
    """Benchmark: in an ideal economy, the welfare-maximising flat tax found by brute force
    through the full engine must match the Piketty-Saez formula."""
    eco, eps = _ideal_economy(), 1.0
    theory = linear_optimum(eco, eps)
    hh = sample_economy(eco)
    best, best_w = None, -np.inf
    for tau in np.arange(0.30, 0.80, 0.01):
        z = hh.y0 * (1 - tau) ** hh.eti
        grant = tau * np.sum(hh.weight * z) / hh.weight.sum()
        out = simulate(_flat_policy(tau, grant), hh, "M1")[-1]
        welfare = summarize(out, hh, _flat_policy(tau, grant), 1.0, eps)["summary"]["welfare"]["ede_utility_pc"]
        if welfare > best_w:
            best, best_w = tau, welfare
    assert theory["rate"] == pytest.approx(best, abs=0.011)


def test_mechanical_mode_has_no_behaviour():
    eco, pols = india_economy(), india_policies()
    hh = sample_economy(eco, 300)
    out = simulate(pols[0], hh, "M0")[-1]
    assert np.allclose(out["pretax_income"], hh.y0)
    assert not out["evading"].any()


def test_information_gap_lowers_benefit_capture():
    eco, pols = india_economy(), india_policies()
    req = RunRequest(economy_id=eco.id, baseline_policy_id=pols[0].id, mode="M2")
    res = run_comparison(eco, pols[0], [], req)["results"][0]
    gap = res["report"]["summary"]["information"]["benefit_capture_rate"]
    assert gap < res["full_information"]["benefit_capture_rate"]


def test_revenue_neutral_runs_match_baseline_revenue():
    eco, pols = india_economy(), india_policies()
    req = RunRequest(economy_id=eco.id, baseline_policy_id=pols[0].id, policy_ids=[p.id for p in pols[1:]],
                     mode="M1", revenue_neutral=True, samples_per_set=400)
    results = run_comparison(eco, pols[0], pols[1:], req)["results"]
    base = results[0]["report"]["summary"]["revenue"]["net"]
    for r in results[1:]:
        assert r["report"]["summary"]["revenue"]["net"] == pytest.approx(base, rel=1e-3)

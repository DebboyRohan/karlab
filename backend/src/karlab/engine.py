"""The simulation engine.

    true policy -> information filter -> households decide -> government settles with true rules

Modes
    M0  mechanical: no behaviour, full compliance and full take-up
    M1  full information: everyone best-responds knowing the true policy (Stackelberg, with a
        Nash fixed point when audit capacity is limited)
    M2  information gap: households best-respond to the policy as they perceive it
    M3  adaptive: M2 repeated over periods while awareness and audit beliefs evolve
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from karlab.information import Perception, perceive
from karlab.policy.taxes import gst_share, transfer_eligible, wealth_tax
from karlab.population.sampler import Households, NOISE_COLUMNS
from karlab.responders import (
    BestResponder,
    Decisions,
    MechanicalResponder,
    Responder,
    effort_cost,
    household_income_tax,
    reported_base,
    sector_potentials,
    taxable_base,
)
from karlab.schemas import AWARENESS_KEYS, Mode, Policy

MAX_EQUILIBRIUM_ITERATIONS = 30
AUDIT_BELIEF_LEARNING = 0.3


@dataclass
class Outcome:
    """Per-household results of one period, plus equilibrium diagnostics."""

    arrays: dict[str, np.ndarray]
    transfers: dict[str, dict[str, np.ndarray]]
    audit_prob: float
    iterations: int
    converged: bool
    period: int = 0
    aware_share: dict[str, float] = field(default_factory=dict)

    def __getitem__(self, key: str) -> np.ndarray:
        return self.arrays[key]


def responder_for(mode: Mode) -> Responder:
    return MechanicalResponder() if mode == "M0" else BestResponder()


def settle(
    policy: Policy,
    hh: Households,
    dec: Decisions,
    perception: Perception,
    audit_prob: float,
    lump_sum: float = 0.0,
) -> tuple[dict[str, np.ndarray], dict[str, dict[str, np.ndarray]]]:
    """Apply the true policy to the households' decisions."""
    formal, z, report = dec.formal, dec.income, dec.report_share
    aware = perception.aware
    everyone = {k: np.ones(hh.n, dtype=bool) for k in AWARENESS_KEYS}

    base = taxable_base(policy, hh, z)
    reported = reported_base(base, hh.evadable_share, report)
    tax_paid = np.where(formal, household_income_tax(policy, hh, z, reported, aware), 0.0)
    tax_full_report = np.where(formal, household_income_tax(policy, hh, z, base, aware), 0.0)
    tax_statutory = np.where(formal, household_income_tax(policy, hh, z, base, everyone), 0.0)
    evaded = np.maximum(tax_full_report - tax_paid, 0.0)
    penalty = audit_prob * (1 + policy.enforcement.penalty_rate) * evaded
    reported_income = np.where(formal, reported + z * hh.agri_share, 0.0)

    avoidance = np.zeros(hh.n) if perception.full_compliance else hh.avoidance_access
    w_tax = wealth_tax(policy.wealth_tax, hh, avoidance)
    w_tax_statutory = wealth_tax(policy.wealth_tax, hh, np.zeros(hh.n))

    received_total = np.zeros(hh.n)
    entitled_total = np.zeros(hh.n)
    cost_total = np.zeros(hh.n)
    compliance = np.zeros(hh.n)
    per_transfer: dict[str, dict[str, np.ndarray]] = {}
    for k, tr in enumerate(policy.transfers):
        eligible = transfer_eligible(tr, hh, reported_income)
        if tr.requires_claim and not perception.full_compliance:
            claims = aware["transfers"] & (tr.amount_per_household > hh.compliance_cost)
            compliance += hh.compliance_cost * (eligible & claims)
        else:
            claims = np.ones(hh.n, dtype=bool)
        excluded = hh.noise[:, k % NOISE_COLUMNS] < tr.exclusion_error
        included = hh.noise[:, (k + NOISE_COLUMNS // 2) % NOISE_COLUMNS] < tr.inclusion_error
        gets = (eligible & claims & ~excluded) | (~eligible & included)
        amount = tr.amount_per_household
        received = amount * gets
        entitled = amount * eligible
        cost = received / (1 - tr.leakage)
        received_total += received
        entitled_total += entitled
        cost_total += cost
        per_transfer[tr.id] = {"received": received, "entitled": entitled, "cost": cost}

    disposable = z - tax_paid - penalty - w_tax + received_total - compliance + lump_sum
    consumption = hh.apc * np.maximum(disposable, 0.0)
    gst = consumption * gst_share(policy.consumption_tax, hh)
    y_formal, y_informal = sector_potentials(hh)
    effort = np.where(formal, effort_cost(z, y_formal, hh.eti), effort_cost(z, y_informal, hh.eti))
    utility = disposable - gst - effort

    arrays = {
        "formal": formal,
        "pretax_income": z,
        "potential_income": hh.y0,
        "report_share": report,
        "evading": formal & (report < 1.0) & (evaded > 0),
        "reported_income": reported_income,
        "income_tax": tax_paid,
        "income_tax_statutory": tax_statutory,
        "income_tax_full_report": tax_full_report,
        "evaded_tax": evaded,
        "penalty": penalty,
        "wealth_tax": w_tax,
        "wealth_tax_statutory": w_tax_statutory,
        "transfers": received_total,
        "transfers_entitled": entitled_total,
        "transfer_cost": cost_total,
        "compliance_cost": compliance,
        "lump_sum": np.full(hh.n, lump_sum),
        "disposable": disposable,
        "consumption": consumption,
        "gst": gst,
        "effort_cost": effort,
        "utility": utility,
    }
    return arrays, per_transfer


def solve_period(policy: Policy, hh: Households, mode: Mode, lump_sum: float = 0.0) -> Outcome:
    """One period. With limited audit capacity, iterate best responses to a Nash fixed point."""
    responder = responder_for(mode)
    enf = policy.enforcement
    p = enf.audit_prob
    iterations, converged = 1, True

    perception = perceive(hh, mode, p)
    dec = responder.respond(policy, hh, perception)
    if enf.audit_capacity is not None and mode != "M0":
        converged = False
        for iterations in range(1, MAX_EQUILIBRIUM_ITERATIONS + 1):
            evaders = float(np.sum(hh.weight * (dec.formal & (dec.report_share < 1.0))))
            p_target = 1.0 if evaders <= 0 else min(1.0, enf.audit_capacity / evaders)
            p_next = 0.5 * p + 0.5 * p_target
            if abs(p_next - p) < 1e-4:
                p, converged = p_next, True
                break
            p = p_next
            perception = perceive(hh, mode, p)
            dec = responder.respond(policy, hh, perception)

    arrays, per_transfer = settle(policy, hh, dec, perception, p, lump_sum)
    return Outcome(
        arrays=arrays,
        transfers=per_transfer,
        audit_prob=p,
        iterations=iterations,
        converged=converged,
        aware_share={k: float(np.average(perception.aware[k], weights=hh.weight)) for k in AWARENESS_KEYS},
    )


def _set_share(values: np.ndarray, hh: Households) -> np.ndarray:
    sets = len(hh.set_ids)
    num = np.bincount(hh.set_idx, weights=hh.weight * values, minlength=sets)
    den = np.bincount(hh.set_idx, weights=hh.weight, minlength=sets)
    return num / np.maximum(den, 1e-12)


def run_adaptive(
    policy: Policy, hh: Households, periods: int, lump_sum: float = 0.0, seed: int = 0
) -> list[Outcome]:
    """M3: awareness spreads within each set (Bass-style peer learning plus outreach),
    and households update audit beliefs toward the audit rate they observe."""
    rng = np.random.default_rng(seed + 9_973)
    current = hh
    outcomes: list[Outcome] = []
    for t in range(periods):
        out = solve_period(policy, current, "M2", lump_sum)
        out.period = t
        outcomes.append(out)

        aware = {}
        for key in AWARENESS_KEYS:
            share = _set_share(current.aware[key].astype(float), current)[current.set_idx]
            learn = np.clip(current.peer_learning * share + policy.outreach, 0.0, 1.0)
            aware[key] = current.aware[key] | (rng.random(current.n) < learn)
        beliefs = current.perceived_audit
        beliefs = np.where(np.isnan(beliefs), np.nan, beliefs + AUDIT_BELIEF_LEARNING * (out.audit_prob - beliefs))
        current = current.with_awareness(aware)
        current.perceived_audit = beliefs
    return outcomes


def simulate(
    policy: Policy, hh: Households, mode: Mode, periods: int = 1, lump_sum: float = 0.0, seed: int = 0
) -> list[Outcome]:
    """Run a policy. Returns one outcome per period (a single one unless mode is M3)."""
    if mode == "M3":
        return run_adaptive(policy, hh, periods, lump_sum, seed)
    return [solve_period(policy, hh, mode, lump_sum)]

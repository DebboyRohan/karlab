"""How households respond to a tax policy.

Every responder has the same interface, `respond(policy, hh, perception) -> Decisions`,
so the engine never needs to know whether a decision came from a formula or, later,
from a learned (RL) policy.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

import numpy as np

from karlab.information import Perception
from karlab.policy.taxes import income_tax, transfer_eligible
from karlab.population.sampler import Households
from karlab.schemas import Policy

REPORT_GRID = np.linspace(0.0, 1.0, 11)
LABOUR_GRID = np.linspace(0.3, 1.0, 57)


@dataclass
class Decisions:
    formal: np.ndarray  # works in the formal (taxed) sector
    income: np.ndarray  # pre-tax market income actually earned
    report_share: np.ndarray  # share of the evadable base that is reported


class Responder(Protocol):
    name: str

    def respond(self, policy: Policy, hh: Households, perception: Perception) -> Decisions: ...


# --------------------------------------------------------------------------- shared helpers


def sector_potentials(hh: Households) -> tuple[np.ndarray, np.ndarray]:
    """Untaxed income each household could earn formally and informally.

    `y0` is income in the household's current sector. Moving to the other sector loses a
    share `informality_penalty` of it, so households only switch when taxes make it worth it.
    """
    switched = hh.y0 * (1 - hh.informality_penalty)
    formal = np.where(hh.formal0, hh.y0, switched)
    informal = np.where(hh.formal0, switched, hh.y0)
    return formal, informal


def effort_cost(z: np.ndarray, y0: np.ndarray, eti: np.ndarray) -> np.ndarray:
    """Money cost of effort under iso-elastic quasi-linear utility.

    With u = c - v(z), the first-order condition gives z = y0 (1 - t)^eti.
    """
    e = np.maximum(eti, 1e-9)
    ratio = np.clip(z / y0, 0.0, 1.0)
    return np.where(eti > 1e-9, y0 * e / (1 + e) * ratio ** ((1 + e) / e), 0.0)


def _col(x: np.ndarray, like: np.ndarray) -> np.ndarray:
    """Reshape a per-household array to broadcast against `like` (which may have trailing axes)."""
    return x.reshape(x.shape + (1,) * (np.ndim(like) - 1))


def taxable_base(policy: Policy, hh: Households, z: np.ndarray) -> np.ndarray:
    exempt = _col(hh.agri_share, z) if policy.income_tax.exempt_agriculture else 0.0
    return z * (1 - exempt)


def reported_base(base: np.ndarray, evadable_share: np.ndarray, report_share: np.ndarray) -> np.ndarray:
    return base * (1 - evadable_share * (1 - report_share))


def household_income_tax(
    policy: Policy, hh: Households, z: np.ndarray, base: np.ndarray, aware: dict[str, np.ndarray]
) -> np.ndarray:
    """Income tax on `base` for market income `z`. Either may carry trailing grid axes."""
    shape = np.broadcast_shapes(np.shape(z), np.shape(base))
    like = np.empty(shape, dtype=bool)
    return income_tax(
        policy.income_tax,
        np.broadcast_to(base, shape),
        wage_income=z * _col(hh.wage_share, z),
        savings=z * _col(np.maximum(1 - hh.apc, 0.0), z),
        earners=_col(hh.earners, like),
        claims_rebate=_col(aware["rebate"], like),
        uses_deductions=_col(aware["deductions"], like),
    )


def perceived_transfer_value(
    policy: Policy, hh: Households, reported_income: np.ndarray, aware: dict[str, np.ndarray]
) -> np.ndarray:
    value = np.zeros(hh.n)
    for tr in policy.transfers:
        eligible = transfer_eligible(tr, hh, reported_income)
        if tr.requires_claim:
            eligible &= aware["transfers"] & (tr.amount_per_household > hh.compliance_cost)
        value += tr.amount_per_household * eligible
    return value


def _crra(c: np.ndarray, gamma: np.ndarray) -> np.ndarray:
    c = np.maximum(c, 1e-3)
    is_log = np.isclose(gamma, 1.0)
    g = np.where(is_log, 2.0, gamma)
    return np.where(is_log, np.log(c), (c ** (1 - g) - 1) / (1 - g))


# --------------------------------------------------------------------------- responders


class MechanicalResponder:
    """M0: nobody changes behaviour. Useful for pure accounting ("morning after") analysis."""

    name = "mechanical"

    def respond(self, policy: Policy, hh: Households, perception: Perception) -> Decisions:
        return Decisions(formal=hh.formal0.copy(), income=hh.y0.copy(), report_share=np.ones(hh.n))


class BestResponder:
    """M1-M3: each household best-responds to the policy *as it perceives it*.

    1. Labour/effort: z = y0 (1 - t)^eti, where t is the perceived marginal (or average) rate.
    2. Reporting: Allingham-Sandmo choice of how much evadable income to report.
    3. Sector: households able to switch compare formal and informal work.
    """

    name = "best_response"

    def respond(self, policy: Policy, hh: Households, perception: Perception) -> Decisions:
        aware = perception.aware
        y_formal, y_informal = sector_potentials(hh)
        z = self._labour(policy, hh, y_formal, aware, perception.rate_average)
        base = taxable_base(policy, hh, z)
        report = np.ones(hh.n)
        if policy.income_tax.enabled and not perception.full_compliance:
            report = self._reporting(policy, hh, z, base, aware, perception.audit_prob)

        formal = hh.formal0.copy()
        if not perception.full_compliance and hh.mobile.any():
            formal = self._sector(policy, hh, z, y_formal, y_informal, base, report, aware, perception.audit_prob)

        return Decisions(
            formal=formal,
            income=np.where(formal, z, y_informal),
            report_share=np.where(formal, report, 1.0),
        )

    def _labour(self, policy, hh, y0, aware, rate_average) -> np.ndarray:
        """Choose income to maximise z - T(z) - v(z).

        Households who know the schedule pick the best of a set of candidates: the interior
        optimum of every slab, z = y0 (1 - r)^eti, plus a fine grid. This handles kinks and
        the rebate notch correctly (people bunch below it). Households who only know their
        average rate respond to it as if the tax were proportional.
        """
        if not policy.income_tax.enabled:
            return y0.copy()
        it = policy.income_tax
        slab_rates = np.array([s.rate for s in it.slabs]) * (1 + it.cess)
        interior = y0[:, None] * (1 - np.clip(slab_rates, 0, 0.95))[None, :] ** hh.eti[:, None]
        grid = y0[:, None] * LABOUR_GRID[None, :]
        cand = np.concatenate([interior, grid], axis=1)
        tax = household_income_tax(policy, hh, cand, taxable_base(policy, hh, cand), aware)
        value = cand - tax - effort_cost(cand, y0[:, None], hh.eti[:, None])
        exact = cand[np.arange(hh.n), np.argmax(value, axis=1)]

        avg_rate = household_income_tax(policy, hh, y0, taxable_base(policy, hh, y0), aware) / np.maximum(y0, 1.0)
        proportional = y0 * (1 - np.clip(avg_rate, 0.0, 0.95)) ** hh.eti
        return np.where(rate_average, proportional, exact)

    def _reporting(self, policy, hh, z, base, aware, audit_prob) -> np.ndarray:
        reported = reported_base(base[:, None], hh.evadable_share[:, None], REPORT_GRID[None, :])
        tax = household_income_tax(policy, hh, z[:, None], reported, aware)
        evaded = tax[:, -1:] - tax
        theta = policy.enforcement.penalty_rate
        moral = hh.tax_morale[:, None] * evaded
        scale = np.maximum(z / hh.hh_size, 1.0)[:, None]
        c_free = (z[:, None] - tax - moral) / hh.hh_size[:, None] / scale
        c_caught = c_free - (1 + theta) * evaded / hh.hh_size[:, None] / scale
        gamma = hh.risk_aversion[:, None]
        p = audit_prob[:, None]
        expected = (1 - p) * _crra(c_free, gamma) + p * _crra(c_caught, gamma)
        return REPORT_GRID[np.argmax(expected, axis=1)]

    def _sector(self, policy, hh, z, y_formal, y_informal, base, report, aware, audit_prob) -> np.ndarray:
        theta = policy.enforcement.penalty_rate
        rep = reported_base(base, hh.evadable_share, report)
        tax = household_income_tax(policy, hh, z, rep, aware)
        evaded = household_income_tax(policy, hh, z, base, aware) - tax
        reported_income = rep + z * hh.agri_share
        u_formal = (
            z
            - tax
            - (audit_prob * (1 + theta) + hh.tax_morale) * evaded
            - effort_cost(z, y_formal, hh.eti)
            + perceived_transfer_value(policy, hh, reported_income, aware)
        )
        u_informal = (
            y_informal
            - effort_cost(y_informal, y_informal, hh.eti)
            + perceived_transfer_value(policy, hh, np.zeros(hh.n), aware)
        )
        return np.where(hh.mobile, u_formal >= u_informal, hh.formal0)


"""Turn population sets into a weighted table of synthetic households.

Each set is sampled with `n` households. Every sampled household stands in for
`set.households / n` real ones, so 50 sets x 1,500 samples can represent 1.4 billion people.
"""

from __future__ import annotations

import zlib
from dataclasses import dataclass, field, replace

import numpy as np
from scipy.special import ndtr, ndtri

from karlab.population.distributions import quantile
from karlab.schemas import AWARENESS_KEYS, GST_CATEGORIES, Economy, PopulationSet

REGION_CODES = {"urban": 0, "semi_urban": 1, "rural": 2}
NOISE_COLUMNS = 8


@dataclass
class Households:
    set_ids: list[str]
    set_names: list[str]
    set_tags: list[list[str]]
    set_idx: np.ndarray
    weight: np.ndarray  # real households represented by each row
    hh_size: np.ndarray
    earners: np.ndarray
    region: np.ndarray
    y0: np.ndarray  # potential pre-tax income with no taxes
    wage_share: np.ndarray
    agri_share: np.ndarray
    wealth: np.ndarray
    inherited_wealth: np.ndarray
    apc: np.ndarray
    formal0: np.ndarray
    mobile: np.ndarray
    aware: dict[str, np.ndarray]
    rate_average: np.ndarray
    perceived_audit: np.ndarray  # NaN means "same as true probability"
    compliance_cost: np.ndarray
    peer_learning: np.ndarray
    eti: np.ndarray
    risk_aversion: np.ndarray
    tax_morale: np.ndarray
    evadable_share: np.ndarray
    informality_penalty: np.ndarray
    avoidance_access: np.ndarray
    basket: np.ndarray  # (n, len(GST_CATEGORIES))
    informal_purchase_share: np.ndarray
    noise: np.ndarray  # (n, NOISE_COLUMNS) fixed uniforms for random errors
    extra: dict = field(default_factory=dict)

    @property
    def n(self) -> int:
        return self.y0.shape[0]

    @property
    def persons(self) -> np.ndarray:
        return self.weight * self.hh_size

    def with_awareness(self, aware: dict[str, np.ndarray]) -> Households:
        return replace(self, aware=aware)


def _set_seed(seed: int, set_id: str) -> int:
    return (seed * 1_000_003 + zlib.crc32(set_id.encode())) % 2**32


def sample_set(ps: PopulationSet, n: int, seed: int) -> dict[str, np.ndarray]:
    rng = np.random.default_rng(_set_seed(seed, ps.id))
    # Stratified uniforms for income give smooth coverage of the whole distribution.
    u_income = (rng.permutation(n) + rng.random(n)) / n
    z_income = ndtri(np.clip(u_income, 1e-9, 1 - 1e-9))
    rho = ps.income_wealth_correlation
    z_wealth = rho * z_income + np.sqrt(1 - rho**2) * rng.standard_normal(n)

    y0 = quantile(ps.income, ndtr(z_income))
    wealth = quantile(ps.wealth, ndtr(z_wealth))

    c = ps.consumption
    apc = c.apc_at_median * (y0 / ps.income.median) ** c.apc_income_elasticity
    apc *= np.exp(c.apc_dispersion * rng.standard_normal(n))
    apc = np.clip(apc, 0.2, 1.4)

    basket = np.array([c.basket.get(k, 0.0) for k in GST_CATEGORIES], dtype=float)
    basket = basket / basket.sum() if basket.sum() > 0 else np.full(len(GST_CATEGORIES), 1 / len(GST_CATEGORIES))

    info, beh = ps.information, ps.behavior
    aware = {k: rng.random(n) < info.awareness.get(k, 1.0) for k in AWARENESS_KEYS}

    full = lambda v: np.full(n, float(v))  # noqa: E731
    return {
        "weight": full(ps.households / n),
        "hh_size": full(ps.demographics.household_size),
        "earners": full(ps.demographics.earners_per_household),
        "region": np.full(n, REGION_CODES[ps.region]),
        "y0": y0,
        "wage_share": full(ps.income_sources.wage),
        "agri_share": full(ps.income_sources.agriculture),
        "wealth": wealth,
        "inherited_wealth": wealth * ps.inherited_wealth_share,
        "apc": apc,
        "formal0": rng.random(n) < ps.formal_share,
        "mobile": rng.random(n) < beh.mobility,
        "aware": aware,
        "rate_average": np.full(n, info.rate_perception == "average"),
        "perceived_audit": full(np.nan if info.perceived_audit_prob is None else info.perceived_audit_prob),
        "compliance_cost": full(info.compliance_cost),
        "peer_learning": full(info.peer_learning),
        "eti": full(beh.eti),
        "risk_aversion": full(beh.risk_aversion),
        "tax_morale": full(beh.tax_morale),
        "evadable_share": full(beh.evadable_share),
        "informality_penalty": full(beh.informality_penalty),
        "avoidance_access": full(beh.avoidance_access),
        "basket": np.tile(basket, (n, 1)),
        "informal_purchase_share": full(c.informal_purchase_share),
        "noise": rng.random((n, NOISE_COLUMNS)),
    }


def sample_economy(economy: Economy, n_per_set: int | None = None, seed: int | None = None) -> Households:
    if not economy.sets:
        raise ValueError("the economy has no population sets")
    n = n_per_set or economy.settings.samples_per_set
    seed = economy.settings.seed if seed is None else seed
    parts = [sample_set(ps, n, seed) for ps in economy.sets]

    def cat(key: str) -> np.ndarray:
        return np.concatenate([p[key] for p in parts])

    keys = [k for k in parts[0] if k != "aware"]
    data = {k: cat(k) for k in keys}
    aware = {k: np.concatenate([p["aware"][k] for p in parts]) for k in AWARENESS_KEYS}
    set_idx = np.concatenate([np.full(n, i) for i in range(len(parts))])
    return Households(
        set_ids=[s.id for s in economy.sets],
        set_names=[s.name for s in economy.sets],
        set_tags=[list(s.tags) for s in economy.sets],
        set_idx=set_idx,
        aware=aware,
        **data,
    )

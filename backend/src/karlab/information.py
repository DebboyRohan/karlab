"""The information filter: what each household believes about the policy.

Households decide using their *perceived* policy; the government settles taxes with the *true* one.
The difference between the two is the information gap.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from karlab.population.sampler import Households
from karlab.schemas import AWARENESS_KEYS, Mode


@dataclass
class Perception:
    aware: dict[str, np.ndarray]
    audit_prob: np.ndarray
    rate_average: np.ndarray
    full_compliance: bool = False  # M0: no evasion, no avoidance, no sector switching


def perceive(hh: Households, mode: Mode, true_audit_prob: float) -> Perception:
    if mode in ("M0", "M1"):
        everyone = np.ones(hh.n, dtype=bool)
        return Perception(
            aware={k: everyone for k in AWARENESS_KEYS},
            audit_prob=np.full(hh.n, true_audit_prob),
            rate_average=np.zeros(hh.n, dtype=bool),
            full_compliance=mode == "M0",
        )
    audit = np.where(np.isnan(hh.perceived_audit), true_audit_prob, hh.perceived_audit)
    return Perception(aware=hh.aware, audit_prob=audit, rate_average=hh.rate_average)

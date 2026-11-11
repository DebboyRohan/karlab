"""Quantile functions for the distributions a population set can use.

Sampling goes through quantile functions so that a Gaussian copula can tie
income, wealth and other variables together with one correlation number.
"""

from __future__ import annotations

import numpy as np
from scipy.special import ndtri

from karlab.schemas import Distribution


def quantile(dist: Distribution, u: np.ndarray) -> np.ndarray:
    u = np.clip(u, 1e-9, 1 - 1e-9)
    if dist.kind == "lognormal":
        return dist.median * np.exp(dist.sigma * ndtri(u))
    if dist.kind == "pareto":
        x_min = dist.median / 2 ** (1 / dist.pareto_alpha)
        return x_min * (1 - u) ** (-1 / dist.pareto_alpha)
    if dist.kind == "lognormal_pareto":
        q = dist.tail_start_quantile
        body = dist.median * np.exp(dist.sigma * ndtri(np.minimum(u, q)))
        x_q = dist.median * np.exp(dist.sigma * ndtri(q))
        tail = x_q * ((1 - q) / (1 - np.maximum(u, q))) ** (1 / dist.pareto_alpha)
        return np.where(u <= q, body, tail)
    raise ValueError(f"unknown distribution kind {dist.kind!r}")

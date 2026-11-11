"""Data model for economies, population sets, tax policies and runs.

Everything an economist edits in the UI is one of these models, stored as JSON.
Money is in rupees per year unless a field says otherwise.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

Region = Literal["urban", "semi_urban", "rural"]
GST_CATEGORIES = ("exempt", "reduced", "standard", "demerit")
AWARENESS_KEYS = ("rebate", "deductions", "transfers")


# --------------------------------------------------------------------------- population


class Distribution(BaseModel):
    """A one-dimensional positive distribution, described by its quantile function."""

    kind: Literal["lognormal", "lognormal_pareto", "pareto"] = "lognormal"
    median: float = Field(300_000, gt=0)
    sigma: float = Field(0.6, gt=0, le=3, description="Log standard deviation")
    pareto_alpha: float = Field(1.8, gt=1.0, description="Pareto tail index (smaller = fatter tail)")
    tail_start_quantile: float = Field(0.9, gt=0, lt=1, description="Where the Pareto tail begins")


class IncomeSources(BaseModel):
    wage: float = Field(0.5, ge=0)
    self_employment: float = Field(0.3, ge=0)
    agriculture: float = Field(0.1, ge=0)
    capital: float = Field(0.1, ge=0)

    @model_validator(mode="after")
    def _normalise(self) -> IncomeSources:
        total = self.wage + self.self_employment + self.agriculture + self.capital
        if total <= 0:
            raise ValueError("income sources must have a positive total")
        self.wage /= total
        self.self_employment /= total
        self.agriculture /= total
        self.capital /= total
        return self


class Demographics(BaseModel):
    household_size: float = Field(4.4, ge=1)
    earners_per_household: float = Field(1.4, ge=1)


class Consumption(BaseModel):
    apc_at_median: float = Field(0.8, gt=0, le=1.5, description="Spending as a share of disposable income, at the set median")
    apc_income_elasticity: float = Field(-0.15, le=0.5, description="How the spending share changes with income")
    apc_dispersion: float = Field(0.08, ge=0, le=1)
    basket: dict[str, float] = Field(
        default_factory=lambda: {"exempt": 0.3, "reduced": 0.4, "standard": 0.27, "demerit": 0.03}
    )
    informal_purchase_share: float = Field(0.3, ge=0, le=1, description="Share of spending where GST is not collected")


class Behavior(BaseModel):
    eti: float = Field(0.2, ge=0, le=2, description="Elasticity of taxable income")
    mobility: float = Field(0.1, ge=0, le=1, description="Share of households able to switch formal/informal")
    informality_penalty: float = Field(0.15, ge=0, le=1, description="Share of income lost when switching between formal and informal work")
    evadable_share: float = Field(0.3, ge=0, le=1, description="Share of the tax base not third-party reported")
    risk_aversion: float = Field(2.0, gt=0, le=10)
    tax_morale: float = Field(0.3, ge=0, le=1, description="Moral cost per rupee of tax evaded")
    avoidance_access: float = Field(0.0, ge=0, le=1, description="Share of wealth that can be moved out of the tax base")


class Information(BaseModel):
    literacy: float = Field(0.75, ge=0, le=1)
    awareness: dict[str, float] = Field(
        default_factory=lambda: {"rebate": 0.6, "deductions": 0.4, "transfers": 0.7}
    )
    rate_perception: Literal["exact", "average"] = "exact"
    perceived_audit_prob: float | None = Field(None, ge=0, le=1, description="Blank = same as the true probability")
    compliance_cost: float = Field(1_000, ge=0, description="Cost of filing or claiming a benefit (₹)")
    peer_learning: float = Field(0.15, ge=0, le=1, description="Per-period rate at which awareness spreads")


class PopulationSet(BaseModel):
    id: str
    name: str
    description: str = ""
    region: Region = "urban"
    population: float = Field(10_000_000, gt=0, description="People represented")
    tags: list[str] = Field(default_factory=list)
    demographics: Demographics = Field(default_factory=Demographics)
    income: Distribution = Field(default_factory=Distribution)
    income_sources: IncomeSources = Field(default_factory=IncomeSources)
    formal_share: float = Field(0.5, ge=0, le=1)
    wealth: Distribution = Field(default_factory=lambda: Distribution(median=800_000, sigma=1.2))
    inherited_wealth_share: float = Field(0.4, ge=0, le=1)
    income_wealth_correlation: float = Field(0.6, ge=-0.99, le=0.99)
    consumption: Consumption = Field(default_factory=Consumption)
    behavior: Behavior = Field(default_factory=Behavior)
    information: Information = Field(default_factory=Information)
    sources: list[str] = Field(default_factory=list, description="Data sources used to set the numbers")

    @property
    def households(self) -> float:
        return self.population / self.demographics.household_size


class CalibrationTargets(BaseModel):
    """National totals the aggregated sets should reproduce. Blank fields are skipped."""

    population: float | None = None
    total_income: float | None = None
    income_tax_revenue: float | None = None
    gst_revenue: float | None = None
    income_tax_payers: float | None = None
    gini_income: float | None = None


class EconomySettings(BaseModel):
    samples_per_set: int = Field(1500, ge=100, le=20_000)
    poverty_line_per_capita: float = Field(36_000, gt=0)
    seed: int = 7


class Economy(BaseModel):
    id: str
    name: str
    description: str = ""
    currency: str = "₹"
    year: str = ""
    sets: list[PopulationSet] = Field(default_factory=list)
    targets: CalibrationTargets = Field(default_factory=CalibrationTargets)
    settings: EconomySettings = Field(default_factory=EconomySettings)


# --------------------------------------------------------------------------- policy


class Slab(BaseModel):
    threshold: float = Field(ge=0, description="Rate applies to income above this")
    rate: float = Field(ge=0, le=1)


class IncomeTax(BaseModel):
    enabled: bool = True
    slabs: list[Slab] = Field(default_factory=lambda: [Slab(threshold=0, rate=0.0)])
    standard_deduction: float = Field(0, ge=0, description="Automatic deduction from wage income, per earner")
    rebate_threshold: float = Field(0, ge=0, description="Taxable income up to which the rebate applies")
    rebate_max: float = Field(0, ge=0)
    rebate_requires_claim: bool = True
    optional_deduction_cap: float = Field(0, ge=0, description="Savings-linked deduction (like 80C), needs awareness")
    exempt_agriculture: bool = True
    cess: float = Field(0.0, ge=0, le=0.2)

    @model_validator(mode="after")
    def _sort(self) -> IncomeTax:
        self.slabs = sorted(self.slabs, key=lambda s: s.threshold)
        if not self.slabs or self.slabs[0].threshold > 0:
            self.slabs.insert(0, Slab(threshold=0, rate=0.0))
        return self


class ConsumptionTax(BaseModel):
    enabled: bool = True
    rates: dict[str, float] = Field(
        default_factory=lambda: {"exempt": 0.0, "reduced": 0.05, "standard": 0.18, "demerit": 0.40}
    )


class WealthTax(BaseModel):
    enabled: bool = False
    threshold: float = Field(50_000_000, ge=0)
    rate: float = Field(0.01, ge=0, le=0.2)


class TargetRule(BaseModel):
    regions: list[Region] | None = None
    tags_any: list[str] | None = None
    max_reported_income: float | None = Field(None, description="Means test on reported household income")


class Transfer(BaseModel):
    id: str
    name: str
    kind: Literal["universal", "targeted"] = "targeted"
    amount_per_household: float = Field(6_000, ge=0)
    target: TargetRule = Field(default_factory=TargetRule)
    requires_claim: bool = True
    leakage: float = Field(0.0, ge=0, lt=1, description="Share of spending lost before it reaches households")
    exclusion_error: float = Field(0.0, ge=0, le=1)
    inclusion_error: float = Field(0.0, ge=0, le=1)


class Enforcement(BaseModel):
    audit_prob: float = Field(0.02, ge=0, le=1)
    penalty_rate: float = Field(1.0, ge=0, le=10, description="Penalty as a multiple of tax evaded")
    audit_capacity: float | None = Field(
        None, ge=0, description="Households audited per year. If set, audit odds fall as more people evade"
    )


class Policy(BaseModel):
    id: str
    name: str
    description: str = ""
    origin: Literal["user", "baseline", "theory"] = "user"
    income_tax: IncomeTax = Field(default_factory=IncomeTax)
    consumption_tax: ConsumptionTax = Field(default_factory=ConsumptionTax)
    wealth_tax: WealthTax = Field(default_factory=WealthTax)
    transfers: list[Transfer] = Field(default_factory=list)
    enforcement: Enforcement = Field(default_factory=Enforcement)
    outreach: float = Field(0.0, ge=0, le=1, description="Awareness campaign: extra learning per period (mode M3)")


# --------------------------------------------------------------------------- runs

Mode = Literal["M0", "M1", "M2", "M3"]
MODE_LABELS = {
    "M0": "Mechanical (no behavior)",
    "M1": "Full information equilibrium",
    "M2": "Information gap",
    "M3": "Adaptive learning over time",
}


class RunRequest(BaseModel):
    economy_id: str
    baseline_policy_id: str
    policy_ids: list[str] = Field(default_factory=list)
    mode: Mode = "M2"
    periods: int = Field(8, ge=1, le=50, description="Used by M3")
    revenue_neutral: bool = False
    inequality_aversion: float = Field(1.0, ge=0, le=5)
    samples_per_set: int | None = Field(None, ge=100, le=20_000)
    seed: int | None = None
    name: str = ""

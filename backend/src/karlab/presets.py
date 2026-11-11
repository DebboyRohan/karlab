"""Starter economy and policies.

The India economy here is ILLUSTRATIVE: the numbers are plausible orders of magnitude
chosen to demonstrate the tool, not a calibration. Replace them with PLFS / HCES / AIDIS /
WID based values and use the calibration screen to check the aggregates.
"""

from __future__ import annotations

from karlab.schemas import (
    Behavior,
    CalibrationTargets,
    Consumption,
    ConsumptionTax,
    Demographics,
    Distribution,
    Economy,
    Enforcement,
    IncomeSources,
    IncomeTax,
    Information,
    Policy,
    PopulationSet,
    Slab,
    TargetRule,
    Transfer,
)

LAKH, CRORE = 1e5, 1e7
ILLUSTRATIVE = ["Illustrative values for demonstration; not yet calibrated"]


def _set(
    id, name, region, population, *, hh_size, earners, income, sources, formal, wealth, apc, basket,
    informal_buy, eti, mobility, evadable, morale, aware, compliance, tags=(), rate="exact",
    audit_belief=None, avoidance=0.0, inherited=0.4, peer=0.15, literacy=0.7, description="",
) -> PopulationSet:
    return PopulationSet(
        id=id,
        name=name,
        description=description,
        region=region,
        population=population,
        tags=list(tags),
        demographics=Demographics(household_size=hh_size, earners_per_household=earners),
        income=income,
        income_sources=IncomeSources(**dict(zip(("wage", "self_employment", "agriculture", "capital"), sources))),
        formal_share=formal,
        wealth=wealth,
        inherited_wealth_share=inherited,
        consumption=Consumption(
            apc_at_median=apc,
            basket=dict(zip(("exempt", "reduced", "standard", "demerit"), basket)),
            informal_purchase_share=informal_buy,
        ),
        behavior=Behavior(
            eti=eti, mobility=mobility, evadable_share=evadable, tax_morale=morale, avoidance_access=avoidance
        ),
        information=Information(
            literacy=literacy,
            awareness=dict(zip(("rebate", "deductions", "transfers"), aware)),
            rate_perception=rate,
            perceived_audit_prob=audit_belief,
            compliance_cost=compliance,
            peer_learning=peer,
        ),
        sources=ILLUSTRATIVE,
    )


def lognormal(median, sigma):
    return Distribution(kind="lognormal", median=median, sigma=sigma)


def lognormal_pareto(median, sigma, alpha, tail=0.9):
    return Distribution(kind="lognormal_pareto", median=median, sigma=sigma, pareto_alpha=alpha, tail_start_quantile=tail)


def india_economy() -> Economy:
    sets = [
        _set("rural_landless", "Rural landless casual labour", "rural", 250e6, hh_size=4.6, earners=1.8,
             income=lognormal(1.3 * LAKH, 0.45), sources=(0.75, 0.1, 0.15, 0.0), formal=0.02,
             wealth=lognormal(1.5 * LAKH, 1.0), apc=0.97, basket=(0.45, 0.40, 0.13, 0.02), informal_buy=0.6,
             eti=0.1, mobility=0.05, evadable=0.8, morale=0.3, aware=(0.1, 0.05, 0.55), compliance=1500,
             tags=("bpl",), rate="average", audit_belief=0.01, literacy=0.55, inherited=0.6),
        _set("rural_marginal_farmers", "Rural marginal & small farmers", "rural", 280e6, hh_size=4.8, earners=1.9,
             income=lognormal(1.6 * LAKH, 0.5), sources=(0.25, 0.1, 0.62, 0.03), formal=0.03,
             wealth=lognormal(6 * LAKH, 1.0), apc=0.93, basket=(0.45, 0.38, 0.15, 0.02), informal_buy=0.55,
             eti=0.1, mobility=0.03, evadable=0.8, morale=0.3, aware=(0.1, 0.05, 0.7), compliance=1500,
             tags=("farmer", "bpl"), rate="average", audit_belief=0.01, literacy=0.6, inherited=0.85),
        _set("rural_large_farmers", "Rural large farmers", "rural", 35e6, hh_size=5.2, earners=2.0,
             income=lognormal_pareto(6 * LAKH, 0.7, 2.2), sources=(0.05, 0.1, 0.75, 0.1), formal=0.15,
             wealth=lognormal(60 * LAKH, 1.1), apc=0.7, basket=(0.35, 0.35, 0.25, 0.05), informal_buy=0.4,
             eti=0.15, mobility=0.1, evadable=0.6, morale=0.2, aware=(0.4, 0.3, 0.85), compliance=1000,
             tags=("farmer",), avoidance=0.2, literacy=0.75, inherited=0.9),
        _set("rural_nonfarm_self", "Rural non-farm self-employed", "rural", 170e6, hh_size=4.6, earners=1.6,
             income=lognormal(2.2 * LAKH, 0.6), sources=(0.25, 0.6, 0.1, 0.05), formal=0.05,
             wealth=lognormal(4 * LAKH, 1.1), apc=0.9, basket=(0.4, 0.38, 0.19, 0.03), informal_buy=0.55,
             eti=0.2, mobility=0.1, evadable=0.8, morale=0.25, aware=(0.15, 0.1, 0.5), compliance=1500,
             tags=("bpl",), rate="average", audit_belief=0.01, literacy=0.65),
        _set("rural_salaried", "Rural salaried workers", "rural", 80e6, hh_size=4.3, earners=1.4,
             income=lognormal(4.2 * LAKH, 0.5), sources=(0.8, 0.05, 0.1, 0.05), formal=0.55,
             wealth=lognormal(8 * LAKH, 1.0), apc=0.82, basket=(0.35, 0.38, 0.24, 0.03), informal_buy=0.4,
             eti=0.15, mobility=0.05, evadable=0.15, morale=0.4, aware=(0.55, 0.35, 0.5), compliance=1000,
             literacy=0.85),
        _set("semi_urban_informal", "Semi-urban informal workers", "semi_urban", 160e6, hh_size=4.4, earners=1.6,
             income=lognormal(2.4 * LAKH, 0.5), sources=(0.7, 0.25, 0.0, 0.05), formal=0.08,
             wealth=lognormal(3 * LAKH, 1.1), apc=0.93, basket=(0.4, 0.38, 0.19, 0.03), informal_buy=0.5,
             eti=0.15, mobility=0.15, evadable=0.7, morale=0.3, aware=(0.15, 0.1, 0.5), compliance=1500,
             tags=("bpl",), rate="average", audit_belief=0.01, literacy=0.7),
        _set("semi_urban_traders", "Semi-urban traders & MSME owners", "semi_urban", 80e6, hh_size=4.5, earners=1.5,
             income=lognormal_pareto(4.8 * LAKH, 0.75, 2.0, 0.92), sources=(0.1, 0.75, 0.0, 0.15), formal=0.3,
             wealth=lognormal(25 * LAKH, 1.1), apc=0.78, basket=(0.3, 0.35, 0.3, 0.05), informal_buy=0.35,
             eti=0.3, mobility=0.3, evadable=0.7, morale=0.3, aware=(0.5, 0.45, 0.4), compliance=1000,
             avoidance=0.1, literacy=0.8),
        _set("urban_informal", "Urban informal & casual workers", "urban", 160e6, hh_size=4.2, earners=1.6,
             income=lognormal(2.6 * LAKH, 0.5), sources=(0.75, 0.22, 0.0, 0.03), formal=0.1,
             wealth=lognormal(2 * LAKH, 1.1), apc=0.95, basket=(0.38, 0.38, 0.21, 0.03), informal_buy=0.5,
             eti=0.15, mobility=0.2, evadable=0.7, morale=0.3, aware=(0.2, 0.1, 0.45), compliance=1500,
             tags=("bpl",), rate="average", audit_belief=0.01, literacy=0.7),
        _set("urban_formal_lower", "Urban formal salaried, lower-middle", "urban", 115e6, hh_size=3.9, earners=1.4,
             income=lognormal(5.5 * LAKH, 0.45), sources=(0.9, 0.03, 0.0, 0.07), formal=0.85,
             wealth=lognormal(10 * LAKH, 1.0), apc=0.82, basket=(0.3, 0.37, 0.29, 0.04), informal_buy=0.3,
             eti=0.15, mobility=0.05, evadable=0.1, morale=0.4, aware=(0.7, 0.5, 0.35), compliance=800,
             rate="average", literacy=0.92),
        _set("urban_formal_middle", "Urban formal salaried, upper-middle", "urban", 85e6, hh_size=3.7, earners=1.5,
             income=lognormal(15 * LAKH, 0.5), sources=(0.85, 0.05, 0.0, 0.1), formal=0.95,
             wealth=lognormal(40 * LAKH, 0.9), apc=0.68, basket=(0.25, 0.33, 0.37, 0.05), informal_buy=0.2,
             eti=0.25, mobility=0.03, evadable=0.1, morale=0.4, aware=(0.95, 0.85, 0.2), compliance=500,
             literacy=0.98),
        _set("urban_professionals", "Urban professionals & business owners", "urban", 32e6, hh_size=3.6, earners=1.6,
             income=lognormal_pareto(36 * LAKH, 0.6, 1.9, 0.85), sources=(0.35, 0.45, 0.0, 0.2), formal=0.8,
             wealth=lognormal(2 * CRORE, 1.0), apc=0.5, basket=(0.2, 0.3, 0.42, 0.08), informal_buy=0.15,
             eti=0.4, mobility=0.1, evadable=0.35, morale=0.5, aware=(0.95, 0.95, 0.15), compliance=300,
             avoidance=0.3, audit_belief=0.08, literacy=1.0),
        _set("top_elite", "Top 0.1% (business & capital income)", "urban", 1.5e6, hh_size=4.0, earners=1.8,
             income=Distribution(kind="pareto", median=4 * CRORE, pareto_alpha=1.6),
             sources=(0.2, 0.3, 0.0, 0.5), formal=0.9,
             wealth=Distribution(kind="pareto", median=40 * CRORE, pareto_alpha=1.4),
             apc=0.25, basket=(0.15, 0.25, 0.45, 0.15), informal_buy=0.1,
             eti=0.5, mobility=0.05, evadable=0.3, morale=0.5, aware=(1.0, 1.0, 0.1), compliance=0,
             avoidance=0.5, audit_belief=0.15, inherited=0.6, literacy=1.0),
    ]
    return Economy(
        id="india_illustrative",
        name="India (illustrative, 12 sets)",
        description=(
            "A 12-set starter economy for India. Values are illustrative orders of magnitude; "
            "replace them with survey-based numbers and check the calibration panel. Only household "
            "consumption is modelled, so simulated GST will sit below total GST collections."
        ),
        year="2025-26",
        sets=sets,
        targets=CalibrationTargets(
            population=1.45e9,
            total_income=230 * LAKH * CRORE,
            income_tax_revenue=12 * LAKH * CRORE,
            gst_revenue=20 * LAKH * CRORE,
            income_tax_payers=3.0e7,
            gini_income=0.55,
        ),
    )


def _gst() -> ConsumptionTax:
    return ConsumptionTax(rates={"exempt": 0.0, "reduced": 0.05, "standard": 0.18, "demerit": 0.40})


def _india_transfers(requires_claim: bool = True) -> list[Transfer]:
    return [
        Transfer(id="farmer_support", name="Farmer income support (PM-KISAN style)", kind="targeted",
                 amount_per_household=6_000, target=TargetRule(tags_any=["farmer"]), requires_claim=requires_claim,
                 leakage=0.05, exclusion_error=0.15, inclusion_error=0.03),
        Transfer(id="food_subsidy", name="Food subsidy (PDS style, cash value)", kind="targeted",
                 amount_per_household=9_000, target=TargetRule(tags_any=["bpl"]), requires_claim=requires_claim,
                 leakage=0.15, exclusion_error=0.2, inclusion_error=0.08),
    ]


NEW_REGIME_SLABS = [
    Slab(threshold=0, rate=0.0), Slab(threshold=4 * LAKH, rate=0.05), Slab(threshold=8 * LAKH, rate=0.10),
    Slab(threshold=12 * LAKH, rate=0.15), Slab(threshold=16 * LAKH, rate=0.20),
    Slab(threshold=20 * LAKH, rate=0.25), Slab(threshold=24 * LAKH, rate=0.30),
]


def india_policies() -> list[Policy]:
    status_quo = Policy(
        id="india_status_quo",
        name="India status quo (new regime FY2025-26 + GST)",
        description=(
            "New income tax regime slabs from Budget 2025 with ₹75,000 standard deduction, rebate up to ₹12 lakh, "
            "4% cess; GST at 0/5/18/40%; farmer support and food subsidy. Verify against current law."
        ),
        origin="baseline",
        income_tax=IncomeTax(slabs=NEW_REGIME_SLABS, standard_deduction=75_000, rebate_threshold=12 * LAKH,
                             rebate_max=60_000, rebate_requires_claim=True, cess=0.04),
        consumption_tax=_gst(),
        transfers=_india_transfers(),
        enforcement=Enforcement(audit_prob=0.02, penalty_rate=2.0),
    )
    old_regime = Policy(
        id="india_old_regime",
        name="Old regime with deductions",
        description="Old-regime slabs with a ₹1.5 lakh savings-linked deduction (80C style). Shows who benefits from deductions.",
        income_tax=IncomeTax(
            slabs=[Slab(threshold=0, rate=0.0), Slab(threshold=2.5 * LAKH, rate=0.05),
                   Slab(threshold=5 * LAKH, rate=0.20), Slab(threshold=10 * LAKH, rate=0.30)],
            standard_deduction=50_000, rebate_threshold=5 * LAKH, rebate_max=12_500,
            optional_deduction_cap=1.5 * LAKH, cess=0.04),
        consumption_tax=_gst(),
        transfers=_india_transfers(),
    )
    flat_ubi = Policy(
        id="flat_ubi",
        name="Flat 15% above ₹3 lakh + universal basic income",
        description="One rate above an exemption, plus ₹12,000 per household for everyone with no claim needed.",
        income_tax=IncomeTax(slabs=[Slab(threshold=0, rate=0.0), Slab(threshold=3 * LAKH, rate=0.15)], cess=0.0),
        consumption_tax=_gst(),
        transfers=[Transfer(id="ubi", name="Universal basic income", kind="universal",
                            amount_per_household=12_000, requires_claim=False, leakage=0.03)],
    )
    auto_enrol = status_quo.model_copy(deep=True)
    auto_enrol.id = "status_quo_auto_enrol"
    auto_enrol.origin = "user"
    auto_enrol.name = "Status quo + automatic rebate and auto-enrolment"
    auto_enrol.description = "Same taxes as the status quo, but the rebate and transfers need no claim, plus an awareness campaign."
    auto_enrol.income_tax.rebate_requires_claim = False
    auto_enrol.transfers = _india_transfers(requires_claim=False)
    auto_enrol.outreach = 0.1
    return [status_quo, old_regime, flat_ubi, auto_enrol]

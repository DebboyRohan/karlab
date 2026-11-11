# KarLab

A population-set tax policy simulator. An economist describes a country as a list of
**population sets** (groups of people with distributions of income, wealth, spending,
behaviour and awareness), designs **tax policies** (income tax slabs, GST, wealth tax,
transfers, enforcement), and compares them against a baseline and against textbook
optimal-tax theory. Everything is done through the web UI.

BTP-1 (IIT Kharagpur, BS-MS Economics). The later BTP-2 adds multi-agent RL responders
and an RL planner on top of the same engine.

## Run it

Requirements: Python 3.11+ with [uv](https://docs.astral.sh/uv/), Node 20+.

```bash
./run.sh          # builds the UI, then serves everything at http://localhost:8000
./run.sh dev      # development: API on :8000 with reload, UI on :5173 with hot reload
```

Data lives in `workspace/` as plain JSON (`economies/`, `policies/`, `runs/`). On first start
it is seeded with an illustrative 12-set India economy and four policies.

Tests: `cd backend && uv run pytest`

## How it works

```
true policy ─► information filter ─► households decide ─► government settles with true rules ─► analytics
               (what each set knows)  (effort, reporting,      (taxes, penalties, transfers,        (overall and
                                       sector, claims)          leakage, GST)                         per set)
```

| Mode | Behaviour |
|------|-----------|
| M0 | Mechanical: no behaviour change, full compliance and take-up |
| M1 | Full information: households best-respond to the true policy (Stackelberg); with limited audit capacity, a Nash fixed point among evaders |
| M2 | Information gap: households act on the policy as they perceive it (missed rebates, deductions, benefits; average-rate perception; audit beliefs) |
| M3 | Adaptive: M2 repeated over periods while awareness spreads within sets and audit beliefs update |

Household responses (`backend/src/karlab/responders.py`):

- **Effort / taxable income**: quasi-linear iso-elastic utility, so with a flat rate `z = y0 (1 − t)^ETI`.
  With slabs and the rebate notch, each household picks the best of the slab-interior optima and a grid.
- **Reporting**: Allingham–Sandmo with CRRA risk aversion and a tax-morale cost.
- **Sector**: households able to switch compare formal and informal work, including transfer eligibility.
- **Claims**: benefits and rebates are only used by aware households, and only when worth the compliance cost.

Validation: `tests/test_core.py` checks that brute-force welfare maximisation through the full
engine reproduces the Piketty–Saez linear optimal tax in an ideal economy, plus hand-computed
Indian income tax cases.

## Layout

```
backend/src/karlab/
  schemas.py          data model (economy, population set, policy, run request)
  population/         distributions and the weighted household sampler
  policy/taxes.py     vectorised tax and transfer rules
  information.py      perception filter (true → perceived policy)
  responders.py       household decision rules; BTP-2 adds an RL responder here
  engine.py           settlement, equilibrium loop, modes M0–M3
  analytics.py        equality, equity, efficiency, welfare, Pareto, information-gap metrics
  compare.py          baseline vs N policies, revenue neutrality
  theory.py           Piketty–Saez linear optimum and Saez top rate
  calibration.py      simulated vs national totals
  api.py              FastAPI app (also serves the built UI)
frontend/src/         React + Mantine UI
```

The India preset is **illustrative**. Its numbers are plausible orders of magnitude, not a
calibration; replace them with PLFS, HCES, AIDIS and WID based values.

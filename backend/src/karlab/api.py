"""HTTP API used by the KarLab web interface.

Run with:  uv run uvicorn karlab.api:app --reload
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from karlab import __version__
from karlab.analytics import weighted_quantile
from karlab.calibration import calibrate
from karlab.compare import run_comparison
from karlab.policy.taxes import income_tax
from karlab.population.sampler import sample_set
from karlab.schemas import (
    AWARENESS_KEYS,
    GST_CATEGORIES,
    MODE_LABELS,
    Economy,
    IncomeTax,
    Mode,
    Policy,
    PopulationSet,
    RunRequest,
)
from karlab.storage import Store, new_id
from karlab.theory import linear_optimum_policy, saez_top_policy

app = FastAPI(title="KarLab", version=__version__)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
store = Store()


def _not_found(kind: str, item_id: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"No {kind} with id “{item_id}”")


def _get_economy(item_id: str) -> Economy:
    try:
        return store.economy(item_id)
    except KeyError:
        raise _not_found("economy", item_id) from None


def _get_policy(item_id: str) -> Policy:
    try:
        return store.policy(item_id)
    except KeyError:
        raise _not_found("policy", item_id) from None


# --------------------------------------------------------------------------- meta


@app.get("/api/meta")
def meta() -> dict:
    return {
        "version": __version__,
        "modes": MODE_LABELS,
        "gst_categories": list(GST_CATEGORIES),
        "awareness_keys": list(AWARENESS_KEYS),
        "templates": {
            "population_set": PopulationSet(id="new_set", name="New population set").model_dump(mode="json"),
            "policy": Policy(id="new_policy", name="New policy").model_dump(mode="json"),
        },
    }


# --------------------------------------------------------------------------- economies


def _economy_summary(e: dict) -> dict:
    sets = e.get("sets", [])
    return {
        "id": e["id"],
        "name": e["name"],
        "description": e.get("description", ""),
        "year": e.get("year", ""),
        "set_count": len(sets),
        "population": sum(s.get("population", 0) for s in sets),
    }


@app.get("/api/economies")
def list_economies() -> list[dict]:
    return [_economy_summary(e) for e in store.list_raw("economies")]


@app.get("/api/economies/{item_id}")
def get_economy(item_id: str) -> Economy:
    return _get_economy(item_id)


@app.post("/api/economies")
def create_economy(economy: Economy) -> Economy:
    economy.id = store.unique_id("economies", economy.name)
    store.save_model("economies", economy)
    return economy


@app.put("/api/economies/{item_id}")
def update_economy(item_id: str, economy: Economy) -> Economy:
    _get_economy(item_id)
    ids = [s.id for s in economy.sets]
    if len(ids) != len(set(ids)):
        raise HTTPException(status_code=422, detail="Each population set needs a unique id")
    economy.id = item_id
    store.save_model("economies", economy)
    return economy


@app.post("/api/economies/{item_id}/duplicate")
def duplicate_economy(item_id: str) -> Economy:
    copy = _get_economy(item_id).model_copy(deep=True)
    copy.name = f"{copy.name} (copy)"
    copy.id = store.unique_id("economies", copy.name)
    store.save_model("economies", copy)
    return copy


@app.delete("/api/economies/{item_id}")
def delete_economy(item_id: str) -> dict:
    try:
        store.delete("economies", item_id)
    except KeyError:
        raise _not_found("economy", item_id) from None
    return {"deleted": item_id}


class CalibrateRequest(BaseModel):
    policy_id: str
    mode: Mode = "M2"


@app.post("/api/economies/{item_id}/calibration")
def economy_calibration(item_id: str, req: CalibrateRequest) -> list[dict]:
    return calibrate(_get_economy(item_id), _get_policy(req.policy_id), req.mode)


class PreviewRequest(BaseModel):
    set: PopulationSet
    samples: int = Field(4000, ge=200, le=20_000)


def _histogram(x: np.ndarray, w: np.ndarray, bins: int = 28) -> list[dict]:
    lo, hi = np.log10(max(np.percentile(x, 0.5), 1.0)), np.log10(max(np.percentile(x, 99.5), 10.0))
    edges = np.logspace(lo, hi, bins + 1)
    counts, _ = np.histogram(np.clip(x, edges[0], edges[-1]), bins=edges, weights=w)
    total = counts.sum() or 1.0
    return [{"lo": float(edges[i]), "hi": float(edges[i + 1]), "share": float(counts[i] / total)} for i in range(bins)]


@app.post("/api/population/preview")
def population_preview(req: PreviewRequest) -> dict:
    ps = req.set
    data = sample_set(ps, req.samples, seed=1)
    w = data["weight"] * data["hh_size"]
    qs = np.array([0.1, 0.25, 0.5, 0.75, 0.9, 0.99])
    names = ["p10", "p25", "p50", "p75", "p90", "p99"]

    def stats(x: np.ndarray) -> dict:
        return {
            "mean": float(np.average(x, weights=w)),
            **dict(zip(names, map(float, weighted_quantile(x, w, qs)))),
        }

    return {
        "households": ps.households,
        "income_household": stats(data["y0"]),
        "income_per_capita": stats(data["y0"] / data["hh_size"]),
        "wealth_household": stats(data["wealth"]),
        "income_histogram": _histogram(data["y0"], w),
        "wealth_histogram": _histogram(data["wealth"], w),
        "spending_share": float(np.average(data["apc"], weights=w)),
        "total_income": float(np.sum(data["y0"] * data["weight"])),
    }


# --------------------------------------------------------------------------- policies


@app.get("/api/policies")
def list_policies() -> list[dict]:
    return store.list_raw("policies")


@app.get("/api/policies/{item_id}")
def get_policy(item_id: str) -> Policy:
    return _get_policy(item_id)


@app.post("/api/policies")
def create_policy(policy: Policy) -> Policy:
    policy.id = store.unique_id("policies", policy.name)
    store.save_model("policies", policy)
    return policy


@app.put("/api/policies/{item_id}")
def update_policy(item_id: str, policy: Policy) -> Policy:
    _get_policy(item_id)
    policy.id = item_id
    store.save_model("policies", policy)
    return policy


@app.post("/api/policies/{item_id}/duplicate")
def duplicate_policy(item_id: str) -> Policy:
    copy = _get_policy(item_id).model_copy(deep=True)
    copy.name = f"{copy.name} (copy)"
    copy.origin = "user"
    copy.id = store.unique_id("policies", copy.name)
    store.save_model("policies", copy)
    return copy


@app.delete("/api/policies/{item_id}")
def delete_policy(item_id: str) -> dict:
    try:
        store.delete("policies", item_id)
    except KeyError:
        raise _not_found("policy", item_id) from None
    return {"deleted": item_id}


class SchedulePreviewRequest(BaseModel):
    income_tax: IncomeTax
    max_income: float | None = None
    uses_deductions: bool = True


@app.post("/api/policies/schedule-preview")
def schedule_preview(req: SchedulePreviewRequest) -> list[dict]:
    it = req.income_tax
    top = it.slabs[-1].threshold if it.slabs else 0
    hi = req.max_income or max(50e5, top * 1.6, it.rebate_threshold * 1.6)
    x = np.linspace(0, hi, 161)
    ones = np.ones_like(x)
    kwargs = dict(wage_income=x, savings=x, earners=ones, claims_rebate=np.ones_like(x, dtype=bool),
                  uses_deductions=np.full_like(x, req.uses_deductions, dtype=bool))
    tax = income_tax(it, x, **kwargs)
    step = hi / 400
    marginal = (income_tax(it, x + step, **{**kwargs, "wage_income": x + step, "savings": x + step}) - tax) / step
    return [
        {"income": float(xi), "tax": float(t), "average_rate": float(t / xi) if xi > 0 else 0.0, "marginal_rate": float(m)}
        for xi, t, m in zip(x, tax, marginal)
    ]


# --------------------------------------------------------------------------- theory baselines


class TheoryRequest(BaseModel):
    economy_id: str
    policy_id: str | None = None
    inequality_aversion: float = Field(1.0, ge=0, le=5)


@app.post("/api/theory/linear-optimum")
def theory_linear(req: TheoryRequest) -> Policy:
    economy = _get_economy(req.economy_id)
    policy = linear_optimum_policy(economy, req.inequality_aversion, new_id("theory_linear"))
    store.save_model("policies", policy)
    return policy


@app.post("/api/theory/saez-top-rate")
def theory_saez(req: TheoryRequest) -> Policy:
    if not req.policy_id:
        raise HTTPException(status_code=422, detail="Choose the policy whose top slab should be replaced")
    economy, base = _get_economy(req.economy_id), _get_policy(req.policy_id)
    try:
        policy = saez_top_policy(economy, base, req.inequality_aversion, new_id("theory_saez"))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    store.save_model("policies", policy)
    return policy


# --------------------------------------------------------------------------- runs


def _run_summary(r: dict) -> dict:
    return {
        "id": r["id"],
        "name": r["name"],
        "created_at": r["created_at"],
        "mode": r["request"]["mode"],
        "mode_label": r["mode_label"],
        "economy": r["economy"],
        "policies": [x["policy_name"] for x in r["results"]],
        "seconds": r["seconds"],
    }


@app.post("/api/runs")
def create_run(req: RunRequest) -> dict:
    economy = _get_economy(req.economy_id)
    baseline = _get_policy(req.baseline_policy_id)
    policies = [_get_policy(pid) for pid in req.policy_ids]
    try:
        result = run_comparison(economy, baseline, policies, req)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    store.save_raw("runs", result["id"], result)
    return result


@app.get("/api/runs")
def list_runs() -> list[dict]:
    return [_run_summary(r) for r in store.list_raw("runs")]


@app.get("/api/runs/{item_id}")
def get_run(item_id: str) -> dict:
    try:
        return store.load_raw("runs", item_id)
    except KeyError:
        raise _not_found("run", item_id) from None


@app.delete("/api/runs/{item_id}")
def delete_run(item_id: str) -> dict:
    try:
        store.delete("runs", item_id)
    except KeyError:
        raise _not_found("run", item_id) from None
    return {"deleted": item_id}


# --------------------------------------------------------------------------- frontend (production build)

_DIST = Path(__file__).resolve().parents[3] / "frontend" / "dist"
if _DIST.exists():
    app.mount("/assets", StaticFiles(directory=_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        target = (_DIST / path).resolve()
        if path and target.is_file() and target.is_relative_to(_DIST):
            return FileResponse(target)
        return FileResponse(_DIST / "index.html")

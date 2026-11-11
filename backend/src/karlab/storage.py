"""JSON file storage for economies, policies and runs (one file per item)."""

from __future__ import annotations

import json
import os
import re
import uuid
from pathlib import Path
from typing import TypeVar

from pydantic import BaseModel

from karlab.presets import india_economy, india_policies
from karlab.schemas import Economy, Policy

T = TypeVar("T", bound=BaseModel)
_SAFE_ID = re.compile(r"^[A-Za-z0-9_\-]{1,80}$")


def workspace_dir() -> Path:
    default = Path(__file__).resolve().parents[3] / "workspace"
    return Path(os.environ.get("KARLAB_WORKSPACE", default))


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def slugify(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")[:40]
    return slug or "item"


class Store:
    def __init__(self, root: Path | None = None):
        self.root = root or workspace_dir()
        for kind in ("economies", "policies", "runs"):
            (self.root / kind).mkdir(parents=True, exist_ok=True)
        self._seed()

    def _seed(self) -> None:
        if not any((self.root / "economies").glob("*.json")):
            self.save_model("economies", india_economy())
        if not any((self.root / "policies").glob("*.json")):
            for p in india_policies():
                self.save_model("policies", p)

    def _path(self, kind: str, item_id: str) -> Path:
        if not _SAFE_ID.match(item_id):
            raise KeyError(item_id)
        return self.root / kind / f"{item_id}.json"

    def exists(self, kind: str, item_id: str) -> bool:
        try:
            return self._path(kind, item_id).exists()
        except KeyError:
            return False

    def load_raw(self, kind: str, item_id: str) -> dict:
        path = self._path(kind, item_id)
        if not path.exists():
            raise KeyError(item_id)
        return json.loads(path.read_text())

    def load(self, kind: str, item_id: str, model: type[T]) -> T:
        return model.model_validate(self.load_raw(kind, item_id))

    def save_raw(self, kind: str, item_id: str, data: dict) -> None:
        path = self._path(kind, item_id)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False))
        tmp.replace(path)

    def save_model(self, kind: str, item: BaseModel) -> None:
        self.save_raw(kind, item.id, item.model_dump(mode="json"))

    def delete(self, kind: str, item_id: str) -> None:
        path = self._path(kind, item_id)
        if not path.exists():
            raise KeyError(item_id)
        path.unlink()

    def list_raw(self, kind: str) -> list[dict]:
        items = []
        for path in sorted((self.root / kind).glob("*.json"), key=lambda p: p.stat().st_mtime, reverse=True):
            try:
                items.append(json.loads(path.read_text()))
            except json.JSONDecodeError:
                continue
        return items

    def economy(self, item_id: str) -> Economy:
        return self.load("economies", item_id, Economy)

    def policy(self, item_id: str) -> Policy:
        return self.load("policies", item_id, Policy)

    def unique_id(self, kind: str, base: str) -> str:
        candidate = slugify(base)
        while self.exists(kind, candidate):
            candidate = f"{slugify(base)}_{uuid.uuid4().hex[:4]}"
        return candidate

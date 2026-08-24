"""
Uctan uca (ama gercek DB olmadan) duman testi: FastAPI router'i gercek bir
uygulamaya bagla, Protocol tabanli repository'leri sahte (in-memory)
implementasyonlarla degistir (dependency override), JWT ile kimlik
dogrulamasini gecir ve /api/v1/zakat/calculate uc noktasinin dogru HTTP
yaniti urettigini dogrula.
"""

import uuid
from datetime import date, timedelta
from decimal import Decimal

import jwt
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.v1 import zakat as zakat_module
from app.api.v1.deps import get_current_user, CurrentUser
from app.core.config import get_settings
from app.services.zakat_engine import ZakatableItemInput, ZakatSourceType


class FakeMarketPriceProvider:
    def get_gold_price_per_gram(self, as_of):
        return Decimal("4200")

    def get_silver_price_per_gram(self, as_of):
        return Decimal("50")


class FakeFamilyWealthRepository:
    def get_default_zakatable_items(self, family_id, as_of):
        return [
            ZakatableItemInput(ZakatSourceType.CASH, "Otomatik: Vadesiz hesap toplami", Decimal("600000")),
        ]

    def get_hawl_start_date(self, family_id):
        return date(2025, 1, 1)


class FakeZakatCalculationRepository:
    def __init__(self):
        self.saved = []

    def save(self, family_id, created_by_user_id, result):
        new_id = uuid.uuid4()
        self.saved.append((new_id, family_id, result))
        return new_id


def build_test_client():
    app = FastAPI()
    app.include_router(zakat_module.router)

    settings = get_settings()
    family_id = uuid.uuid4()
    user_id = uuid.uuid4()

    def fake_current_user():
        return CurrentUser(user_id=user_id, family_id=family_id, role="owner")

    fake_calc_repo = FakeZakatCalculationRepository()

    app.dependency_overrides[get_current_user] = fake_current_user
    app.dependency_overrides[zakat_module.get_market_price_provider] = lambda: FakeMarketPriceProvider()
    app.dependency_overrides[zakat_module.get_family_wealth_repository] = lambda: FakeFamilyWealthRepository()
    app.dependency_overrides[zakat_module.get_zakat_calculation_repository] = lambda: fake_calc_repo

    token = jwt.encode(
        {"sub": str(user_id), "family_id": str(family_id), "role": "owner"},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    client = TestClient(app)
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client, fake_calc_repo


def test_calculate_endpoint_auto_populates_items_and_returns_200():
    client, _ = build_test_client()
    resp = client.post(
        "/api/v1/zakat/calculate",
        json={
            "calculation_date": "2026-08-23",
            "nisab_basis": "gold",
            "include_jewelry_in_zakat": True,
            "items": [],
            "liabilities": [],
            "persist": False,
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["total_zakatable_assets"] == "600000.00"
    assert body["is_above_nisab"] is True
    assert body["is_hawl_complete"] is True
    assert body["is_zakat_obligatory"] is True
    assert body["zakat_due_amount"] == "15000.00"
    assert body["id"] is None  # persist=False


def test_calculate_endpoint_persists_when_requested():
    client, fake_repo = build_test_client()
    resp = client.post(
        "/api/v1/zakat/calculate",
        json={"calculation_date": "2026-08-23", "persist": True, "items": [], "liabilities": []},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["id"] is not None
    assert len(fake_repo.saved) == 1


def test_calculate_endpoint_rejects_missing_auth():
    app = FastAPI()
    app.include_router(zakat_module.router)
    client = TestClient(app)
    resp = client.post("/api/v1/zakat/calculate", json={})
    assert resp.status_code in (401, 403)


if __name__ == "__main__":
    import sys

    tests = [obj for name, obj in list(globals().items()) if name.startswith("test_")]
    failures = 0
    for t in tests:
        try:
            t()
            print(f"OK   {t.__name__}")
        except Exception as e:  # noqa: BLE001 -- duman testinde her hatayi yakala
            failures += 1
            print(f"FAIL {t.__name__}: {type(e).__name__}: {e}")
    print(f"\n{len(tests) - failures}/{len(tests)} test basarili")
    sys.exit(1 if failures else 0)

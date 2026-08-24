"""
api/v1/zakat.py
================
Zekat hesaplama uc noktalari. Router SADECE HTTP concern'lerini (auth,
status code, request/response map'leme) yonetir; is mantiginin tamami
`services/zakat_engine.py` icindedir (bkz. docs/ARCHITECTURE.md, bolum 2).
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Optional, Protocol

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.deps import CurrentUser, get_current_user
from app.core.database import get_db
from app.schemas.zakat import (
    ZakatCalculationItemOut,
    ZakatCalculationRequest,
    ZakatCalculationResponse,
)
from app.services.zakat_engine import (
    LiabilityInput,
    NisabBasis,
    ZakatableItemInput,
    ZakatCalculationResult,
    ZakatEngine,
)

router = APIRouter(prefix="/api/v1/zakat", tags=["zakat"])


# ----------------------------------------------------------------------
# Repository sozlesmeleri (Protocol). Somut implementasyonlar
# app/repositories/zakat_repository.py icinde SQLAlchemy modelleri
# uzerinden yazilir (bkz. database/schema.sql: accounts, asset_holdings,
# asset_price_history, zakat_calculations, zakat_calculation_items).
# Router, somut siniflara degil bu arayuzlere bagimlidir (Dependency
# Inversion) -- boylece endpoint testlerinde sahte (in-memory) repository
# enjekte edilebilir, gercek DB gerekmez.
# ----------------------------------------------------------------------
class MarketPriceProvider(Protocol):
    def get_gold_price_per_gram(self, as_of: date) -> Decimal: ...
    def get_silver_price_per_gram(self, as_of: date) -> Decimal: ...


class FamilyWealthRepository(Protocol):
    """Ailenin guncel nakit/varlik pozisyonlarini zekat kalemine cevirir."""

    def get_default_zakatable_items(
        self, family_id: uuid.UUID, as_of: date
    ) -> list[ZakatableItemInput]: ...

    def get_hawl_start_date(self, family_id: uuid.UUID) -> Optional[date]: ...


class ZakatCalculationRepository(Protocol):
    def save(
        self,
        family_id: uuid.UUID,
        created_by_user_id: uuid.UUID,
        result: ZakatCalculationResult,
    ) -> uuid.UUID: ...


def get_market_price_provider(db: Session = Depends(get_db)) -> MarketPriceProvider:
    # Prod: once Redis cache'e bakilir, miss olursa asset_price_history /
    # exchange_rates tablosundan son fiyat cekilir (bkz. workers/tasks/fetch_tcmb_rates.py).
    raise NotImplementedError(
        "Somut implementasyon app/repositories/market_price_repository.py icinde saglanir."
    )


def get_family_wealth_repository(db: Session = Depends(get_db)) -> FamilyWealthRepository:
    raise NotImplementedError(
        "Somut implementasyon app/repositories/zakat_repository.py icinde saglanir."
    )


def get_zakat_calculation_repository(db: Session = Depends(get_db)) -> ZakatCalculationRepository:
    raise NotImplementedError(
        "Somut implementasyon app/repositories/zakat_repository.py icinde saglanir."
    )


@router.post(
    "/calculate",
    response_model=ZakatCalculationResponse,
    status_code=status.HTTP_200_OK,
    summary="Ailenin zekat matrahini ve zekat tutarini hesaplar",
)
def calculate_zakat(
    payload: ZakatCalculationRequest,
    current_user: CurrentUser = Depends(get_current_user),
    price_provider: MarketPriceProvider = Depends(get_market_price_provider),
    wealth_repo: FamilyWealthRepository = Depends(get_family_wealth_repository),
    calc_repo: ZakatCalculationRepository = Depends(get_zakat_calculation_repository),
) -> ZakatCalculationResponse:
    """
    - `items` / `liabilities` bos gonderilirse, ailenin guncel hesap ve
      varlik pozisyonlari (accounts + asset_holdings) otomatik olarak
      zekat kalemlerine donusturulur (`wealth_repo.get_default_zakatable_items`).
      Kullanici belirli bir kalemi haric tutmak/dahil etmek isterse
      `items` listesinde o kalemi `force_include` ile gonderir.
    - `persist=true` ise sonuc `zakat_calculations` + `zakat_calculation_items`
      tablolarina `status='draft'` olarak yazilir; kullanici ayri bir
      `PATCH /zakat/{id}/finalize` ucuyla (bu dokuman kapsami disinda)
      onaylayip `status='finalized'` yapabilir.
    - Zekat FARZ olmasi icin hem `is_above_nisab` HEM DE `is_hawl_complete`
      true olmalidir; ikisi de response'ta ayri ayri donulur ki kullanici
      "nisabin uzerindeyim ama havelan-i havl dolmadi" durumunu ayirt edebilsin.
    """
    engine = ZakatEngine()

    items = [
        ZakatableItemInput(
            source_type=item.source_type,
            description=item.description,
            value_base_currency=item.value_base_currency,
            source_account_id=item.source_account_id,
            source_asset_holding_id=item.source_asset_holding_id,
            quantity=item.quantity,
            unit_value=item.unit_value,
            force_include=item.force_include,
            is_personal_jewelry=item.is_personal_jewelry,
            is_strong_receivable=item.is_strong_receivable,
        )
        for item in payload.items
    ] or wealth_repo.get_default_zakatable_items(current_user.family_id, payload.calculation_date)

    liabilities = [
        LiabilityInput(
            description=liability.description,
            amount=liability.amount,
            is_due_within_period=liability.is_due_within_period,
            deductible=liability.deductible,
        )
        for liability in payload.liabilities
    ]

    hawl_start = payload.hawl_start_date or wealth_repo.get_hawl_start_date(current_user.family_id)

    gold_price: Optional[Decimal] = None
    silver_price: Optional[Decimal] = None
    if payload.nisab_basis == NisabBasis.GOLD:
        gold_price = price_provider.get_gold_price_per_gram(payload.calculation_date)
    else:
        silver_price = price_provider.get_silver_price_per_gram(payload.calculation_date)

    try:
        result = engine.calculate(
            calculation_date=payload.calculation_date,
            items=items,
            liabilities=liabilities,
            nisab_basis=payload.nisab_basis,
            gold_price_per_gram=gold_price,
            silver_price_per_gram=silver_price,
            nisab_reference_grams=payload.nisab_reference_grams,
            include_jewelry_in_zakat=payload.include_jewelry_in_zakat,
            hawl_start_date=hawl_start,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    calculation_id: Optional[uuid.UUID] = None
    if payload.persist:
        calculation_id = calc_repo.save(current_user.family_id, current_user.user_id, result)

    return ZakatCalculationResponse(
        id=calculation_id,
        calculation_date=result.calculation_date,
        nisab_basis=result.nisab_basis,
        nisab_reference_grams=result.nisab_reference_grams,
        nisab_value_base_currency=result.nisab_value_base_currency,
        include_jewelry_in_zakat=result.include_jewelry_in_zakat,
        total_zakatable_assets=result.total_zakatable_assets,
        total_deductible_liabilities=result.total_deductible_liabilities,
        net_zakat_base=result.net_zakat_base,
        is_above_nisab=result.is_above_nisab,
        is_hawl_complete=result.is_hawl_complete,
        is_zakat_obligatory=result.is_zakat_obligatory,
        zakat_rate=result.zakat_rate,
        zakat_due_amount=result.zakat_due_amount,
        items=[
            ZakatCalculationItemOut(
                source_type=i.source_type,
                description=i.description,
                value_base_currency=i.value_base_currency,
                is_included_in_base=i.is_included_in_base,
                exclusion_reason=i.exclusion_reason,
                source_account_id=i.source_account_id,
                source_asset_holding_id=i.source_asset_holding_id,
            )
            for i in result.items
        ],
    )

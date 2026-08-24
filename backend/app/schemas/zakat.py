"""
schemas/zakat.py
=================
Zekat hesaplama API'sinin istek/yanit sozlesmesini tanimlayan Pydantic
modelleri. `services/zakat_engine.py` icindeki dataclass'larla birebir
alan adi uyumu, katmanlar arasi manuel donusumu (mapping) basitlestirir.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, model_validator

from app.services.zakat_engine import NisabBasis, ZakatSourceType


class ZakatableItemIn(BaseModel):
    source_type: ZakatSourceType
    description: str = Field(..., max_length=255)
    value_base_currency: Decimal = Field(..., ge=0)
    source_account_id: Optional[uuid.UUID] = None
    source_asset_holding_id: Optional[uuid.UUID] = None
    quantity: Optional[Decimal] = None
    unit_value: Optional[Decimal] = None
    force_include: Optional[bool] = None
    is_personal_jewelry: bool = False
    is_strong_receivable: bool = False


class LiabilityIn(BaseModel):
    description: str = Field(..., max_length=255)
    amount: Decimal = Field(..., ge=0)
    is_due_within_period: bool = True
    deductible: Optional[bool] = None


class ZakatCalculationRequest(BaseModel):
    """POST /api/v1/zakat/calculate govdesi.

    Not: `items` ve `liabilities` bos birakilirsa, servis katmani ailenin
    guncel hesap/varlik pozisyonlarini (accounts, asset_holdings) otomatik
    olarak zekat kalemlerine cevirip kullanir (bkz. api/v1/zakat.py).
    Kullanici manuel kalem eklemek/cikarmak isterse bu alanlari doldurur.
    """

    calculation_date: date = Field(default_factory=date.today)
    nisab_basis: NisabBasis = NisabBasis.GOLD
    nisab_reference_grams: Optional[Decimal] = Field(
        default=None, description="Bos birakilirsa motorun varsayilani (altin: 85gr, gumus: 595gr) kullanilir."
    )
    include_jewelry_in_zakat: bool = True
    hawl_start_date: Optional[date] = Field(
        default=None,
        description="Servetin nisaba ilk ulastigi tarih. Bos birakilirsa hawl tamamlanmamis kabul edilir.",
    )
    items: list[ZakatableItemIn] = Field(default_factory=list)
    liabilities: list[LiabilityIn] = Field(default_factory=list)
    persist: bool = Field(
        default=False, description="True ise sonuc zakat_calculations tablosuna 'draft' olarak kaydedilir."
    )

    @model_validator(mode="after")
    def _validate_nisab_basis_consistency(self) -> "ZakatCalculationRequest":
        if self.nisab_reference_grams is not None and self.nisab_reference_grams <= 0:
            raise ValueError("nisab_reference_grams sifirdan buyuk olmalidir.")
        return self


class ZakatCalculationItemOut(BaseModel):
    source_type: ZakatSourceType
    description: str
    value_base_currency: Decimal
    is_included_in_base: bool
    exclusion_reason: Optional[str] = None
    source_account_id: Optional[uuid.UUID] = None
    source_asset_holding_id: Optional[uuid.UUID] = None


class ZakatCalculationResponse(BaseModel):
    id: Optional[uuid.UUID] = Field(default=None, description="persist=true ise DB kaydinin id'si")
    calculation_date: date
    nisab_basis: NisabBasis
    nisab_reference_grams: Decimal
    nisab_value_base_currency: Decimal
    include_jewelry_in_zakat: bool
    total_zakatable_assets: Decimal
    total_deductible_liabilities: Decimal
    net_zakat_base: Decimal
    is_above_nisab: bool
    is_hawl_complete: bool
    is_zakat_obligatory: bool
    zakat_rate: Decimal
    zakat_due_amount: Decimal
    currency: str = "TRY"
    items: list[ZakatCalculationItemOut]

    class Config:
        from_attributes = True

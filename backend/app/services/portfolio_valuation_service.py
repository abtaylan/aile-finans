"""
portfolio_valuation_service.py
================================
Bir varlik (veya tum portfoy) icin 1 aylik / 3 aylik / 1 yillik periyot
kar-zarar performansini hesaplar. `cost_basis_engine` (guncel durum) ile
`portfolio_history` tablosundaki gecmis anlik goruntuleri birlestirir.

Bu servis repository'lerden bagimsiz calisir; DB erisimi disaridan Protocol
araciligiyla enjekte edilir (bagimlilik tersine cevirme) -- boylece hem
gercek SQLAlchemy repository'leriyle hem de birim testlerinde sahte
(in-memory) repository'lerle calisabilir.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Optional, Protocol

from app.services.cost_basis_engine import CostBasisEngine, HoldingState
from app.utils.date_ranges import DateRange, PerformancePeriod, period_return_percent, resolve_period


@dataclass(frozen=True)
class PortfolioSnapshot:
    snapshot_date: date
    total_market_value: Decimal
    total_cost_basis: Decimal


class PortfolioHistoryRepository(Protocol):
    def get_snapshot_on_or_before(
        self, family_id: uuid.UUID, target_date: date
    ) -> Optional[PortfolioSnapshot]:
        """Verilen tarihte veya ondan once en yakin anlik goruntuyu dondurur."""
        ...

    def get_latest_snapshot(self, family_id: uuid.UUID) -> Optional[PortfolioSnapshot]:
        ...


@dataclass(frozen=True)
class PerformanceResult:
    period: PerformancePeriod
    date_range: DateRange
    start_value: Optional[Decimal]
    end_value: Decimal
    absolute_pnl: Optional[Decimal]
    percent_return: Optional[Decimal]


class PortfolioValuationService:
    def __init__(self, history_repo: PortfolioHistoryRepository) -> None:
        self._history_repo = history_repo
        self._cost_engine = CostBasisEngine()

    def current_position_summary(self, state: HoldingState, current_price: Decimal) -> dict:
        """Tek bir varligin (asset_holdings satiri) anlik kar/zarar ozeti."""
        return {
            "holding_id": str(state.holding_id),
            "quantity": state.quantity,
            "average_unit_cost": state.average_unit_cost,
            "total_cost_basis": state.total_cost_basis,
            "market_value": self._cost_engine.market_value(state, current_price),
            "unrealized_pnl": self._cost_engine.unrealized_pnl(state, current_price),
            "unrealized_pnl_percent": self._cost_engine.unrealized_pnl_percent(state, current_price),
        }

    def period_performance(
        self,
        family_id: uuid.UUID,
        period: PerformancePeriod,
        as_of: Optional[date] = None,
    ) -> PerformanceResult:
        """Aile portfoyunun 1A/3A/1Y periyot performansini hesaplar.

        Not: Bu, TUM portfoyun (breakdown_by_asset_type JSONB icinde varlik
        turu bazli da kirilabilir) toplam degerine gore hesaplanir. Tek bir
        varlik turu icin filtrelenmis performans istenirse, ayni mantik
        `portfolio_history.breakdown_by_asset_type` uzerinden uygulanir.
        """
        date_range = resolve_period(period, as_of=as_of)

        latest = self._history_repo.get_latest_snapshot(family_id)
        end_value = latest.total_market_value if latest else Decimal("0")

        start_snapshot = self._history_repo.get_snapshot_on_or_before(
            family_id, date_range.start
        )
        start_value = start_snapshot.total_market_value if start_snapshot else None

        absolute_pnl = (end_value - start_value) if start_value is not None else None
        percent_return = period_return_percent(start_value, end_value)

        return PerformanceResult(
            period=period,
            date_range=date_range,
            start_value=start_value,
            end_value=end_value,
            absolute_pnl=absolute_pnl,
            percent_return=percent_return,
        )

    def all_periods_performance(
        self, family_id: uuid.UUID, as_of: Optional[date] = None
    ) -> dict[str, PerformanceResult]:
        """Ekranda ayni anda gosterilen 1A/3A/1Y sekmeleri icin tek cagri."""
        return {
            p.value: self.period_performance(family_id, p, as_of=as_of)
            for p in (
                PerformancePeriod.ONE_MONTH,
                PerformancePeriod.THREE_MONTHS,
                PerformancePeriod.ONE_YEAR,
            )
        }

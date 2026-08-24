"""
cost_basis_engine.py
=====================
Altin / doviz / TEFAS fonu gibi varliklar icin FIFO ve Agirlikli Ortalama
Maliyet (Weighted Average Cost - WAC) yontemleriyle kar-zarar hesaplama motoru.

Tasarim ilkeleri
----------------
- Framework'ten bagimsizdir (FastAPI/SQLAlchemy import ETMEZ) -> hem API hem
  worker (Celery) tarafindan cagrilabilir, birim testi kolaydir.
- Tum parasal/miktar hesaplari Decimal ile yapilir (float KESINLIKLE YASAK --
  ondalik yuvarlama hatalari finansal veride kabul edilemez).
- Girdi/cikti tipleri dataclass'tir; repository katmani ORM nesnelerini bu
  dataclass'lara map'ler, boylece bu modul veritabanindan tamamen izole kalir.
- CostBasisEngine SAF (pure) calisir: veri okumaz/yazmaz, sadece verilen
  HoldingState uzerinde hesap yapip guncellenmis halini dondurur. Kalicilastirma
  (DB commit) sorumlulugu servis/repository katmanindadir.

Iliskili DB tablolari: asset_holdings, asset_transactions,
asset_transaction_lot_matches (bkz. database/schema.sql).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from enum import Enum

# Miktar (gram, adet, pay) hassasiyeti: 4 ondalik basamak.
QUANTITY_PLACES = Decimal("0.0001")
# Birim maliyet gibi cok kucuk degerler icin 6 ondalik basamak.
UNIT_COST_PLACES = Decimal("0.000001")
# Nihai TL/doviz tutarlari icin 2 ondalik basamak.
MONEY_PLACES = Decimal("0.01")


def _q(value: Decimal, places: Decimal = MONEY_PLACES) -> Decimal:
    return value.quantize(places, rounding=ROUND_HALF_UP)


class CostMethod(str, Enum):
    FIFO = "fifo"
    WEIGHTED_AVERAGE = "weighted_average"


class InsufficientQuantityError(ValueError):
    """Satilmak istenen miktar, elde bulunan miktardan fazlaysa firlatilir."""


@dataclass
class Lot:
    """Tek bir alim hareketini (FIFO defterindeki bir 'lot'u) temsil eder."""

    tx_id: uuid.UUID
    purchase_date: date
    quantity: Decimal
    remaining_quantity: Decimal
    unit_cost: Decimal  # fee dahil edilmis efektif birim maliyet
    fee: Decimal = Decimal("0")
    # Ayni gun birden fazla alim oldugunda FIFO sirasini korumak icin
    # (created_at yerine) monoton artan bir sequence numarasi.
    sequence: int = 0

    def is_exhausted(self) -> bool:
        return self.remaining_quantity <= Decimal("0")


@dataclass
class LotMatch:
    """Bir satisin hangi alim lotundan ne kadar tukettigini kaydeder.

    asset_transaction_lot_matches tablosuna dogrudan map edilir.
    """

    sell_tx_id: uuid.UUID
    buy_tx_id: uuid.UUID
    matched_quantity: Decimal
    buy_unit_cost: Decimal
    sell_unit_price: Decimal

    @property
    def realized_pnl(self) -> Decimal:
        gross = (self.sell_unit_price - self.buy_unit_cost) * self.matched_quantity
        return _q(gross)


@dataclass
class SellResult:
    matches: list[LotMatch]
    total_realized_pnl: Decimal
    total_cost_of_goods_sold: Decimal
    proceeds: Decimal


@dataclass
class HoldingState:
    """Bir varlik pozisyonunun (asset_holdings satirinin) guncel durumu."""

    holding_id: uuid.UUID
    cost_method: CostMethod
    quantity: Decimal = Decimal("0")
    average_unit_cost: Decimal = Decimal("0")  # sadece WEIGHTED_AVERAGE'da anlamli
    total_cost_basis: Decimal = Decimal("0")
    lots: list[Lot] = field(default_factory=list)  # sadece FIFO'da kullanilir
    _lot_sequence: int = 0


class CostBasisEngine:
    """FIFO ve Agirlikli Ortalama Maliyet yontemlerini uygular."""

    # ------------------------------------------------------------------
    # ALIM (BUY)
    # ------------------------------------------------------------------
    def process_buy(
        self,
        state: HoldingState,
        tx_id: uuid.UUID,
        quantity: Decimal,
        unit_price: Decimal,
        fee: Decimal,
        purchase_date: date,
    ) -> HoldingState:
        if quantity <= 0:
            raise ValueError("Alim miktari sifirdan buyuk olmalidir.")
        if unit_price < 0 or fee < 0:
            raise ValueError("Birim fiyat ve komisyon negatif olamaz.")

        # Komisyonu birim maliyete dahil ediyoruz (standart maliyet muhasebesi
        # pratigi): efektif_maliyet = (miktar*fiyat + komisyon) / miktar
        effective_unit_cost = unit_price + (fee / quantity)

        if state.cost_method == CostMethod.FIFO:
            state._lot_sequence += 1
            state.lots.append(
                Lot(
                    tx_id=tx_id,
                    purchase_date=purchase_date,
                    quantity=quantity,
                    remaining_quantity=quantity,
                    unit_cost=effective_unit_cost,
                    fee=fee,
                    sequence=state._lot_sequence,
                )
            )

        new_total_cost = state.total_cost_basis + (quantity * effective_unit_cost)
        new_quantity = state.quantity + quantity

        state.total_cost_basis = _q(new_total_cost)
        state.quantity = _q(new_quantity, QUANTITY_PLACES)
        state.average_unit_cost = (
            _q(new_total_cost / new_quantity, UNIT_COST_PLACES) if new_quantity > 0 else Decimal("0")
        )
        return state

    # ------------------------------------------------------------------
    # SATIM (SELL)
    # ------------------------------------------------------------------
    def process_sell(
        self,
        state: HoldingState,
        tx_id: uuid.UUID,
        quantity: Decimal,
        unit_price: Decimal,
        fee: Decimal,
        sale_date: date,
    ) -> tuple[HoldingState, SellResult]:
        if quantity <= 0:
            raise ValueError("Satis miktari sifirdan buyuk olmalidir.")
        if quantity > state.quantity:
            raise InsufficientQuantityError(
                f"Elde {state.quantity} birim var, {quantity} birim satilamaz "
                f"(holding_id={state.holding_id})."
            )

        if state.cost_method == CostMethod.FIFO:
            result = self._sell_fifo(state, tx_id, quantity, unit_price, fee)
        else:
            result = self._sell_weighted_average(state, tx_id, quantity, unit_price, fee)

        state.quantity = _q(state.quantity - quantity, QUANTITY_PLACES)
        state.total_cost_basis = _q(state.total_cost_basis - result.total_cost_of_goods_sold)

        if state.quantity <= 0:
            # Yuvarlama artiklarini temizle: pozisyon tamamen kapandiginda
            # kalintili kucuk degerler birikmesin.
            state.quantity = Decimal("0")
            state.average_unit_cost = Decimal("0")
            state.total_cost_basis = Decimal("0")
        # WAC yonteminde average_unit_cost satistan ETKILENMEZ (sadece yeni
        # alimlar ortalamayi degistirir) -- bu WAC'in tanimi geregidir.

        return state, result

    def _sell_fifo(
        self,
        state: HoldingState,
        tx_id: uuid.UUID,
        quantity: Decimal,
        unit_price: Decimal,
        fee: Decimal,
    ) -> SellResult:
        remaining_to_sell = quantity
        matches: list[LotMatch] = []
        cogs = Decimal("0")

        # En eski alim once tuketilir: (purchase_date, sequence) sirasi.
        ordered_lots = sorted(
            (lot for lot in state.lots if not lot.is_exhausted()),
            key=lambda l: (l.purchase_date, l.sequence),
        )

        for lot in ordered_lots:
            if remaining_to_sell <= 0:
                break
            take = min(lot.remaining_quantity, remaining_to_sell)
            lot.remaining_quantity = _q(lot.remaining_quantity - take, QUANTITY_PLACES)
            remaining_to_sell = _q(remaining_to_sell - take, QUANTITY_PLACES)
            cogs += take * lot.unit_cost
            matches.append(
                LotMatch(
                    sell_tx_id=tx_id,
                    buy_tx_id=lot.tx_id,
                    matched_quantity=take,
                    buy_unit_cost=lot.unit_cost,
                    sell_unit_price=unit_price,
                )
            )

        if remaining_to_sell > 0:
            # state.quantity kontrolu bunu engellemis olmali; buraya dusmesi
            # lot defteri ile holding.quantity arasinda bir tutarsizlik
            # oldugunu gosterir -- sessizce gecmek yerine acikca patlatiriz.
            raise InsufficientQuantityError(
                "Lot defterinde satisi karsilayacak yeterli alim kaydi yok "
                "(asset_holdings.quantity ile asset_transactions lot toplami "
                "senkron degil -- veri tutarliligi kontrolu gerekir)."
            )

        cogs = _q(cogs)
        proceeds = _q((quantity * unit_price) - fee)
        realized_pnl = _q(proceeds - cogs)

        return SellResult(
            matches=matches,
            total_realized_pnl=realized_pnl,
            total_cost_of_goods_sold=cogs,
            proceeds=proceeds,
        )

    def _sell_weighted_average(
        self,
        state: HoldingState,
        tx_id: uuid.UUID,
        quantity: Decimal,
        unit_price: Decimal,
        fee: Decimal,
    ) -> SellResult:
        cogs = _q(quantity * state.average_unit_cost)
        proceeds = _q((quantity * unit_price) - fee)
        realized_pnl = _q(proceeds - cogs)

        match = LotMatch(
            sell_tx_id=tx_id,
            buy_tx_id=tx_id,  # WAC'ta belirli bir lot yok; kendine referans veriyoruz
            matched_quantity=quantity,
            buy_unit_cost=state.average_unit_cost,
            sell_unit_price=unit_price,
        )
        return SellResult(
            matches=[match],
            total_realized_pnl=realized_pnl,
            total_cost_of_goods_sold=cogs,
            proceeds=proceeds,
        )

    # ------------------------------------------------------------------
    # DEGERLEME (gerceklesmemis kar/zarar)
    # ------------------------------------------------------------------
    def unrealized_pnl(self, state: HoldingState, current_market_price: Decimal) -> Decimal:
        market_value = state.quantity * current_market_price
        return _q(market_value - state.total_cost_basis)

    def market_value(self, state: HoldingState, current_market_price: Decimal) -> Decimal:
        return _q(state.quantity * current_market_price)

    def unrealized_pnl_percent(self, state: HoldingState, current_market_price: Decimal) -> Decimal:
        if state.total_cost_basis == 0:
            return Decimal("0")
        pnl = self.unrealized_pnl(state, current_market_price)
        return _q((pnl / state.total_cost_basis) * 100, Decimal("0.01"))

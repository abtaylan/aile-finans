"""
FIFO ve Agirlikli Ortalama Maliyet motorunun temel senaryolarini dogrulayan
birim testleri. Rakamlar elle hesaplanabilir basitlikte secildi ki ciktinin
dogrulugu satir satir kontrol edilebilsin.
"""

import uuid
from datetime import date
from decimal import Decimal

from app.services.cost_basis_engine import (
    CostBasisEngine,
    CostMethod,
    HoldingState,
    InsufficientQuantityError,
)


def _uuid():
    return uuid.uuid4()


def test_fifo_buy_then_partial_sell_uses_oldest_lot_first():
    engine = CostBasisEngine()
    state = HoldingState(holding_id=_uuid(), cost_method=CostMethod.FIFO)

    # 100 gr altin 2500 TL/gr'dan alindi (10 Ocak)
    engine.process_buy(state, _uuid(), Decimal("100"), Decimal("2500"), Decimal("0"), date(2026, 1, 10))
    # 50 gr altin 2800 TL/gr'dan alindi (1 Mart)
    engine.process_buy(state, _uuid(), Decimal("50"), Decimal("2800"), Decimal("0"), date(2026, 3, 1))

    assert state.quantity == Decimal("150.0000")
    assert state.total_cost_basis == Decimal("390000.00")  # 100*2500 + 50*2800

    # 120 gr sat, 3000 TL/gr'dan (1 Nisan) -> FIFO: once 100gr@2500, sonra 20gr@2800
    sell_tx = _uuid()
    state, result = engine.process_sell(
        state, sell_tx, Decimal("120"), Decimal("3000"), Decimal("0"), date(2026, 4, 1)
    )

    # COGS = 100*2500 + 20*2800 = 250000 + 56000 = 306000
    assert result.total_cost_of_goods_sold == Decimal("306000.00")
    # Proceeds = 120*3000 = 360000
    assert result.proceeds == Decimal("360000.00")
    assert result.total_realized_pnl == Decimal("54000.00")
    assert len(result.matches) == 2
    assert result.matches[0].matched_quantity == Decimal("100")
    assert result.matches[1].matched_quantity == Decimal("20")

    # Kalan pozisyon: 30 gr, hepsi ikinci lottan (2800 maliyetli)
    assert state.quantity == Decimal("30.0000")
    assert state.total_cost_basis == Decimal("84000.00")  # 30*2800


def test_weighted_average_buy_updates_running_average_and_sell_uses_it():
    engine = CostBasisEngine()
    state = HoldingState(holding_id=_uuid(), cost_method=CostMethod.WEIGHTED_AVERAGE)

    engine.process_buy(state, _uuid(), Decimal("100"), Decimal("2500"), Decimal("0"), date(2026, 1, 10))
    engine.process_buy(state, _uuid(), Decimal("50"), Decimal("2800"), Decimal("0"), date(2026, 3, 1))

    # Agirlikli ortalama = (100*2500 + 50*2800) / 150 = 390000/150 = 2600
    assert state.average_unit_cost == Decimal("2600.000000")

    state, result = engine.process_sell(
        state, _uuid(), Decimal("120"), Decimal("3000"), Decimal("0"), date(2026, 4, 1)
    )

    # COGS = 120 * 2600 = 312000 ; Proceeds = 120*3000=360000 ; PnL=48000
    assert result.total_cost_of_goods_sold == Decimal("312000.00")
    assert result.total_realized_pnl == Decimal("48000.00")

    # WAC'ta satistan sonra ortalama DEGISMEZ
    assert state.average_unit_cost == Decimal("2600.000000")
    assert state.quantity == Decimal("30.0000")
    assert state.total_cost_basis == Decimal("78000.00")  # 30 * 2600


def test_selling_more_than_held_raises():
    engine = CostBasisEngine()
    state = HoldingState(holding_id=_uuid(), cost_method=CostMethod.FIFO)
    engine.process_buy(state, _uuid(), Decimal("10"), Decimal("100"), Decimal("0"), date(2026, 1, 1))

    try:
        engine.process_sell(state, _uuid(), Decimal("11"), Decimal("100"), Decimal("0"), date(2026, 1, 2))
        assert False, "InsufficientQuantityError beklenirdi"
    except InsufficientQuantityError:
        pass


def test_unrealized_pnl_and_percent():
    engine = CostBasisEngine()
    state = HoldingState(holding_id=_uuid(), cost_method=CostMethod.WEIGHTED_AVERAGE)
    engine.process_buy(state, _uuid(), Decimal("10"), Decimal("100"), Decimal("0"), date(2026, 1, 1))

    pnl = engine.unrealized_pnl(state, Decimal("120"))
    assert pnl == Decimal("200.00")  # 10*120 - 10*100
    pct = engine.unrealized_pnl_percent(state, Decimal("120"))
    assert pct == Decimal("20.00")


def test_fee_is_included_in_effective_unit_cost():
    engine = CostBasisEngine()
    state = HoldingState(holding_id=_uuid(), cost_method=CostMethod.WEIGHTED_AVERAGE)
    # 10 birim, 100 TL/birim + 50 TL islem ucreti -> efektif maliyet 105/birim
    engine.process_buy(state, _uuid(), Decimal("10"), Decimal("100"), Decimal("50"), date(2026, 1, 1))
    assert state.total_cost_basis == Decimal("1050.00")
    assert state.average_unit_cost == Decimal("105.000000")


if __name__ == "__main__":
    import sys

    tests = [obj for name, obj in list(globals().items()) if name.startswith("test_")]
    failures = 0
    for t in tests:
        try:
            t()
            print(f"OK   {t.__name__}")
        except AssertionError as e:
            failures += 1
            print(f"FAIL {t.__name__}: {e}")
    print(f"\n{len(tests) - failures}/{len(tests)} test basarili")
    sys.exit(1 if failures else 0)

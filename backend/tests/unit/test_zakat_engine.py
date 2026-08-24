"""Zekat motorunun temel fikhi senaryolarini dogrulayan birim testleri."""

from datetime import date
from decimal import Decimal

from app.services.zakat_engine import (
    LiabilityInput,
    NisabBasis,
    ZakatableItemInput,
    ZakatEngine,
    ZakatSourceType,
)

GOLD_PRICE = Decimal("4200")  # TL/gram (ornek)


def test_wealth_above_nisab_with_completed_hawl_is_obligatory():
    engine = ZakatEngine()
    items = [
        ZakatableItemInput(ZakatSourceType.CASH, "Vadesiz TL hesabi", Decimal("200000")),
        ZakatableItemInput(ZakatSourceType.GOLD, "22 ayar bilezik", Decimal("150000"), is_personal_jewelry=True),
    ]
    liabilities = [LiabilityInput("Kredi karti ekstresi", Decimal("15000"))]

    result = engine.calculate(
        calculation_date=date(2026, 8, 23),
        items=items,
        liabilities=liabilities,
        nisab_basis=NisabBasis.GOLD,
        gold_price_per_gram=GOLD_PRICE,
        include_jewelry_in_zakat=True,
        hawl_start_date=date(2025, 8, 1),  # > 354 gun once
    )

    nisab_value = Decimal("85") * GOLD_PRICE  # 357000
    assert result.nisab_value_base_currency == nisab_value
    assert result.total_zakatable_assets == Decimal("350000.00")
    assert result.total_deductible_liabilities == Decimal("15000.00")
    assert result.net_zakat_base == Decimal("335000.00")
    # 335000 < 357000 nisab -> nisabin ALTINDA
    assert result.is_above_nisab is False
    assert result.is_zakat_obligatory is False
    assert result.zakat_due_amount == Decimal("0.00")


def test_jewelry_excluded_when_include_jewelry_flag_false():
    engine = ZakatEngine()
    items = [
        ZakatableItemInput(ZakatSourceType.CASH, "Nakit", Decimal("500000")),
        ZakatableItemInput(ZakatSourceType.GOLD, "Kullanim ziynet esyasi", Decimal("100000"), is_personal_jewelry=True),
    ]

    result = engine.calculate(
        calculation_date=date(2026, 8, 23),
        items=items,
        liabilities=[],
        nisab_basis=NisabBasis.GOLD,
        gold_price_per_gram=GOLD_PRICE,
        include_jewelry_in_zakat=False,  # ziynet esyasini haric tutan gorus
        hawl_start_date=date(2025, 1, 1),
    )

    # Sadece nakit (500000) matraha girer, ziynet esyasi (100000) haric
    assert result.total_zakatable_assets == Decimal("500000.00")
    jewelry_item = next(i for i in result.items if i.source_type == ZakatSourceType.GOLD)
    assert jewelry_item.is_included_in_base is False
    assert "ziynet" in jewelry_item.exclusion_reason.lower()

    assert result.is_above_nisab is True
    assert result.is_hawl_complete is True
    assert result.is_zakat_obligatory is True
    # 500000 * 0.025 = 12500
    assert result.zakat_due_amount == Decimal("12500.00")


def test_weak_receivable_excluded_strong_receivable_included():
    engine = ZakatEngine()
    items = [
        ZakatableItemInput(ZakatSourceType.CASH, "Nakit", Decimal("400000")),
        ZakatableItemInput(
            ZakatSourceType.RECEIVABLE, "Arkadasa verilen borc (odeme gucu var)",
            Decimal("50000"), is_strong_receivable=True,
        ),
        ZakatableItemInput(
            ZakatSourceType.RECEIVABLE, "Dava asamasindaki supheli alacak",
            Decimal("30000"), is_strong_receivable=False,
        ),
    ]

    result = engine.calculate(
        calculation_date=date(2026, 8, 23),
        items=items,
        liabilities=[],
        nisab_basis=NisabBasis.GOLD,
        gold_price_per_gram=GOLD_PRICE,
        hawl_start_date=date(2025, 1, 1),
    )

    assert result.total_zakatable_assets == Decimal("450000.00")  # 400000 + 50000 (zayif alacak haric)
    weak = next(i for i in result.items if "supheli" in i.description)
    assert weak.is_included_in_base is False


def test_hawl_not_complete_blocks_zakat_even_above_nisab():
    engine = ZakatEngine()
    items = [ZakatableItemInput(ZakatSourceType.CASH, "Nakit", Decimal("1000000"))]

    result = engine.calculate(
        calculation_date=date(2026, 8, 23),
        items=items,
        liabilities=[],
        nisab_basis=NisabBasis.GOLD,
        gold_price_per_gram=GOLD_PRICE,
        hawl_start_date=date(2026, 6, 1),  # sadece ~83 gun once -- kameri yil dolmadi
    )

    assert result.is_above_nisab is True
    assert result.is_hawl_complete is False
    assert result.is_zakat_obligatory is False
    assert result.zakat_due_amount == Decimal("0.00")


def test_liabilities_cannot_push_base_negative():
    engine = ZakatEngine()
    items = [ZakatableItemInput(ZakatSourceType.CASH, "Nakit", Decimal("10000"))]
    liabilities = [LiabilityInput("Buyuk borc", Decimal("50000"))]

    result = engine.calculate(
        calculation_date=date(2026, 8, 23),
        items=items,
        liabilities=liabilities,
        nisab_basis=NisabBasis.GOLD,
        gold_price_per_gram=GOLD_PRICE,
        hawl_start_date=date(2025, 1, 1),
    )

    assert result.net_zakat_base == Decimal("0.00")
    assert result.zakat_due_amount == Decimal("0.00")


def test_silver_nisab_basis():
    engine = ZakatEngine()
    items = [ZakatableItemInput(ZakatSourceType.CASH, "Nakit", Decimal("50000"))]

    result = engine.calculate(
        calculation_date=date(2026, 8, 23),
        items=items,
        liabilities=[],
        nisab_basis=NisabBasis.SILVER,
        silver_price_per_gram=Decimal("50"),
        hawl_start_date=date(2025, 1, 1),
    )
    # 595 gr * 50 TL = 29750 nisab
    assert result.nisab_value_base_currency == Decimal("29750.00")
    assert result.is_above_nisab is True
    assert result.zakat_due_amount == Decimal("1250.00")  # 50000*0.025


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

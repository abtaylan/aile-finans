"""1A/3A/1Y periyot performans hesaplamasi icin duman testi."""

import uuid
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from app.services.portfolio_valuation_service import PortfolioSnapshot, PortfolioValuationService
from app.utils.date_ranges import PerformancePeriod


class FakeHistoryRepo:
    def __init__(self, snapshots: dict[date, Decimal]):
        self._snapshots = snapshots

    def get_snapshot_on_or_before(self, family_id, target_date):
        candidates = [d for d in self._snapshots if d <= target_date]
        if not candidates:
            return None
        best = max(candidates)
        return PortfolioSnapshot(snapshot_date=best, total_market_value=self._snapshots[best], total_cost_basis=Decimal("0"))

    def get_latest_snapshot(self, family_id):
        best = max(self._snapshots)
        return PortfolioSnapshot(snapshot_date=best, total_market_value=self._snapshots[best], total_cost_basis=Decimal("0"))


def test_one_month_return_calculation():
    today = date(2026, 8, 23)
    snapshots = {
        date(2026, 7, 23): Decimal("100000"),
        date(2026, 8, 23): Decimal("110000"),
    }
    service = PortfolioValuationService(FakeHistoryRepo(snapshots))
    result = service.period_performance(uuid.uuid4(), PerformancePeriod.ONE_MONTH, as_of=today)

    assert result.start_value == Decimal("100000")
    assert result.end_value == Decimal("110000")
    assert result.absolute_pnl == Decimal("10000")
    assert result.percent_return == Decimal("10.00")


def test_missing_history_returns_none_percent():
    today = date(2026, 8, 23)
    snapshots = {date(2026, 8, 23): Decimal("50000")}
    service = PortfolioValuationService(FakeHistoryRepo(snapshots))
    result = service.period_performance(uuid.uuid4(), PerformancePeriod.ONE_YEAR, as_of=today)

    assert result.start_value is None
    assert result.percent_return is None


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

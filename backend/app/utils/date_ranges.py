"""
date_ranges.py
===============
Portfoy performans ekraninda kullanilan 1 aylik / 3 aylik / 1 yillik periyot
sinirlarini hesaplayan yardimci fonksiyonlar. Takvim ayi/yili aritmetigi
(28/29/30/31 gun farklari, artik yil) icin `dateutil.relativedelta` kullanilir.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from enum import Enum

from dateutil.relativedelta import relativedelta


class PerformancePeriod(str, Enum):
    ONE_MONTH = "1m"
    THREE_MONTHS = "3m"
    ONE_YEAR = "1y"
    YTD = "ytd"  # yil basindan bugune (zekat/vergi raporlamasinda faydali)


@dataclass(frozen=True)
class DateRange:
    start: date
    end: date


_PERIOD_DELTAS: dict[PerformancePeriod, relativedelta] = {
    PerformancePeriod.ONE_MONTH: relativedelta(months=1),
    PerformancePeriod.THREE_MONTHS: relativedelta(months=3),
    PerformancePeriod.ONE_YEAR: relativedelta(years=1),
}


def resolve_period(period: PerformancePeriod, as_of: date | None = None) -> DateRange:
    """Verilen periyot icin [baslangic, bugun] tarih araligini dondurur.

    Ornek: period=THREE_MONTHS, as_of=2026-08-23 -> start=2026-05-23
    Bu baslangic tarihine en yakin portfolio_history.snapshot_date satiri
    (<=) periyot basi degeri olarak kullanilir; tam o gune ait snapshot
    yoksa en yakin ONCEKI kayit alinir (haftasonu/tatil bosluklari icin).
    """
    end = as_of or date.today()

    if period == PerformancePeriod.YTD:
        start = date(end.year, 1, 1)
        return DateRange(start=start, end=end)

    delta = _PERIOD_DELTAS[period]
    start = end - delta
    return DateRange(start=start, end=end)


def period_return_percent(start_value, end_value):
    """Basit donem getirisi: (bitis - baslangic) / baslangic * 100.

    Decimal ile calisilmasi beklenir; baslangic degeri 0 ise (henuz pozisyon
    yoktu) None doner -- cagiran taraf bunu "N/A" olarak gostermelidir.
    """
    from decimal import ROUND_HALF_UP, Decimal

    if start_value is None or start_value == 0:
        return None
    pct = ((end_value - start_value) / start_value) * Decimal("100")
    return pct.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

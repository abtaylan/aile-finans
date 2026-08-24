"""
zakat_engine.py
================
Fikhi kurallara gore zekat matrahi (net zekata tabi servet) ve zekat
tutarini hesaplayan, framework'ten bagimsiz saf is mantigi modulu.

ONEMLI - DINI/FIKHI VARSAYIMLAR (mutlaka mezhep/danisman onayindan gecmeli):
-----------------------------------------------------------------------
Bu modul, Turkiye'de yaygin uygulamayi (agirlikli olarak Hanefi fikhi ve
Diyanet Isleri Baskanligi'nin guncel gorusleri) esas alir, ANCAK butun
parametreleri disaridan enjekte edilebilir tasarlanmistir ki farkli
mezhep/fetva kurulu gorusleri kod degistirmeden, sadece konfigurasyonla
uygulanabilsin:

1. NISAB: Zekatin farz oldugu asgari servet siniri.
   - Altin olcusu: yaygin kabul 85 gr (bazi gorusler 80.18 gr) has altin.
   - Gumus olcusu: yaygin kabul 595 gr (200 dirhem) gumus.
   - Fakirin lehine oldugu icin bircok fetva gumus nisabini onerir (gumus
     nisabi genelde daha dusuk TL karsiligina denk gelir); ancak Turkiye'de
     yaygin pratikte ALTIN nisabi kullanilir. Varsayilan: altin, 85 gr
     (nisab_reference_grams parametresiyle degistirilebilir).

2. HAVELAN-I HAVL: Nisaba ulasan servetin uzerinden TAM BIR KAMERI YIL
   (yaklasik 354-355 gun) gecmesi gerekir. Bu modul, ailenin servetinin
   nisaba ulastigi tarihi (`hawl_start_date`) referans alarak kameri yil
   dolup dolmadigini hesaplar. Basitlestirme: servetin yil icinde nisabin
   ALTINA dusup dusmedigi (hawl'i kesintiye ugratir) takip edilmez -- bu,
   gunluk bakiye gecmisi (transactions) uzerinden ilerideki bir surumde
   eklenebilecek bir gelistirmedir (bkz. TODO).

3. ZEKATA TABI VARLIKLAR (varsayilan siniflandirma, `is_included` ile
   kalem bazinda override edilebilir):
   - Nakit (TRY ve doviz)                    -> tabi
   - Altin / gumus (ziynet esyasi dahil)      -> tabi (include_jewelry_in_zakat=True varsayilan;
                                                  bazi gorusler kullanim amacli ziynet esyasini haric tutar)
   - Ticaret amacli TEFAS fonu / hisse senedi -> tabi (piyasa degeri uzerinden)
   - Ticari mal (stok)                        -> tabi (piyasa/satis degeri uzerinden)
   - Guclu alacaklar (tahsili kuvvetli borc)   -> tabi
   - Zayif alacaklar, kullanim esyasi (ev/araba), zorunlu ihtiyaclar -> TABI DEGIL

4. DUSULEBILIR BORCLAR: Sadece hesaplama tarihinde VADESI GELMIS/kisa
   vadeli, kesin borclar matrahtan dusulur (KDV/vergi borcu, o ay odenecek
   kredi karti ekstresi vb.). Uzun vadeli kredinin (konut kredisi gibi)
   henuz vadesi gelmemis ana para toplami DUSULMEZ (fikhi ihtilafli bir
   konu olup, bu modulde varsayilan olarak sadece cari donem taksiti
   dusulur; `LiabilityInput.deductible` alaniyla override edilebilir).

5. ORAN: 1/40 = %2.5 (nakit/altin/ticari mal icin standart oran). Madenler
   (rikaz) icin %20 gibi farkli oranlar bu modulun kapsami DISINDADIR.

Bu varsayimlarin tumu bir din gorevlisi/fetva kurulu ile dogrulanmadan
UYETIM (production) ortamina alinmamalidir. Kod, varsayimlari degistirmeyi
kolaylastirmak icin parametrik tasarlanmistir.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from enum import Enum
from typing import Optional

MONEY_PLACES = Decimal("0.01")
APPROX_LUNAR_YEAR_DAYS = 354  # kameri (hicri) yil ~354.37 gun; muhafazakar asagi yuvarlama


def _q(value: Decimal) -> Decimal:
    return value.quantize(MONEY_PLACES, rounding=ROUND_HALF_UP)


class NisabBasis(str, Enum):
    GOLD = "gold"
    SILVER = "silver"


class ZakatSourceType(str, Enum):
    CASH = "cash"
    GOLD = "gold"
    SILVER = "silver"
    CURRENCY = "currency"
    TEFAS_FUND = "tefas_fund"
    STOCK = "stock"
    TRADE_GOODS = "trade_goods"
    RECEIVABLE = "receivable"
    CRYPTO = "crypto"
    OTHER_ASSET = "other_asset"


# Kaynak turune gore varsayilan zekat tabiiyeti (kalem bazinda override edilebilir).
_DEFAULT_ZAKATABLE: dict[ZakatSourceType, bool] = {
    ZakatSourceType.CASH: True,
    ZakatSourceType.GOLD: True,
    ZakatSourceType.SILVER: True,
    ZakatSourceType.CURRENCY: True,
    ZakatSourceType.TEFAS_FUND: True,
    ZakatSourceType.STOCK: True,
    ZakatSourceType.TRADE_GOODS: True,
    ZakatSourceType.RECEIVABLE: False,  # varsayilan haric -- sadece "guclu alacak" isaretlenirse dahil
    ZakatSourceType.CRYPTO: True,
    ZakatSourceType.OTHER_ASSET: False,  # kullanim esyasi (ev, araba, ev esyasi)
}


@dataclass
class ZakatableItemInput:
    """Zekat matrahina aday tek bir varlik kalemi (bir hesap/pozisyon).

    zakat_calculation_items tablosuna karsilik gelir.
    """

    source_type: ZakatSourceType
    description: str
    value_base_currency: Decimal
    source_account_id: Optional[uuid.UUID] = None
    source_asset_holding_id: Optional[uuid.UUID] = None
    quantity: Optional[Decimal] = None
    unit_value: Optional[Decimal] = None
    # Kullanicinin/danismanin kalem bazinda manuel override'i:
    # None -> _DEFAULT_ZAKATABLE tablosuna bakilir.
    force_include: Optional[bool] = None
    # Ziynet esyasi (taki) icin: is_personal_jewelry True ise ve
    # include_jewelry_in_zakat=False ise bu kalem otomatik haric tutulur.
    is_personal_jewelry: bool = False
    # RECEIVABLE turu icin: tahsili kuvvetli mi (borclu odeme gucune sahip,
    # inkar yok) yoksa zayif mi (dava asamasinda, borclu odeme gucu supheli)?
    is_strong_receivable: bool = False


@dataclass
class LiabilityInput:
    """Matrahtan dusulmesi talep edilen bir borc kalemi."""

    description: str
    amount: Decimal
    is_due_within_period: bool = True  # vadesi gelmis/kisa vadeli mi?
    deductible: Optional[bool] = None  # None -> is_due_within_period kullanilir


@dataclass
class ZakatCalculationItemResult:
    source_type: ZakatSourceType
    description: str
    value_base_currency: Decimal
    is_included_in_base: bool
    exclusion_reason: Optional[str]
    source_account_id: Optional[uuid.UUID] = None
    source_asset_holding_id: Optional[uuid.UUID] = None


@dataclass
class ZakatCalculationResult:
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
    zakat_rate: Decimal
    zakat_due_amount: Decimal
    items: list[ZakatCalculationItemResult] = field(default_factory=list)

    @property
    def is_zakat_obligatory(self) -> bool:
        """Zekat farz olmasi icin HEM nisabin uzerinde olmak HEM DE
        havelan-i havl (bir kameri yil doluşu) sarti birlikte aranir."""
        return self.is_above_nisab and self.is_hawl_complete


class ZakatEngine:
    """Zekat matrahi ve tutari hesaplayan saf (framework'ten bagimsiz) motor."""

    def __init__(
        self,
        zakat_rate: Decimal = Decimal("0.025"),
        default_gold_nisab_grams: Decimal = Decimal("85"),
        default_silver_nisab_grams: Decimal = Decimal("595"),
    ) -> None:
        self.zakat_rate = zakat_rate
        self.default_gold_nisab_grams = default_gold_nisab_grams
        self.default_silver_nisab_grams = default_silver_nisab_grams

    # ------------------------------------------------------------------
    def compute_nisab_value(
        self,
        nisab_basis: NisabBasis,
        gold_price_per_gram: Optional[Decimal] = None,
        silver_price_per_gram: Optional[Decimal] = None,
        nisab_reference_grams: Optional[Decimal] = None,
    ) -> tuple[Decimal, Decimal]:
        """(nisab_reference_grams, nisab_value_base_currency) dondurur."""
        if nisab_basis == NisabBasis.GOLD:
            if gold_price_per_gram is None:
                raise ValueError("Altin nisabi icin gold_price_per_gram zorunludur.")
            grams = nisab_reference_grams or self.default_gold_nisab_grams
            return grams, _q(grams * gold_price_per_gram)

        if silver_price_per_gram is None:
            raise ValueError("Gumus nisabi icin silver_price_per_gram zorunludur.")
        grams = nisab_reference_grams or self.default_silver_nisab_grams
        return grams, _q(grams * silver_price_per_gram)

    # ------------------------------------------------------------------
    def is_hawl_complete(
        self, hawl_start_date: Optional[date], calculation_date: date
    ) -> bool:
        """Servetin nisaba ulastigi tarihten itibaren tam bir kameri yil
        (yaklasik 354 gun) gecip gecmedigini kontrol eder.

        hawl_start_date verilmemisse (ailenin servet gecmisi henuz takip
        edilmiyorsa) MUHAFAZAKAR davranilir: hawl tamamlanmamis kabul edilir
        ve kullaniciya "ilk hesaplamaniz -- bir sonraki yil zekat farz olma
        durumu netlesecek" uyarisi gosterilmesi ONERILIR (bu motorun disinda,
        API/servis katmaninda).
        """
        if hawl_start_date is None:
            return False
        elapsed_days = (calculation_date - hawl_start_date).days
        return elapsed_days >= APPROX_LUNAR_YEAR_DAYS

    # ------------------------------------------------------------------
    def _classify_item(
        self, item: ZakatableItemInput, include_jewelry_in_zakat: bool
    ) -> tuple[bool, Optional[str]]:
        """Bir kalemin matraha dahil edilip edilmeyecegine karar verir.

        Dondurur: (is_included, exclusion_reason)
        """
        if item.force_include is not None:
            if not item.force_include:
                return False, "Kullanici/danisman tarafindan manuel haric tutuldu"
            return True, None

        if item.is_personal_jewelry and not include_jewelry_in_zakat:
            return False, "Kullanim amacli ziynet esyasi (mezhep gorusune gore haric)"

        if item.source_type == ZakatSourceType.RECEIVABLE:
            if item.is_strong_receivable:
                return True, None
            return False, "Zayif/tahsili suphei alacak (fikhen matraha dahil edilmez)"

        default_include = _DEFAULT_ZAKATABLE.get(item.source_type, False)
        if not default_include:
            reason = (
                "Kullanim esyasi / ticari olmayan sabit kiymet (zekata tabi degil)"
                if item.source_type == ZakatSourceType.OTHER_ASSET
                else "Varsayilan olarak zekata tabi degil"
            )
            return False, reason

        return True, None

    # ------------------------------------------------------------------
    def calculate(
        self,
        calculation_date: date,
        items: list[ZakatableItemInput],
        liabilities: list[LiabilityInput],
        nisab_basis: NisabBasis = NisabBasis.GOLD,
        gold_price_per_gram: Optional[Decimal] = None,
        silver_price_per_gram: Optional[Decimal] = None,
        nisab_reference_grams: Optional[Decimal] = None,
        include_jewelry_in_zakat: bool = True,
        hawl_start_date: Optional[date] = None,
    ) -> ZakatCalculationResult:
        nisab_grams, nisab_value = self.compute_nisab_value(
            nisab_basis, gold_price_per_gram, silver_price_per_gram, nisab_reference_grams
        )

        item_results: list[ZakatCalculationItemResult] = []
        total_assets = Decimal("0")
        for item in items:
            included, reason = self._classify_item(item, include_jewelry_in_zakat)
            if included:
                total_assets += item.value_base_currency
            item_results.append(
                ZakatCalculationItemResult(
                    source_type=item.source_type,
                    description=item.description,
                    value_base_currency=_q(item.value_base_currency),
                    is_included_in_base=included,
                    exclusion_reason=reason,
                    source_account_id=item.source_account_id,
                    source_asset_holding_id=item.source_asset_holding_id,
                )
            )
        total_assets = _q(total_assets)

        total_liabilities = Decimal("0")
        for liability in liabilities:
            deductible = (
                liability.deductible if liability.deductible is not None else liability.is_due_within_period
            )
            if deductible:
                total_liabilities += liability.amount
        total_liabilities = _q(total_liabilities)

        # Net matrah negatif olamaz (borclar varliklari asarsa zekat matrahi sifirdir).
        net_base = total_assets - total_liabilities
        net_base = net_base if net_base > 0 else Decimal("0")
        net_base = _q(net_base)

        is_above_nisab = net_base >= nisab_value
        hawl_ok = self.is_hawl_complete(hawl_start_date, calculation_date)

        zakat_due = _q(net_base * self.zakat_rate) if (is_above_nisab and hawl_ok) else Decimal("0")

        return ZakatCalculationResult(
            calculation_date=calculation_date,
            nisab_basis=nisab_basis,
            nisab_reference_grams=nisab_grams,
            nisab_value_base_currency=nisab_value,
            include_jewelry_in_zakat=include_jewelry_in_zakat,
            total_zakatable_assets=total_assets,
            total_deductible_liabilities=total_liabilities,
            net_zakat_base=net_base,
            is_above_nisab=is_above_nisab,
            is_hawl_complete=hawl_ok,
            zakat_rate=self.zakat_rate,
            zakat_due_amount=zakat_due,
            items=item_results,
        )

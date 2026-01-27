"""
Seed Supabase tables from small embedded CSV datasets.

Usage:
  (from scripts/backend, with venv activated)
  python3 seed.py                # seeds transactions by default
  python3 seed.py --installments # seeds installments
  python3 seed.py --transactions # seeds transactions

Environment:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_ANON_KEY

Notes:
  - This script loads `.env` from the repo root if present.
  - Inserts are de-duplicated:
    - installments: (account_id, description, amount, months_total, purchase_date)
    - transactions: import_hash
"""

from __future__ import annotations

import argparse
import csv
import io
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    from supabase import create_client
except ImportError as e:
    raise SystemExit(
        "Missing dependency `supabase`. Activate your venv and run: pip install supabase"
    ) from e


def load_dotenv():
    env_paths = [
        Path(__file__).parent.parent.parent / ".env",  # repo root
        Path(__file__).parent / ".env",  # scripts/backend
    ]
    for env_path in env_paths:
        if not env_path.exists():
            continue
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
        break


@dataclass(frozen=True)
class InstallmentRow:
    account_id: str
    description: str
    amount: float
    months_total: int
    months_remaining: int
    has_interest: bool
    interest_amount_per_month: float
    purchase_date: str


@dataclass(frozen=True)
class TransactionRow:
    account_id: str
    date: str
    description: str
    amount: float
    type: str
    category_id: str
    currency: str
    needs_review: bool


def parse_bool(value: str) -> bool:
    v = value.strip().lower()
    if v in ("true", "t", "1", "yes", "y"):
        return True
    if v in ("false", "f", "0", "no", "n"):
        return False
    raise ValueError(f"Invalid boolean: {value!r}")


def parse_csv_line(line: str) -> Tuple[str, float, int, int, bool, float, str]:
    parts = [p.strip() for p in line.split(",")]
    # Expected 7 fields.
    # If the first two were accidentally concatenated (description+amount), try to recover.
    if len(parts) == 6:
        first = parts[0]
        m = re.match(r"^(.*?)(\d+(?:\.\d+)?)$", first)
        if not m:
            raise ValueError(f"Bad CSV line (expected 7 fields): {line!r}")
        desc = m.group(1).strip()
        amount = float(m.group(2))
        parts = [desc, str(amount)] + parts[1:]

    if len(parts) != 7:
        raise ValueError(f"Bad CSV line (expected 7 fields): {line!r}")

    description = parts[0]
    amount = float(parts[1])
    months_total = int(parts[2])
    months_remaining = int(parts[3])
    has_interest = parse_bool(parts[4])
    interest_amount_per_month = float(parts[5])
    purchase_date = parts[6]
    return (
        description,
        amount,
        months_total,
        months_remaining,
        has_interest,
        interest_amount_per_month,
        purchase_date,
    )


def parse_block(account_id: str, csv_block: str) -> List[InstallmentRow]:
    lines = [ln.strip() for ln in csv_block.strip().splitlines() if ln.strip()]
    if not lines:
        return []
    header = lines[0].lower()
    if not header.startswith("description,amount,months_total"):
        raise ValueError(f"Unexpected header: {lines[0]!r}")
    out: List[InstallmentRow] = []
    for line in lines[1:]:
        if line.lower().startswith("description,amount,months_total"):
            continue
        (
            description,
            amount,
            months_total,
            months_remaining,
            has_interest,
            interest_amount_per_month,
            purchase_date,
        ) = parse_csv_line(line)
        out.append(
            InstallmentRow(
                account_id=account_id,
                description=description,
                amount=amount,
                months_total=months_total,
                months_remaining=months_remaining,
                has_interest=has_interest,
                interest_amount_per_month=interest_amount_per_month,
                purchase_date=purchase_date,
            )
        )
    return out


DATASETS: Dict[str, str] = {
    "5845cde8-0bf6-4932-91a0-555668f54a7e": """
description,amount,months_total,months_remaining,has_interest,interest_amount_per_month,purchase_date
Tecnologico de Monterrey,108777.21,3,1,false,0,2025-12-16
Diferidos Amex,7119.00,3,2,false,0,2026-01-16
Reloj Tissot,7550.00,9,7,false,0,2025-11-30
Volaris2656.00,9,7,false,0,2025-12-13
Swarovski,5980.00,6,4,false,0,2025-12-14
Lululemon Aby,2500.00,9,8,false,0,2025-12-21
""",
    "e204f10f-9df1-45d1-a52d-4f3954a35119": """
description,amount,months_total,months_remaining,has_interest,interest_amount_per_month,purchase_date
Tecmilenio Ago-Dic,10000.00,3,1,false,0,2025-11-13
Tecmileio Ago-Dic 2,1012.32,3,1,false,0,2025-11-14
Pandora,3340.00,6,4,false,0,2025-12-04
""",
    "38167391-578a-4493-a433-2374df72fe67": """
description,amount,months_total,months_remaining,has_interest,interest_amount_per_month,purchase_date
PLAN DE PAGOS DIFERIDOS,6377.40,12,1,true,221.93,2026-03-01
PLAN DE PAGOS DIFERIDOS,10099.00,9,6,true,351.45,2025-10-24
description,amount,months_total,months_remaining,has_interest,interest_amount_per_month,purchase_date
MACSTORE NUEVO SUR MONTERREY,25999.00,15,3,false,0,2025-02-16
AMAZON MX MSI MKT*AMAZO,273.64,12,2,false,0,2025-03-21
AMAZON MX MSI MKT*AMAZO,294.76,12,2,false,0,2025-03-21
AMAZON MX MSI RETAIL,8999.08,12,2,false,0,2025-03-21
AMAZON MX MSI MKT*AMAZO,408.03,12,2,false,0,2025-03-21
AMAZON MX MSI RETAIL,11324.53,12,3,false,0,2025-04-20
MACSTORE PABELLON M MONTERREY,22999.00,15,6,false,0,2025-05-03
AMAZON MX MSI RETAIL,4057.00,12,4,false,0,2025-05-28
MACSTORE NUEVO SUR MONTERREY,5499.00,15,11,false,0,2025-09-20
VIVAAEROBUS,7384.87,9,5,false,0,2025-10-14
VIVAAEROBUS WEB APODACA,2093.01,3,0,false,0,2025-11-05
UGG PUNTO VALLE SAN PEDRO,9180.00,9,8,false,0,2025-12-23
""",
}

TRANSACTIONS_DATASETS: Dict[str, str] = {
    "5845cde8-0bf6-4932-91a0-555668f54a7e": """
date,description,amount,type,category_id,currency,needs_review
2025-12-16,-KIGO- PUEBLA,100.00,expense,710c6e4e-6c87-4ee7-9160-3aab94c1cb25,MXN,FALSE
2025-12-17,OXXO MEXICO MX,65.00,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2025-12-17,REST SUCURSALVALLE SAN PEDRO GARZA,896.50,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2025-12-18,OXXO MEXICO MX,217.00,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2025-12-21,OUM CAFE KALI SAN PEDRO GARZA,97.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2025-12-21,-KIGO- PUEBLA,100.00,expense,710c6e4e-6c87-4ee7-9160-3aab94c1cb25,MXN,FALSE
2025-12-21,VELPAYLULO GELATO ARBO,233.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2025-12-21,BIG FOOD ARRACHERAS MONTERREY NL,1000.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2025-12-22,-KIGO- PUEBLA,100.00,expense,710c6e4e-6c87-4ee7-9160-3aab94c1cb25,MXN,FALSE
2025-12-22,PLOG LC MONTERREY,175.00,expense,35002e2e-a4bd-49c0-a02e-22edeb9e614e,MXN,FALSE
2025-12-22,F AHORRO MTSR SAGITARI MONTERREY NL,147.00,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2025-12-22,F AHORRO MTEU REVOLUC MONTERREY NL,215.00,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2025-12-23,DOÑA TOTA FIESTA S AGUS,104.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2025-12-24,YOLOPAGOXILE.CHILE,320.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2025-12-24,VELPAYGAGOOTZ ARMIDA,286.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2025-12-24,REST KALI COFFEE ROASTE,260.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2025-12-25,HELADOS SULTANA MONTERREY,248.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2025-12-26,CONEKTAPARCO ZAPOPAN,40.00,expense,710c6e4e-6c87-4ee7-9160-3aab94c1cb25,MXN,FALSE
2025-12-26,CORTEFIEL BOUT SPRINGF,504.00,expense,05d2e551-ea3c-4a76-92fc-92c733ffed59,MXN,FALSE
2025-12-26,-KIGO- PUEBLA,100.00,expense,710c6e4e-6c87-4ee7-9160-3aab94c1cb25,MXN,FALSE
2025-12-26,ABTS U GURT SN PEDRO GARZ,321.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2025-12-27,H-E-B CONTRY MEXICO,59.00,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2025-12-27,H-E-B CONTRY MEXICO,371.60,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2025-12-28,REST NOGU SN PEDRO GARZ,97.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2025-12-28,H-E-B CHIPINQUE MEXICO,245.55,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2025-12-29,-KIGO- PUEBLA,100.00,expense,710c6e4e-6c87-4ee7-9160-3aab94c1cb25,MXN,FALSE
2025-12-29,-KIGO- PUEBLA,100.00,expense,710c6e4e-6c87-4ee7-9160-3aab94c1cb25,MXN,FALSE
2025-12-29,EXALTA HERO SAPI,901.00,expense,05d2e551-ea3c-4a76-92fc-92c733ffed59,MXN,FALSE
2025-12-29,EXALTA HERO SAPI,1001.00,expense,05d2e551-ea3c-4a76-92fc-92c733ffed59,MXN,FALSE
2025-12-29,SEPHORA GAL MTY IC,200.00,expense,05d2e551-ea3c-4a76-92fc-92c733ffed59,MXN,FALSE
2025-12-29,LIV MONTERREY 0031,249.00,expense,05d2e551-ea3c-4a76-92fc-92c733ffed59,MXN,FALSE
2025-12-30,COM PREP TEC,115.00,expense,35002e2e-a4bd-49c0-a02e-22edeb9e614e,MXN,FALSE
2025-12-31,STRADIVARIUS PUNTO VALL,3130.00,expense,05d2e551-ea3c-4a76-92fc-92c733ffed59,MXN,FALSE
2026-01-04,UBER TRIP,149.95,expense,710c6e4e-6c87-4ee7-9160-3aab94c1cb25,MXN,FALSE
2026-01-04,H-E-B CHIPINQUE MEXICO,345.30,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2026-01-04,STRADIVARIUS PUNTO VALL,1127.00,expense,05d2e551-ea3c-4a76-92fc-92c733ffed59,MXN,FALSE
2026-01-04,REST CHILAQUERIAMX,160.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2026-01-04,CINEPOLIS0875,39.00,expense,baaa5583-60ed-4ddf-aba7-0e818b71ec6f,MXN,FALSE
2026-01-04,CINEPOLIS0875,39.00,expense,baaa5583-60ed-4ddf-aba7-0e818b71ec6f,MXN,FALSE
2026-01-05,EL PALACIO HIERRO MONTE,3989.00,expense,05d2e551-ea3c-4a76-92fc-92c733ffed59,MXN,FALSE
2026-01-05,CAFE SIRENA SOCIEDAD DE MEXICO,163.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2026-01-06,LUMEN REVOLUCION CONTRY,4.00,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2026-01-06,LUMEN REVOLUCION CONTRY,9.00,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2026-01-06,BOLA DE ORO MONTERREY,50.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2026-01-06,BOLA DE ORO MONTERREY,70.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2026-01-06,H-E-B CONTRY MEXICO,132.00,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2026-01-07,DOMINOS TECNOLOGICO MTY,299.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2026-01-07,HOME DEPOT REVOLUCION,187.00,expense,8a963d65-1b85-4e7c-b639-1f606417751f,MXN,FALSE
2026-01-08,CAFE SIRENA SOCIEDAD DE MEXICO,59.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2026-01-08,GORDITAS DONA TOTA,228.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2026-01-09,DR NORMA MONTERREY NL,500.00,expense,0dcb0be3-7a79-4366-82be-ce9840ade4be,MXN,FALSE
2026-01-09,REST SS CONTRY MONTERREY NL,362.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2026-01-09,-KIGO- PUEBLA,100.00,expense,710c6e4e-6c87-4ee7-9160-3aab94c1cb25,MXN,FALSE
2026-01-09,OXXO MEXICO MX,311.00,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2026-01-09,LA ESTANZUELA NUEVO LEON,900.32,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2026-01-10,TACO PALENQUE SANTIAGO NL,440.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2026-01-10,OXXO MEXICO MX,76.00,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2026-01-10,OXXO MEXICO MX,37.00,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2026-01-11,H-E-B CONTRY MEXICO,125.80,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2026-01-11,OXXO MEXICO MX,65.00,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2026-01-11,REST THE BRITISH PUB,1449.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2026-01-12,CARLS JR CONTRY,257.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2026-01-12,OXXO MEXICO MX,57.50,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2026-01-13,REST CREP PARI FAS DRI,136.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2026-01-13,-KIGO- PUEBLA,100.00,expense,710c6e4e-6c87-4ee7-9160-3aab94c1cb25,MXN,FALSE
2026-01-13,MERCADOPAGOENRROLLADOS,104.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2026-01-13,JUGUETRON T734,259.00,expense,05d2e551-ea3c-4a76-92fc-92c733ffed59,MXN,FALSE
2026-01-13,KRISPY KREME,75.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2026-01-13,NETPAYMOONWALK COOKIES,85.00,expense,35002e2e-a4bd-49c0-a02e-22edeb9e614e,MXN,FALSE
2026-01-13,7 ELEVEN T 1583,55.50,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2026-01-14,DAIRY QUEEN CONTRY,107.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2026-01-14,TACO PALENQUE CONTRY,398.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2026-01-15,TAPIOCA HOUSE,188.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2026-01-15,ZARAPUNTOVALLE,403.00,expense,05d2e551-ea3c-4a76-92fc-92c733ffed59,MXN,FALSE
2026-01-16,CONEKTA*PARCO ZAPOPAN,34.00,expense,710c6e4e-6c87-4ee7-9160-3aab94c1cb25,MXN,FALSE
2026-01-16,MUSK AND MOSS MONTERREY NL,250.00,expense,05d2e551-ea3c-4a76-92fc-92c733ffed59,MXN,FALSE
2026-01-16,NAPOLI PIZZA,185.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2026-01-02,KATE SPADE NEW YORK,1570.40,expense,05d2e551-ea3c-4a76-92fc-92c733ffed59,MXN,FALSE
2026-01-02,HUGO BOSS RETAIL INC,2325.68,expense,05d2e551-ea3c-4a76-92fc-92c733ffed59,MXN,FALSE
""".strip(),
    "e204f10f-9df1-45d1-a52d-4f3954a35119": """
date,description,amount,type,category_id,currency,needs_review
2025-12-13,ESTAC PUNTO VALLE CAJA,45.00,expense,710c6e4e-6c87-4ee7-9160-3aab94c1cb25,MXN,FALSE
2025-12-14,SERV DEL VALLE MOR,940.19,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2025-12-16,MERPAGO*ANILLOSPEART,800.00,expense,05d2e551-ea3c-4a76-92fc-92c733ffed59,MXN,FALSE
2025-12-16,FOTOVIDA CONTRY,72.80,expense,05d2e551-ea3c-4a76-92fc-92c733ffed59,MXN,FALSE
2025-12-17,SYMA LAZARO CARDENAS,230.00,expense,35002e2e-a4bd-49c0-a02e-22edeb9e614e,MXN,FALSE
2025-12-18,F AHORRO MTSR SAGITARI,134.00,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2025-12-21,REST SHOW CENTER,400.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2025-12-27,F AHORRO MTTZ RIO TMZE,36.50,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2025-12-28,PISTA DE HIELO FUND,570.00,expense,baaa5583-60ed-4ddf-aba7-0e818b71ec6f,MXN,FALSE
2025-12-28,REST ALIADAS SAN PEDRO,390.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2025-12-29,GLOBOS Y FIGURAS,72.00,expense,05d2e551-ea3c-4a76-92fc-92c733ffed59,MXN,FALSE
2025-12-30,OXXO GAS BOULEVARD ACA,800.43,expense,710c6e4e-6c87-4ee7-9160-3aab94c1cb25,MXN,FALSE
2025-12-31,ESTAC PUNTO VALLE CAJA,45.00,expense,710c6e4e-6c87-4ee7-9160-3aab94c1cb25,MXN,FALSE
2026-01-05,PALACIOHIERROMONTERREY,329.70,expense,05d2e551-ea3c-4a76-92fc-92c733ffed59,MXN,FALSE
2025-12-17,PAGO INGRESOSFEDERALES,1773.00,expense,35002e2e-a4bd-49c0-a02e-22edeb9e614e,MXN,FALSE
2025-12-17,COMERCIO ELECTRONICO TEC,600.00,expense,05d2e551-ea3c-4a76-92fc-92c733ffed59,MXN,FALSE
2025-12-31,UBER,70.00,expense,710c6e4e-6c87-4ee7-9160-3aab94c1cb25,MXN,FALSE
""".strip(),
    "e58636ae-dc7b-48b9-b2f1-0f7c28e57460": """
date,description,amount,type,category_id,currency,needs_review
2025-12-15,COSTCO MONTERREY,1199.95,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2025-12-15,COSTCO MONTERREY,799.00,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
""".strip(),
    "e539995d-4463-48d7-8a71-4f920a08ca3f": """
date,description,amount,type,category_id,currency,needs_review
2025-12-16,FARM GUADALAJARA,18.00,expense,b9902740-0ce3-49db-8037-af709711ea19,MXN,FALSE
2025-12-19,PAYPAL*GOOGLE YOUTUBE,99.00,expense,baaa5583-60ed-4ddf-aba7-0e818b71ec6f,MXN,FALSE
2025-12-28,RAPPI,397.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
2025-12-31,RAPPI,69.00,expense,8d73d9b3-c8f4-4b81-aa60-1c6d52b35e38,MXN,FALSE
""".strip(),
}


def compute_import_hash(data: Dict[str, object]) -> str:
    import hashlib

    normalized = "|".join(
        [
            str(data.get("date", "")),
            str(data.get("description", "")).strip().lower(),
            str(data.get("type", "")),
            f"{float(data.get('amount', 0)):.2f}",
            str(data.get("category_id", "")),
            str(data.get("account_id", "")),
            str(data.get("currency", "")),
        ]
    )
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def parse_transactions_block(account_id: str, csv_text: str) -> List[TransactionRow]:
    reader = csv.DictReader(io.StringIO(csv_text.strip()))
    expected = {"date", "description", "amount", "type", "category_id", "currency", "needs_review"}
    if set(reader.fieldnames or []) != expected:
        raise ValueError(f"Unexpected header (expected {sorted(expected)}): {reader.fieldnames!r}")

    rows: List[TransactionRow] = []
    for row in reader:
        rows.append(
            TransactionRow(
                account_id=account_id,
                date=str(row.get("date") or "").strip(),
                description=str(row.get("description") or "").strip(),
                amount=float(row.get("amount") or 0),
                type=str(row.get("type") or "expense").strip().lower(),
                category_id=str(row.get("category_id") or "").strip(),
                currency=str(row.get("currency") or "MXN").strip().upper(),
                needs_review=parse_bool(str(row.get("needs_review") or "false")),
            )
        )
    return rows


def seed_installments(client) -> None:
    rows: List[InstallmentRow] = []
    for account_id, csv_block in DATASETS.items():
        rows.extend(parse_block(account_id, csv_block))

    payload = [
        {
            "account_id": r.account_id,
            "description": r.description,
            "amount": r.amount,
            "months_total": r.months_total,
            "months_remaining": r.months_remaining,
            "has_interest": r.has_interest,
            "interest_amount_per_month": r.interest_amount_per_month,
            "purchase_date": r.purchase_date,
        }
        for r in rows
    ]

    # Dedupe: skip rows already present (account + description + amount + months_total + purchase_date)
    account_ids = sorted(set(DATASETS.keys()))
    existing_result = (
        client.table("installments")
        .select("account_id,description,amount,months_total,purchase_date")
        .in_("account_id", account_ids)
        .execute()
    )
    if getattr(existing_result, "error", None):
        raise SystemExit(f"Failed to read existing installments: {existing_result.error}")
    existing_rows = getattr(existing_result, "data", None) or []
    existing_keys = set()
    for row in existing_rows:
        existing_keys.add(
            (
                str(row.get("account_id")),
                str(row.get("description") or "").strip().lower(),
                float(row.get("amount") or 0),
                int(row.get("months_total") or 0),
                str(row.get("purchase_date") or ""),
            )
        )

    deduped_payload = []
    skipped = 0
    for item in payload:
        key = (
            str(item.get("account_id")),
            str(item.get("description") or "").strip().lower(),
            float(item.get("amount") or 0),
            int(item.get("months_total") or 0),
            str(item.get("purchase_date") or ""),
        )
        if key in existing_keys:
            skipped += 1
            continue
        deduped_payload.append(item)

    if not deduped_payload:
        print(f"No new rows to insert (skipped {skipped} duplicates).")
        return

    result = client.table("installments").insert(deduped_payload).execute()
    if getattr(result, "error", None):
        raise SystemExit(f"Insert failed: {result.error}")

    inserted = getattr(result, "data", None) or []
    print(f"Inserted {len(inserted)} installment rows into Supabase (skipped {skipped} duplicates).")


def seed_transactions(client) -> None:
    payload_by_hash: Dict[str, Dict[str, object]] = {}
    total_rows = 0
    for account_id, csv_text in TRANSACTIONS_DATASETS.items():
        rows = parse_transactions_block(account_id, csv_text)
        total_rows += len(rows)
        for r in rows:
            item = {
                "date": r.date,
                "description": r.description,
                "amount": r.amount,
                "type": r.type,
                "category_id": r.category_id,
                "account_id": r.account_id,
                "currency": r.currency,
                "needs_review": r.needs_review,
                "source": "seed",
            }
            item["import_hash"] = compute_import_hash(item)
            payload_by_hash[str(item["import_hash"])] = item

    deduped_payload = list(payload_by_hash.values())
    intra_csv_duplicates = total_rows - len(deduped_payload)
    if not deduped_payload:
        print("No transactions to insert (empty dataset).")
        return

    # Use upsert(ignore_duplicates) so we don't require read access to check existing hashes (RLS-safe).
    result = (
        client.table("transactions")
        .upsert(deduped_payload, on_conflict="import_hash", ignore_duplicates=True)
        .execute()
    )
    if getattr(result, "error", None):
        raise SystemExit(f"Insert failed: {result.error}")

    inserted = getattr(result, "data", None) or []
    print(
        f"Inserted {len(inserted)} transactions into Supabase "
        f"(collapsed {intra_csv_duplicates} duplicates by import_hash)."
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed Supabase with embedded datasets.")
    parser.add_argument("--installments", action="store_true", help="Seed the `installments` table.")
    parser.add_argument("--transactions", action="store_true", help="Seed the `transactions` table.")
    return parser.parse_args()


def main():
    args = parse_args()
    if not args.installments and not args.transactions:
        args.transactions = True

    load_dotenv()
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    supabase_key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        or os.getenv("SUPABASE_ANON_KEY", "").strip()
    )
    if not supabase_url or not supabase_key:
        raise SystemExit(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY in environment."
        )

    client = create_client(supabase_url, supabase_key)
    if args.installments:
        seed_installments(client)
    if args.transactions:
        seed_transactions(client)


if __name__ == "__main__":
    main()

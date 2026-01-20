"""
Seed Supabase `installments` table from a small embedded CSV dataset.

Usage:
  (from scripts/backend, with venv activated)
  python3 seed.py

Environment:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_ANON_KEY

Notes:
  - This script loads `.env` from the repo root if present.
  - Inserts are not de-duplicated (run once unless you want duplicates).
"""

from __future__ import annotations

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


def main():
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


if __name__ == "__main__":
    main()

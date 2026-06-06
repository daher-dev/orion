"""Montador DTF integration.

Sends a batch's print designs to the external DTF assembler. Each design with a
positive ``qty_to_print`` is expanded into one or two POSTs (front / back) and
delivered to ``MONTADOR_URL`` authenticated with the ``x-orion-secret`` header.

A design is marked ``prints_sent`` only when *all* its sides succeed (the legacy
"montado" rule). The HTTPS call is mocked via ``respx`` in tests — the real
network is never touched.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import UTC, datetime

import httpx
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from config import config
from models import Batch, BatchPrintAdjustment, Company, PrintDesign
from services._audit import write_audit
from services._base import scoped
from shared.exceptions import NotFoundError, ValidationError

_RESOURCE = "batches"
_TIMEOUT = 30.0


def _num(value) -> float | None:
    return float(value) if value is not None else None


async def send_batch_to_montador(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    user_id: uuid.UUID | None,
    batch_id: uuid.UUID,
) -> dict:
    if not config.ORION_MONTADOR_SECRET:
        raise ValidationError(detail="Montador DTF secret is not configured")

    batch = (await db.exec(scoped(select(Batch), Batch, company_id).where(Batch.id == batch_id))).first()
    if batch is None:
        raise NotFoundError(detail="Batch not found")

    company = (await db.exec(select(Company).where(Company.id == company_id))).first()
    if company is None or not company.montador_user_email:
        raise ValidationError(detail="Company has no Montador DTF user email configured")

    # Aggregate to-print quantities per design (Orion stores artwork at the
    # design level, so multiple product colours collapse into one send).
    rows = (
        await db.exec(
            select(BatchPrintAdjustment, PrintDesign)
            .join(PrintDesign, PrintDesign.id == BatchPrintAdjustment.print_design_id)
            .where(
                BatchPrintAdjustment.company_id == company_id,
                BatchPrintAdjustment.batch_id == batch_id,
                BatchPrintAdjustment.qty_to_print > 0,
            )
        )
    ).all()

    qty_by_design: dict[uuid.UUID, int] = defaultdict(int)
    design_by_id: dict[uuid.UUID, PrintDesign] = {}
    adj_by_design: dict[uuid.UUID, list[BatchPrintAdjustment]] = defaultdict(list)
    for adj, design in rows:
        qty_by_design[design.id] += adj.qty_to_print
        design_by_id[design.id] = design
        adj_by_design[design.id].append(adj)

    results: list[dict] = []

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        for design_id, quantity in qty_by_design.items():
            design = design_by_id[design_id]
            front = design.image_url_front or design.image_url
            back = design.image_url_back
            has_both = bool(front and back)

            # (external_name, side, image_url) — external_name keeps the
            # "(Frente)"/"(Costas)" suffix the Montador service expects; `side`
            # is our internal English label.
            sends: list[tuple[str, str, str]] = []
            if front:
                sends.append((f"{design.name} (Frente)" if has_both else design.name, "front", front))
            if back:
                sends.append((f"{design.name} (Costas)" if has_both else design.name, "back", back))

            if not sends:
                results.append(
                    {
                        "design_name": design.name,
                        "design_id": str(design_id),
                        "success": False,
                        "error": "Design has no print artwork (front or back)",
                    }
                )
                continue

            design_all_ok = True
            for external_name, side, image_url in sends:
                # Body shape is the Montador DTF wire contract — its (Portuguese)
                # field names must match what montadordtf.com.br expects.
                payload = {
                    "owner_email": company.montador_user_email,
                    "estampa_nome": external_name,
                    "cor": "",
                    "quantidade": quantity,
                    "foto_url": image_url,
                    "largura_cm": _num(design.width_cm),
                    "altura_cm": _num(design.height_cm),
                    "largura": _num(design.width_cm),
                    "altura": _num(design.height_cm),
                    "dimensoes": {
                        "largura_cm": _num(design.width_cm),
                        "altura_cm": _num(design.height_cm),
                        "largura": _num(design.width_cm),
                        "altura": _num(design.height_cm),
                    },
                }
                try:
                    resp = await client.post(
                        config.MONTADOR_URL,
                        json=payload,
                        headers={"x-orion-secret": config.ORION_MONTADOR_SECRET},
                    )
                except httpx.HTTPError as exc:
                    design_all_ok = False
                    results.append({"design_name": design.name, "side": side, "success": False, "error": str(exc)})
                    continue

                if resp.status_code >= 400:
                    design_all_ok = False
                    try:
                        detail = resp.json().get("error", f"HTTP {resp.status_code}")
                    except Exception:
                        detail = f"HTTP {resp.status_code}"
                    results.append({"design_name": design.name, "side": side, "success": False, "error": detail})
                    continue

                try:
                    montador_id = resp.json().get("id")
                except Exception:
                    montador_id = None
                results.append(
                    {
                        "design_name": design.name,
                        "side": side,
                        "success": True,
                        "montador_id": montador_id,
                    }
                )

            # Mark the design's adjustment rows as sent only if every side succeeded.
            if design_all_ok:
                for adj in adj_by_design[design_id]:
                    adj.prints_sent = True
                    db.add(adj)

    succeeded = sum(1 for r in results if r["success"])
    failed = sum(1 for r in results if not r["success"])

    if failed == 0 and succeeded > 0:
        batch.prints_sent_at = datetime.now(UTC)
        db.add(batch)

    await write_audit(
        db,
        company_id=company_id,
        user_id=user_id,
        resource_type=_RESOURCE,
        resource_id=batch.id,
        message=f"Sent batch {batch.code} to Montador DTF ({succeeded} ok, {failed} failed)",
    )
    await db.commit()

    return {"total": len(results), "succeeded": succeeded, "failed": failed, "results": results}


__all__ = ["send_batch_to_montador"]

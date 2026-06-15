"""Read-only audit for historical RUKANO Firestore consistency risks."""

import argparse
import hashlib
import json
from collections import defaultdict

from core.firebase_config import db
from services.availability_service import ESTADOS_BLOQUEAN_HORARIO


def block_id(technician_id: str, date: str, time: str) -> str:
    key = f"{technician_id}|{date}|{time}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def appointment_id(snapshot, data: dict) -> str:
    return str(data.get("idCita") or snapshot.id)


def audit() -> dict:
    appointments = [(doc, doc.to_dict()) for doc in db.collection("citas").stream()]
    reviews = [(doc, doc.to_dict()) for doc in db.collection("resenas").stream()]
    blocks = {
        doc.id: doc.to_dict()
        for doc in db.collection("bloques_horarios").stream()
    }

    active_slots = defaultdict(list)
    missing_blocks = []
    for snapshot, data in appointments:
        if str(data.get("estado") or "").strip().lower() not in ESTADOS_BLOQUEAN_HORARIO:
            continue

        technician_id = str(data.get("idTecnico") or "")
        date = str(data.get("fecha") or "")
        time = str(data.get("hora") or "")
        if not technician_id or not date or not time:
            continue

        citation_id = appointment_id(snapshot, data)
        slot = (technician_id, date, time)
        active_slots[slot].append(citation_id)

        expected_block_id = block_id(*slot)
        block = blocks.get(expected_block_id)
        if not block or str(block.get("idCita") or "") != citation_id:
            missing_blocks.append({
                "cita_id": citation_id,
                "id_tecnico": technician_id,
                "fecha": date,
                "hora": time,
                "bloque_esperado": expected_block_id,
                "bloque_encontrado": block,
            })

    duplicate_appointments = [
        {
            "id_tecnico": slot[0],
            "fecha": slot[1],
            "hora": slot[2],
            "citas": citation_ids,
        }
        for slot, citation_ids in active_slots.items()
        if len(citation_ids) > 1
    ]

    reviews_by_appointment = defaultdict(list)
    for snapshot, data in reviews:
        citation_id = str(
            data.get("citaId")
            or data.get("idCita")
            or data.get("idCitas")
            or ""
        )
        if citation_id:
            reviews_by_appointment[citation_id].append(snapshot.id)

    duplicate_reviews = [
        {"cita_id": citation_id, "resenas": review_ids}
        for citation_id, review_ids in reviews_by_appointment.items()
        if len(review_ids) > 1
    ]

    return {
        "read_only": True,
        "summary": {
            "citas_revisadas": len(appointments),
            "resenas_revisadas": len(reviews),
            "bloques_revisados": len(blocks),
            "grupos_citas_activas_duplicadas": len(duplicate_appointments),
            "grupos_resenas_duplicadas": len(duplicate_reviews),
            "citas_activas_sin_bloque_valido": len(missing_blocks),
        },
        "citas_activas_duplicadas": duplicate_appointments,
        "resenas_duplicadas": duplicate_reviews,
        "citas_sin_bloque_valido": missing_blocks,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Audita inconsistencias historicas sin modificar Firestore."
    )
    parser.add_argument(
        "--output",
        help="Ruta opcional para guardar el informe JSON.",
    )
    args = parser.parse_args()

    report = audit()
    serialized = json.dumps(report, ensure_ascii=False, indent=2, default=str)
    print(serialized)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as output_file:
            output_file.write(serialized)
            output_file.write("\n")


if __name__ == "__main__":
    main()

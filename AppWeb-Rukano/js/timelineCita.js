const ETAPAS_LINEALES = [
    { estado: "pendiente", etiqueta: "Solicitud enviada" },
    { estado: "reservada", etiqueta: "Cita aceptada" },
    { estado: "pago_realizado", etiqueta: "Pago confirmado" },
    { estado: "concluida", etiqueta: "Servicio concluido" }
];

const ESTADOS_ESPECIALES = {
    cancelada: {
        etiqueta: "Cita cancelada",
        descripcion: "Esta cita fue cancelada y ya no tiene acciones disponibles."
    },
    reembolso_solicitado: {
        etiqueta: "Reembolso solicitado",
        descripcion: "La solicitud está pendiente de revisión."
    },
    caducada: {
        etiqueta: "Cita caducada",
        descripcion: "La cita expiró antes de completar el flujo."
    }
};

export function normalizarEstadoCita(estado) {
    return String(estado || "").trim().toLowerCase();
}

export function obtenerEtiquetaEstadoCita(estado) {
    const estadoNormalizado = normalizarEstadoCita(estado);
    const etapa = ETAPAS_LINEALES.find((item) => item.estado === estadoNormalizado);
    return etapa?.etiqueta || ESTADOS_ESPECIALES[estadoNormalizado]?.etiqueta || "Estado no disponible";
}

export function crearTimelineEstado(estado) {
    const estadoNormalizado = normalizarEstadoCita(estado);
    const indiceActual = ETAPAS_LINEALES.findIndex((item) => item.estado === estadoNormalizado);
    const estadoEspecial = ESTADOS_ESPECIALES[estadoNormalizado];

    if (estadoEspecial) {
        return `
            <div class="timeline-cita timeline-cita--especial timeline-cita--${estadoNormalizado}"
                 data-timeline-cita
                 data-estado="${estadoNormalizado}">
                <span class="timeline-cita__especial-icono" aria-hidden="true">!</span>
                <div>
                    <strong>${estadoEspecial.etiqueta}</strong>
                    <p>${estadoEspecial.descripcion}</p>
                </div>
            </div>
        `;
    }

    if (indiceActual < 0) {
        return `
            <div class="timeline-cita timeline-cita--especial timeline-cita--desconocido"
                 data-timeline-cita
                 data-estado="desconocido">
                <span class="timeline-cita__especial-icono" aria-hidden="true">?</span>
                <div>
                    <strong>Estado no disponible</strong>
                    <p>No pudimos identificar la etapa actual de esta cita.</p>
                </div>
            </div>
        `;
    }

    const pasos = ETAPAS_LINEALES.map((etapa, indice) => {
        const clase = indice < indiceActual
            ? "completado"
            : indice === indiceActual
                ? "actual"
                : "pendiente";

        return `
            <li class="timeline-cita__paso timeline-cita__paso--${clase}"
                ${indice === indiceActual ? 'aria-current="step"' : ""}>
                <span class="timeline-cita__punto">${indice < indiceActual ? "✓" : indice + 1}</span>
                <span class="timeline-cita__etiqueta">${etapa.etiqueta}</span>
            </li>
        `;
    }).join("");

    return `
        <div class="timeline-cita" data-timeline-cita data-estado="${estadoNormalizado}">
            <ol class="timeline-cita__lista" aria-label="Estado de la cita">
                ${pasos}
            </ol>
        </div>
    `;
}

export function crearTimelineEstadoCompacto(estado) {
    const estadoNormalizado = normalizarEstadoCita(estado);
    const indiceActual = ETAPAS_LINEALES.findIndex((item) => item.estado === estadoNormalizado);
    const etiqueta = obtenerEtiquetaEstadoCita(estadoNormalizado);

    if (indiceActual < 0) {
        const claseEspecial = ESTADOS_ESPECIALES[estadoNormalizado]
            ? estadoNormalizado
            : "desconocido";
        return `
            <div class="timeline-cita-compacto timeline-cita-compacto--${claseEspecial}">
                <span class="timeline-cita-compacto__alerta" aria-hidden="true">!</span>
                <span>${etiqueta}</span>
            </div>
        `;
    }

    const puntos = ETAPAS_LINEALES.map((_, indice) => {
        const clase = indice <= indiceActual ? "activo" : "pendiente";
        return `<span class="timeline-cita-compacto__punto timeline-cita-compacto__punto--${clase}"></span>`;
    }).join("");

    return `
        <div class="timeline-cita-compacto" title="${etiqueta}">
            <span class="timeline-cita-compacto__puntos" aria-hidden="true">${puntos}</span>
            <span>${etiqueta}</span>
        </div>
    `;
}

export function actualizarTimelineCita(contenedor, estado) {
    const timelineActual = contenedor?.querySelector("[data-timeline-cita]");
    if (!timelineActual) return;

    const temporal = document.createElement("div");
    temporal.innerHTML = crearTimelineEstado(estado).trim();
    timelineActual.replaceWith(temporal.firstElementChild);
}

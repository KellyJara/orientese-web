import type { Opcion, Plan } from "../lib/planificador";

const COLORES = {
  navy: "#123B94",
  gold: "#F6B71B",
  muted: "#98A4BD",
  verde: "#2E9E5B",
};

type Props = {
  plan: Plan;
  opcionActivaId: string | null;
  minimizado: boolean;
  onMinimizar: () => void;
  onCerrar: () => void;
  onVerOpcion: (id: string) => void;
  onEscoger: (opcion: Opcion) => void;
};

const colorDeFranja = (tipo: Plan["tipo"]) =>
  tipo === "directa"
    ? COLORES.verde
    : tipo === "transbordo"
    ? COLORES.navy
    : tipo === "cercana-destino"
    ? COLORES.gold
    : COLORES.muted;

const tituloDelPlan = (plan: Plan) => {
  const n = plan.opciones.length;
  if (plan.tipo === "directa") {
    return n > 1 ? `${n} rutas directas` : "Ruta directa";
  }
  if (plan.tipo === "transbordo") {
    return n > 1 ? `${n} opciones de ruta` : "Opción de ruta";
  }
  if (plan.tipo === "cercana-destino") {
    return n > 1 ? `${n} rutas al destino` : "Ruta al destino";
  }
  return "Sin rutas";
};

/** Tarjeta con las opciones de viaje encontradas. */
export default function TarjetaPlan({
  plan,
  opcionActivaId,
  minimizado,
  onMinimizar,
  onCerrar,
  onVerOpcion,
  onEscoger,
}: Props) {
  const elegida = plan.opciones.find((o) => o.id === opcionActivaId) ?? null;

  return (
    <div className={`tarjeta${minimizado ? " minimizada" : ""}`}>
      <div className="tarjeta-header">
        <div
          className="tarjeta-franja"
          style={{ background: colorDeFranja(plan.tipo) }}
        />
        <button
          type="button"
          className="tarjeta-toggle"
          onClick={onMinimizar}
          title={minimizado ? "Desplegar" : "Plegar"}
        >
          <span className="tarjeta-titulo">{tituloDelPlan(plan)}</span>
          <span className="tarjeta-sub">{plan.mensaje}</span>
        </button>
        <button
          type="button"
          className="tarjeta-btn"
          onClick={onMinimizar}
          aria-expanded={!minimizado}
          title={minimizado ? "Desplegar" : "Plegar"}
        >
          {minimizado ? "⌃" : "⌄"}
        </button>
        <button
          type="button"
          className="tarjeta-btn"
          onClick={onCerrar}
          title="Cerrar"
        >
          ✕
        </button>
      </div>

      {!minimizado && plan.opciones.length > 0 && (
        <>
          <div className="opciones">
            {plan.opciones.map((op, i) => {
              const activa = opcionActivaId === op.id;
              const color = op.feature.properties.stroke || COLORES.navy;
              const esDirecta = plan.tipo === "directa";
              const esTransbordo = !!op.transbordo; // por opción, no por plan
              const caminata = Math.round((op.dOrigen + op.dDestino) * 1000);
              const aSubir = Math.round(op.dOrigen * 1000);
              const nombre = esTransbordo
                ? `${op.feature.properties.name} → ${op.rutaB.properties.name}`
                : op.feature.properties.name;
              const etiqueta =
                i === 0
                  ? esDirecta
                    ? "  · menos caminata"
                    : "  · recomendada"
                  : "";
              const meta = esDirecta
                ? `${op.largo.toFixed(1)} km de recorrido · ~${caminata} m a pie`
                : esTransbordo
                ? `Cambio en el centro · ${op.largo.toFixed(
                    1
                  )} km en bus · ~${caminata} m a pie`
                : `1 bus · camina ~${aSubir} m hasta la parada · ${op.largo.toFixed(
                    1
                  )} km en bus`;

              return (
                <button
                  key={op.id}
                  type="button"
                  className="opcion"
                  style={
                    activa
                      ? { borderColor: color, background: "#F7F9FE" }
                      : undefined
                  }
                  // Tocar la opción = VER: se vuelve la opción activa y el mapa
                  // dibuja solo su tramo + caminata y lo encuadra.
                  onClick={() => onVerOpcion(op.id)}
                >
                  <span
                    className="opcion-punto"
                    style={{ background: color }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="opcion-nombre" style={{ display: "block" }}>
                      {nombre}
                      {etiqueta}
                    </span>
                    <span className="opcion-meta" style={{ display: "block" }}>
                      {meta}
                    </span>
                  </span>
                  {activa && (
                    <span style={{ color, fontWeight: 900, fontSize: 16 }}>
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ESCOGER = cierra la tarjeta y deja dibujada solo esa ruta */}
          <button
            type="button"
            className="btn-principal"
            disabled={!elegida}
            onClick={() => elegida && onEscoger(elegida)}
          >
            Escoger esta ruta →
          </button>
        </>
      )}
    </div>
  );
}

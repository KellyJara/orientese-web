import type { Opcion } from "../lib/planificador";

const NAVY = "#123B94";

type Props = {
  ruta: Opcion;
  minimizado: boolean;
  onMinimizar: () => void;
  onCerrar: () => void;
  /** Caminata real (km) que devolvió Directions; si falta, se usa la estimada. */
  caminataOrigen: number | null;
  caminataDestino: number | null;
  minutosOrigen: number | null;
  minutosDestino: number | null;
};

/** Instrucciones paso a paso de la ruta que el usuario escogió. */
export default function TarjetaPasos({
  ruta,
  minimizado,
  onMinimizar,
  onCerrar,
  caminataOrigen,
  caminataDestino,
  minutosOrigen,
  minutosDestino,
}: Props) {
  const nombre = ruta.transbordo
    ? `${ruta.feature.properties.name} → ${ruta.rutaB.properties.name}`
    : ruta.feature.properties.name;

  return (
    <div className={`tarjeta${minimizado ? " minimizada" : ""}`}>
      <div className="tarjeta-header">
        <div
          className="tarjeta-franja"
          style={{ background: ruta.feature.properties.stroke || NAVY }}
        />
        <button
          type="button"
          className="tarjeta-toggle"
          onClick={onMinimizar}
          title={minimizado ? "Desplegar" : "Plegar"}
        >
          <span className="tarjeta-titulo">{nombre}</span>
          <span className="tarjeta-sub">
            {ruta.transbordo ? "Transbordo en el centro · " : ""}
            {ruta.largo.toFixed(1)} km en bus · ~
            {Math.round((ruta.dOrigen + ruta.dDestino) * 1000)} m a pie
          </span>
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

      {!minimizado && (
        <div className="pasos">
          {/* 1. Caminar hasta la subida */}
          <div className="paso">
            <span className="paso-icono" aria-hidden="true">
              🚶
            </span>
            <span className="paso-texto">
              Camina ~{Math.round((caminataOrigen ?? ruta.dOrigen) * 1000)} m
              {minutosOrigen != null
                ? ` (~${Math.max(1, Math.round(minutosOrigen))} min)`
                : ""}{" "}
              hasta la parada (punto verde “Sube”).
            </span>
          </div>

          {/* 2. Primer bus */}
          <div className="paso">
            <span className="paso-icono" aria-hidden="true">
              🚌
            </span>
            <span className="paso-texto">
              Toma la {ruta.tramos[0].feature.properties.name}
              {ruta.transbordo ? " hasta el centro" : ""} y recorre{" "}
              {ruta.tramos[0].km.toFixed(1)} km.
            </span>
          </div>

          {/* 3 y 4. Transbordo en el centro + segundo bus */}
          {ruta.transbordo && (
            <>
              <div className="paso">
                <span className="paso-icono" aria-hidden="true">
                  🔄
                </span>
                <span className="paso-texto">
                  Bájate en el centro, en el punto más cercano a la siguiente
                  ruta (marcador amarillo “Cambio”)
                  {ruta.transbordo.metros > 0
                    ? ` — camina ~${ruta.transbordo.metros} m hasta ella`
                    : ""}
                  .
                </span>
              </div>
              <div className="paso">
                <span className="paso-icono" aria-hidden="true">
                  🚌
                </span>
                <span className="paso-texto">
                  Toma la {ruta.tramos[1].feature.properties.name} y recorre{" "}
                  {ruta.tramos[1].km.toFixed(1)} km.
                </span>
              </div>
            </>
          )}

          {/* Último. Bajarse y caminar al destino */}
          <div className="paso">
            <span className="paso-icono" aria-hidden="true">
              📍
            </span>
            <span className="paso-texto">
              Bájate (punto rojo “Baja”) y camina ~
              {Math.round((caminataDestino ?? ruta.dDestino) * 1000)} m
              {minutosDestino != null
                ? ` (~${Math.max(1, Math.round(minutosDestino))} min)`
                : ""}{" "}
              hasta tu destino.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

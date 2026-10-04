import { Fragment } from "react";
import { AdvancedMarker, Map } from "@vis.gl/react-google-maps";
import Polilinea from "./Polilinea";
import { aLatLng, dePosicion, type Punto } from "../lib/geo";
import { CENTRO } from "../lib/zona";
import { GOOGLE_MAP_ID } from "../config/google";
import type { Opcion, Plan } from "../lib/planificador";

const COLORES = {
  navy: "#123B94",
  gold: "#F6B71B",
  text: "#16305F",
  verde: "#2E9E5B",
  rojo: "#E23B3B",
};

type Props = {
  rutas: any[];
  rutasDibujadas: string[];
  rutaResaltadaId: string | null;
  plan: Plan | null;
  opcionActiva: Opcion | null;
  taxiElegido: any | null;
  userLocation: Punto | null;
  origenPunto: Punto | null;
  destinoPunto: Punto | null;
  origenEtiqueta: string;
  destinoEtiqueta: string;
  caminoOrigen: Punto[];
  caminoDestino: Punto[];
  caminoTransbordo: Punto[];
  onArrastrarOrigen: (punto: Punto) => void;
  onArrastrarDestino: (punto: Punto) => void;
  onTocarRuta: (feature: any) => void;
};

const aPuntos = (coordinates: number[][]): Punto[] =>
  coordinates.map(dePosicion);

export default function MapaRutas({
  rutas,
  rutasDibujadas,
  rutaResaltadaId,
  plan,
  opcionActiva,
  taxiElegido,
  userLocation,
  origenPunto,
  destinoPunto,
  origenEtiqueta,
  destinoEtiqueta,
  caminoOrigen,
  caminoDestino,
  caminoTransbordo,
  onArrastrarOrigen,
  onArrastrarDestino,
  onTocarRuta,
}: Props) {
  const taxiCoords = taxiElegido
    ? aPuntos(taxiElegido.geometry.coordinates)
    : [];

  // Dentro de un plan de viaje mandan los puntos Sube/Baja; una marca de
  // "Inicio" del recorrido completo además confundiría.
  const enPlan = plan?.tipo === "directa";

  return (
    <Map
      mapId={GOOGLE_MAP_ID}
      style={{ width: "100%", height: "100%" }}
      defaultCenter={aLatLng(CENTRO)}
      defaultZoom={13}
      gestureHandling="greedy"
      disableDefaultUI={false}
      mapTypeControl={false}
      streetViewControl={false}
      fullscreenControl={false}
      clickableIcons={false}
    >
      {/* PUNTO AZUL DE LA UBICACIÓN DEL USUARIO (equivale a showsUserLocation) */}
      {userLocation && (
        <AdvancedMarker
          position={aLatLng(userLocation)}
          title="Tu ubicación"
          zIndex={2}
        >
          <div className="punto-usuario" />
        </AdvancedMarker>
      )}

      {/* ORIGEN — arrastrable, como en el móvil */}
      {origenPunto && (
        <AdvancedMarker
          position={aLatLng(origenPunto)}
          anchorPoint={opcionActiva ? ["50%", "50%"] : ["50%", "100%"]}
          draggable
          zIndex={12}
          title="Arrastra para mover el punto de partida"
          onDragEnd={(e) => {
            if (e.latLng) {
              onArrastrarOrigen({
                latitude: e.latLng.lat(),
                longitude: e.latLng.lng(),
              });
            }
          }}
        >
          {opcionActiva ? (
            <div
              className="marcador-mini"
              style={{ background: COLORES.verde }}
            />
          ) : (
            <div className="marcador-globo">
              <div
                className="marcador-burbuja"
                style={{ borderColor: COLORES.verde }}
              >
                <div
                  className="marcador-etiqueta"
                  style={{ color: COLORES.verde }}
                >
                  ORIGEN
                </div>
                <div className="marcador-texto">
                  {origenEtiqueta || "Punto de partida"}
                </div>
              </div>
              <div
                className="marcador-punta"
                style={{ borderTopColor: COLORES.verde }}
              />
            </div>
          )}
        </AdvancedMarker>
      )}

      {/* DESTINO — arrastrable */}
      {destinoPunto && (
        <AdvancedMarker
          position={aLatLng(destinoPunto)}
          anchorPoint={opcionActiva ? ["50%", "50%"] : ["50%", "100%"]}
          draggable
          zIndex={12}
          title="Arrastra para mover el destino"
          onDragEnd={(e) => {
            if (e.latLng) {
              onArrastrarDestino({
                latitude: e.latLng.lat(),
                longitude: e.latLng.lng(),
              });
            }
          }}
        >
          {opcionActiva ? (
            <div
              className="marcador-mini"
              style={{ background: COLORES.rojo }}
            />
          ) : (
            <div className="marcador-globo">
              <div
                className="marcador-burbuja"
                style={{ borderColor: COLORES.rojo }}
              >
                <div
                  className="marcador-etiqueta"
                  style={{ color: COLORES.rojo }}
                >
                  DESTINO
                </div>
                <div className="marcador-texto">
                  {destinoEtiqueta || "Selecciona un destino"}
                </div>
              </div>
              <div
                className="marcador-punta"
                style={{ borderTopColor: COLORES.rojo }}
              />
            </div>
          )}
        </AdvancedMarker>
      )}

      {/* RUTAS COMPLETAS: solo cuando NO hay opción activa (p. ej. ver una ruta
          desde el desplegable). En el plan se muestra solo el tramo. */}
      {!opcionActiva &&
        rutas.map((feature: any) => {
          if (!rutasDibujadas.includes(String(feature.id))) return null;
          const coordinates = aPuntos(feature.geometry.coordinates);
          const esResaltada = rutaResaltadaId === String(feature.id);
          return (
            <Fragment key={feature.id}>
              <Polilinea
                path={coordinates}
                color={feature.properties.stroke || "red"}
                ancho={esResaltada ? 8 : enPlan ? 3 : 4}
                zIndex={esResaltada ? 10 : 1}
                onClick={() => onTocarRuta(feature)}
              />
              {/* Dónde arranca el recorrido. Solo al ver una ruta suelta. */}
              {!enPlan && coordinates.length > 0 && (
                <AdvancedMarker
                  position={aLatLng(coordinates[0])}
                  anchorPoint={["50%", "50%"]}
                  zIndex={11}
                >
                  <div
                    className="parada-badge"
                    style={{ background: COLORES.verde }}
                  >
                    Inicio
                  </div>
                </AdvancedMarker>
              )}
            </Fragment>
          );
        })}

      {/* TAXI COLECTIVO ELEGIDO: uno solo a la vez. El punto de inicio no es
          un dato decorativo como en los buses: es el paradero, el único sitio
          donde se puede abordar, así que se marca como una instrucción. */}
      {taxiElegido && taxiCoords.length > 1 && (
        <Fragment key={taxiElegido.id}>
          <Polilinea
            path={taxiCoords}
            color={taxiElegido.properties.stroke || COLORES.navy}
            ancho={5}
            zIndex={10}
          />
          <AdvancedMarker
            position={aLatLng(taxiCoords[0])}
            anchorPoint={["50%", "50%"]}
            zIndex={11}
            title="Paradero: aquí se aborda el taxi colectivo"
          >
            <div className="paradero-badge">🚕 Sube aquí</div>
          </AdvancedMarker>
        </Fragment>
      )}

      {/* TRAMO(S) EN BUS DE LA OPCIÓN ACTIVA (1 directa, 2 con transbordo) */}
      {opcionActiva?.tramos.map((t, i) => (
        <Polilinea
          key={`tramo-${i}`}
          path={t.coordinates}
          color={t.feature.properties.stroke || COLORES.navy}
          ancho={8}
          zIndex={10}
        />
      ))}

      {/* TRAMOS A PIE DE LA RUTA ELEGIDA (siguiendo las calles) */}
      {caminoOrigen.length > 1 && (
        <Polilinea
          path={caminoOrigen}
          color={COLORES.text}
          ancho={6}
          zIndex={9}
          punteada
        />
      )}
      {caminoTransbordo.length > 1 && (
        <Polilinea
          path={caminoTransbordo}
          color={COLORES.gold}
          ancho={6}
          zIndex={9}
          punteada
        />
      )}
      {caminoDestino.length > 1 && (
        <Polilinea
          path={caminoDestino}
          color={COLORES.text}
          ancho={6}
          zIndex={9}
          punteada
        />
      )}

      {/* SUBE / CAMBIO / BAJA de la opción activa */}
      {opcionActiva && (
        <>
          <AdvancedMarker
            position={aLatLng(opcionActiva.subida)}
            anchorPoint={["50%", "50%"]}
            zIndex={11}
          >
            <div className="parada-badge" style={{ background: COLORES.verde }}>
              Sube
            </div>
          </AdvancedMarker>

          {opcionActiva.transbordo && (
            <AdvancedMarker
              position={aLatLng(opcionActiva.transbordo.puntoA)}
              anchorPoint={["50%", "50%"]}
              zIndex={11}
            >
              <div
                className="parada-badge"
                style={{ background: COLORES.gold, color: COLORES.navy }}
              >
                Cambio
              </div>
            </AdvancedMarker>
          )}

          <AdvancedMarker
            position={aLatLng(opcionActiva.bajada)}
            anchorPoint={["50%", "50%"]}
            zIndex={11}
          >
            <div className="parada-badge" style={{ background: COLORES.rojo }}>
              Baja
            </div>
          </AdvancedMarker>
        </>
      )}
    </Map>
  );
}

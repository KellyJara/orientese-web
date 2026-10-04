import * as turf from "@turf/turf";
import type { Punto } from "./geo";

// Centro de Rionegro (Parque de la Libertad): hub de transbordos.
export const CENTRO: Punto = { latitude: 6.1531, longitude: -75.3744 };

// Zona de influencia: radio (km) alrededor del centro dentro del cual la app
// tiene rutas cargadas. La ruta más lejana del GeoJSON llega a ~14 km del
// centro, y es el mismo radio con el que se restringe el autocompletado de
// Google, para que lo que se puede buscar y lo que se puede planear coincidan.
export const RADIO_ZONA_KM = 15;

// ¿El punto cae dentro de la zona de influencia de Rionegro?
export const enZonaRionegro = (punto: Punto) =>
  turf.distance(
    turf.point([punto.longitude, punto.latitude]),
    turf.point([CENTRO.longitude, CENTRO.latitude])
  ) <= RADIO_ZONA_KM;

// Rectángulo que envuelve la zona. Google Places lo usa para RESTRINGIR el
// autocompletado (strictBounds), que en web se pide como un LatLngBounds y no
// como centro + radio.
export const limitesZona = (): google.maps.LatLngBoundsLiteral => {
  const caja = turf.bbox(
    turf.circle([CENTRO.longitude, CENTRO.latitude], RADIO_ZONA_KM, {
      units: "kilometers",
    })
  );
  return { west: caja[0], south: caja[1], east: caja[2], north: caja[3] };
};

export type QueEstaFuera = "ubicacion" | "origen" | "destino" | "ambos";

// Texto del aviso de fuera de zona. Vive aquí, junto a la definición de la
// zona, para que el criterio y su explicación no se separen.
export const mensajeFueraDeZona = (que: QueEstaFuera) => {
  const detalle =
    que === "ubicacion"
      ? "Tu ubicación actual está fuera de Rionegro."
      : que === "origen"
      ? "El punto de partida que elegiste está fuera de Rionegro."
      : que === "destino"
      ? "El destino que elegiste está fuera de Rionegro."
      : "El punto de partida y el destino que elegiste están fuera de Rionegro.";
  return {
    titulo: "Fuera de la zona de cobertura",
    texto:
      `${detalle} Oriéntese solo cuenta con las rutas de transporte público ` +
      "de Rionegro y sus alrededores, así que el origen y el destino deben " +
      "estar dentro del municipio para poder encontrar una ruta.",
  };
};

import type { Punto } from "./geo";
import { limitesZona } from "./zona";

// En el navegador no se puede llamar a las APIs REST de Google (Geocoding,
// Places, Directions): responden sin cabeceras CORS y el fetch se bloquea. La
// versión web usa por eso los servicios del SDK de JavaScript, que hacen el
// mismo trabajo que los endpoints REST de la app móvil.

let geocoder: google.maps.Geocoder | null = null;
let autocomplete: google.maps.places.AutocompleteService | null = null;
let lugares: google.maps.places.PlacesService | null = null;
let direcciones: google.maps.DirectionsService | null = null;

// Los servicios se crean una sola vez, y solo después de que el SDK cargó.
export const prepararServicios = () => {
  if (!window.google?.maps) return false;
  geocoder ??= new google.maps.Geocoder();
  autocomplete ??= new google.maps.places.AutocompleteService();
  // PlacesService necesita un nodo del DOM donde pintar la atribución.
  lugares ??= new google.maps.places.PlacesService(
    document.createElement("div")
  );
  direcciones ??= new google.maps.DirectionsService();
  return true;
};

export type Lugar = { punto: Punto; direccion: string };

//---------------------------------------------------- GEOCODIFICAR TEXTO
// Convierte un texto de dirección en coordenadas. Se le añade el municipio,
// igual que en la app móvil, para que "Parque principal" no acabe en otra
// ciudad; y se acota a la zona para desempatar nombres repetidos.
export const geocodificar = async (texto: string): Promise<Lugar | null> => {
  if (!prepararServicios() || !geocoder) return null;
  try {
    const { results } = await geocoder.geocode({
      address: `${texto}, Rionegro, Antioquia, Colombia`,
      bounds: limitesZona(),
      region: "co",
    });
    if (!results.length) return null;
    const loc = results[0].geometry.location;
    return {
      punto: { latitude: loc.lat(), longitude: loc.lng() },
      direccion: results[0].formatted_address,
    };
  } catch (e) {
    console.log("Error geocodificar:", e);
    return null;
  }
};

//---------------------------------------------------- GEOCODIFICAR COORDENADAS
// Para cuando el usuario arrastra un marcador: coordenada → dirección legible.
export const direccionDeCoordenadas = async (
  punto: Punto
): Promise<string | null> => {
  if (!prepararServicios() || !geocoder) return null;
  try {
    const { results } = await geocoder.geocode({
      location: { lat: punto.latitude, lng: punto.longitude },
    });
    return results.length ? results[0].formatted_address : null;
  } catch (e) {
    console.log("Error geocodificar inverso:", e);
    return null;
  }
};

//---------------------------------------------------- AUTOCOMPLETAR
export type Sugerencia = { placeId: string; texto: string };

// RESTRINGE los resultados a la zona de Rionegro (no solo los sesga): sin
// `locationRestriction` Google devolvería lugares de todo el país y el usuario
// podría elegir uno que después no se puede planear.
export const sugerenciasDeLugar = async (
  texto: string,
  sesion?: google.maps.places.AutocompleteSessionToken
): Promise<Sugerencia[]> => {
  if (!prepararServicios() || !autocomplete || texto.trim().length < 2) {
    return [];
  }
  try {
    const res = await autocomplete.getPlacePredictions({
      input: texto,
      language: "es",
      componentRestrictions: { country: "co" },
      // Sin "types": incluye direcciones Y sitios (hospital, parque, etc.).
      locationRestriction: limitesZona(),
      sessionToken: sesion,
    });
    return res.predictions.map((p) => ({
      placeId: p.place_id,
      texto: p.description,
    }));
  } catch {
    // ZERO_RESULTS llega como rechazo; una lista vacía es la respuesta correcta.
    return [];
  }
};

export const detalleDeLugar = (
  placeId: string,
  sesion?: google.maps.places.AutocompleteSessionToken
): Promise<Lugar | null> =>
  new Promise((resolve) => {
    if (!prepararServicios() || !lugares) return resolve(null);
    lugares.getDetails(
      {
        placeId,
        fields: ["formatted_address", "geometry", "name"],
        sessionToken: sesion,
      },
      (lugar, estado) => {
        if (
          estado !== google.maps.places.PlacesServiceStatus.OK ||
          !lugar?.geometry?.location
        ) {
          return resolve(null);
        }
        resolve({
          punto: {
            latitude: lugar.geometry.location.lat(),
            longitude: lugar.geometry.location.lng(),
          },
          direccion: lugar.formatted_address ?? lugar.name ?? "",
        });
      }
    );
  });

//---------------------------------------------------- TRAZADO A PIE
export type Caminata = {
  coords: Punto[];
  distanciaKm: number;
  minutos: number;
};

// Recorrido peatonal real entre dos puntos, siguiendo las calles. El SDK ya
// devuelve el trazado decodificado en `overview_path`, así que aquí no hace
// falta el decodificador de polilíneas que sí necesita la versión móvil.
export const obtenerCaminata = async (
  desde: Punto,
  hasta: Punto
): Promise<Caminata | null> => {
  if (!prepararServicios() || !direcciones) return null;
  try {
    const res = await direcciones.route({
      origin: { lat: desde.latitude, lng: desde.longitude },
      destination: { lat: hasta.latitude, lng: hasta.longitude },
      travelMode: google.maps.TravelMode.WALKING,
      language: "es",
    });
    const ruta = res.routes[0];
    const leg = ruta?.legs[0];
    if (!ruta || !leg) return null;
    return {
      coords: ruta.overview_path.map((p) => ({
        latitude: p.lat(),
        longitude: p.lng(),
      })),
      distanciaKm: (leg.distance?.value ?? 0) / 1000, // metros → km
      minutos: (leg.duration?.value ?? 0) / 60, // segundos → min
    };
  } catch (e) {
    console.log("Error Directions:", e);
    return null;
  }
};

import * as turf from "@turf/turf";
import { CENTRO } from "./zona";
import type { Punto } from "./geo";

export type Tramo = {
  feature: any;
  coordinates: Punto[];
  km: number;
};

export type Opcion = {
  id: string;
  feature: any;
  rutaB?: any;
  dOrigen: number;
  dDestino: number;
  total: number;
  largo: number;
  subida: Punto;
  bajada: Punto;
  tramos: Tramo[];
  transferMetros?: number;
  transbordo: { puntoA: Punto; puntoB: Punto; metros: number } | null;
};

export type TipoPlan = "directa" | "transbordo" | "cercana-destino" | "sin-ruta";

export type Plan = {
  tipo: TipoPlan;
  opciones: Opcion[];
  mensaje: string;
};

//---------------------------------------------------- PLANIFICACIÓN DE VIAJE
// 1º rutas directas (cerca de origen Y destino).
// 2º si no hay: transbordo EN EL CENTRO (buseta origen→centro + buseta centro→destino).
// 3º rutas que pasen cerca del destino (subida en el punto más cercano al origen).
export const planificarViaje = (
  routes: any[],
  origen: Punto,
  destino: Punto
): Plan => {
  const pOrigen = turf.point([origen.longitude, origen.latitude]);
  const pDestino = turf.point([destino.longitude, destino.latitude]);
  const pCentro = turf.point([CENTRO.longitude, CENTRO.latitude]);
  const UMBRAL = 0.5; // km máximos entre el punto y la ruta
  const UMBRAL_CENTRO = 0.7; // km: qué tan cerca del centro debe pasar la ruta

  const coord = (snap: any): Punto => {
    const [lng, lat] = snap.geometry.coordinates;
    return { latitude: lat, longitude: lng };
  };
  const aCoords = (linea: any): Punto[] =>
    linea.geometry.coordinates.map(([lng, lat]: any) => ({
      latitude: lat,
      longitude: lng,
    }));

  const directas: Opcion[] = [];
  const cercanasDestino: Opcion[] = [];
  const legOrigen: any[] = []; // rutas origen → centro
  const legDestino: any[] = []; // rutas centro → destino

  for (const feature of routes) {
    const line = turf.lineString(feature.geometry.coordinates);
    const snapO = turf.nearestPointOnLine(line, pOrigen);
    const snapD = turf.nearestPointOnLine(line, pDestino);
    const snapC = turf.nearestPointOnLine(line, pCentro);
    const dOrigen = snapO.properties.dist as number;
    const dDestino = snapD.properties.dist as number;
    const dCentro = snapC.properties.dist as number;
    const locO = snapO.properties.location ?? 0;
    const locD = snapD.properties.location ?? 0;
    const locC = snapC.properties.location ?? 0;

    // Directa / cercana-destino (sentido O→D).
    if (dDestino <= UMBRAL && locO < locD) {
      const tramo = turf.lineSlice(snapO, snapD, line);
      const opcion: Opcion = {
        id: String(feature.id),
        feature,
        dOrigen,
        dDestino,
        total: dOrigen + dDestino,
        largo: turf.length(tramo),
        subida: coord(snapO),
        bajada: coord(snapD),
        tramos: [
          { feature, coordinates: aCoords(tramo), km: turf.length(tramo) },
        ],
        transbordo: null,
      };
      if (dOrigen <= UMBRAL) directas.push(opcion);
      else cercanasDestino.push(opcion);
    }

    // Tramo 1: pasa cerca del origen y del centro, en sentido origen → centro.
    if (dOrigen <= UMBRAL && dCentro <= UMBRAL_CENTRO && locO < locC) {
      legOrigen.push({ feature, line, snapO, snapC, dOrigen, dCentro, locO });
    }
    // Tramo 2: pasa cerca del centro y del destino, en sentido centro → destino.
    if (dCentro <= UMBRAL_CENTRO && dDestino <= UMBRAL && locC < locD) {
      legDestino.push({ feature, line, snapC, snapD, dCentro, dDestino, locD });
    }
  }

  if (directas.length > 0) {
    directas.sort((a, b) => a.total - b.total || a.largo - b.largo);
    return {
      tipo: "directa",
      opciones: directas,
      mensaje:
        directas.length === 1
          ? `Toma la ${directas[0].feature.properties.name}, te lleva directo.`
          : `Hay ${directas.length} rutas directas. Elige una opción.`,
    };
  }

  // ---- TRANSBORDO EN EL CENTRO: buseta origen→centro + buseta centro→destino ----
  // Muchas rutas pasan por el centro; limitamos candidatos para no congelar el hilo.
  legOrigen.sort((a, b) => a.dOrigen - b.dOrigen);
  legDestino.sort((a, b) => a.dDestino - b.dDestino);
  const origenK = legOrigen.slice(0, 8);
  const destinoK = legDestino.slice(0, 8);

  const transbordos: Opcion[] = [];
  for (const A of origenK) {
    for (const B of destinoK) {
      if (A.feature.id === B.feature.id) continue;

      // Punto de A más cercano a la ruta B, por la zona del centro (aprox. eficiente):
      // proyecta el punto-centro de B sobre A (bajada), y ese sobre B (subida).
      let pA = turf.nearestPointOnLine(A.line, B.snapC);
      let pB = turf.nearestPointOnLine(B.line, pA);
      let locA = pA.properties.location ?? 0;
      let locB = pB.properties.location ?? 0;

      // Sentido: bajas de A después de subir; subes a B antes de bajar al destino.
      if (!(A.locO < locA && locB < B.locD)) {
        // Respaldo: proyecciones del centro sobre cada ruta.
        pA = A.snapC;
        pB = B.snapC;
        locA = pA.properties.location ?? 0;
        locB = pB.properties.location ?? 0;
        if (!(A.locO < locA && locB < B.locD)) continue;
      }

      // El transbordo debe quedar en la zona del centro.
      if (turf.distance(pA, pCentro) > UMBRAL_CENTRO * 1.5) continue;

      const tramoA = turf.lineSlice(A.snapO, pA, A.line);
      const tramoB = turf.lineSlice(pB, B.snapD, B.line);
      const bajarA = coord(pA); // te bajas de A (punto más cercano a B)
      const subirB = coord(pB); // tomas B
      const transferKm = turf.distance(
        turf.point([bajarA.longitude, bajarA.latitude]),
        turf.point([subirB.longitude, subirB.latitude])
      );

      transbordos.push({
        id: `${A.feature.id}>${B.feature.id}`,
        feature: A.feature,
        rutaB: B.feature,
        dOrigen: A.dOrigen,
        dDestino: B.dDestino,
        transferMetros: Math.round(transferKm * 1000),
        total: A.dOrigen + B.dDestino + transferKm,
        largo: turf.length(tramoA) + turf.length(tramoB),
        subida: coord(A.snapO),
        bajada: coord(B.snapD),
        tramos: [
          {
            feature: A.feature,
            coordinates: aCoords(tramoA),
            km: turf.length(tramoA),
          },
          {
            feature: B.feature,
            coordinates: aCoords(tramoB),
            km: turf.length(tramoB),
          },
        ],
        transbordo: {
          puntoA: bajarA,
          puntoB: subirB,
          metros: Math.round(transferKm * 1000),
        },
      });
    }
  }

  // Opciones de UN solo bus caminando hasta la parada, si queda caminable.
  const CAMINABLE = 1.5; // km máximos a pie hasta la subida para ofrecerla
  const caminables = cercanasDestino.filter((o) => o.dOrigen <= CAMINABLE);

  // Si hay transbordos o alternativas caminables, se ofrecen juntas.
  if (transbordos.length > 0 || caminables.length > 0) {
    const opciones = [...transbordos, ...caminables].sort((a, b) => {
      // Primero las de UN SOLO BUS (sin transbordo), luego las de transbordo.
      const simpleA = a.transbordo ? 1 : 0;
      const simpleB = b.transbordo ? 1 : 0;
      if (simpleA !== simpleB) return simpleA - simpleB;
      // Dentro de cada grupo: menos caminata total, luego recorrido más corto.
      return a.total - b.total || a.largo - b.largo;
    });
    return {
      tipo: "transbordo",
      opciones: opciones.slice(0, 12),
      mensaje: caminables.length
        ? "No hay ruta directa. Puedes hacer transbordo en el centro, o " +
          "caminar hasta la parada y tomar un solo bus."
        : "No hay ruta directa. Toma una buseta hasta el centro y allí " +
          "cambia a otra que va a tu destino.",
    };
  }

  // Fallback: rutas que dejan en el destino aunque la subida quede lejos a pie.
  if (cercanasDestino.length > 0) {
    cercanasDestino.sort((a, b) => a.dOrigen - b.dOrigen);
    return {
      tipo: "cercana-destino",
      opciones: cercanasDestino,
      mensaje:
        "No hay ruta directa. Estas rutas te dejan en tu destino; " +
        "tendrás que caminar hasta el punto de subida más cercano.",
    };
  }

  return {
    tipo: "sin-ruta",
    opciones: [],
    mensaje: "No hay ninguna ruta que llegue a tu destino.",
  };
};

// Al elegir una ruta lo que le sirve al usuario es saber POR DÓNDE EMPIEZA, no
// ver el trazado completo (una ruta de 20 km encuadrada entera queda tan lejos
// que no se distinguen las calles). Devuelve solo el primer tramo del recorrido.
const KM_INICIO = 0.6;

export const tramoDeInicio = (feature: any): Punto[] => {
  const coords = feature.geometry.coordinates;
  if (coords.length < 2) return [];
  const linea = turf.lineString(coords);
  const tramo = turf.lineSliceAlong(
    linea,
    0,
    Math.min(KM_INICIO, turf.length(linea))
  );
  return tramo.geometry.coordinates.map(([lng, lat]: any) => ({
    latitude: lat,
    longitude: lng,
  }));
};

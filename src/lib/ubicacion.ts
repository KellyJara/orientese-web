import type { Punto } from "./geo";

// Obtener la ubicación en el navegador falla por más motivos que en el móvil, y
// casi todos son arreglables por el usuario si se le dice cuál es. Este módulo
// los separa para poder explicarlos, en vez de dejar el campo de origen vacío
// sin ninguna razón visible.

export type MotivoFallo =
  | "no-soportado"
  | "sin-https"
  | "denegado"
  | "no-disponible"
  | "tiempo-agotado";

export type ResultadoUbicacion =
  | { ok: true; punto: Punto }
  | { ok: false; motivo: MotivoFallo };

const motivoDelError = (error: GeolocationPositionError): MotivoFallo => {
  if (error.code === error.PERMISSION_DENIED) return "denegado";
  if (error.code === error.TIMEOUT) return "tiempo-agotado";
  return "no-disponible";
};

const intentar = (opciones: PositionOptions) =>
  new Promise<GeolocationPosition | GeolocationPositionError>((resolve) => {
    navigator.geolocation.getCurrentPosition(resolve, resolve, opciones);
  });

const esError = (
  r: GeolocationPosition | GeolocationPositionError
): r is GeolocationPositionError => "code" in r;

/**
 * Pide la ubicación con dos intentos: primero con precisión alta (GPS del
 * teléfono) y, si el dispositivo no la puede dar, otro sin ella. Ese segundo
 * intento es el que resuelve el caso más común en escritorio: un computador sin
 * GPS falla con precisión alta pero sí se ubica por red.
 *
 * No se reintenta cuando el permiso está denegado: sería pedirlo dos veces para
 * recibir el mismo "no".
 */
export const pedirUbicacion = async (): Promise<ResultadoUbicacion> => {
  if (!navigator.geolocation) return { ok: false, motivo: "no-soportado" };

  // Los navegadores solo entregan la ubicación en https o en localhost. Por una
  // IP de la red local el permiso ni siquiera se pregunta.
  if (!window.isSecureContext) return { ok: false, motivo: "sin-https" };

  const alta = await intentar({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 10000,
  });
  if (!esError(alta)) {
    return {
      ok: true,
      punto: {
        latitude: alta.coords.latitude,
        longitude: alta.coords.longitude,
      },
    };
  }

  const motivo = motivoDelError(alta);
  if (motivo === "denegado") {
    console.log("Ubicación denegada:", alta.message);
    return { ok: false, motivo };
  }

  console.log(
    `Ubicación con precisión alta falló (código ${alta.code}: ${alta.message}). Reintentando sin precisión alta…`
  );

  const baja = await intentar({
    enableHighAccuracy: false,
    timeout: 20000,
    maximumAge: 60000,
  });
  if (!esError(baja)) {
    return {
      ok: true,
      punto: {
        latitude: baja.coords.latitude,
        longitude: baja.coords.longitude,
      },
    };
  }

  console.log(`Ubicación no disponible (código ${baja.code}: ${baja.message})`);
  return { ok: false, motivo: motivoDelError(baja) };
};

/** Estado del permiso, cuando el navegador lo expone (no todos lo hacen). */
export const permisoDeUbicacion = async (): Promise<
  PermissionState | "desconocido"
> => {
  try {
    const estado = await navigator.permissions?.query({
      name: "geolocation" as PermissionName,
    });
    return estado?.state ?? "desconocido";
  } catch {
    return "desconocido";
  }
};

const CIERRE = "Mientras tanto, escribe la dirección desde la que sales.";

/** Explicación de cada fallo, con lo que el usuario puede hacer al respecto. */
export const explicacionDelFallo = (motivo: MotivoFallo) => {
  switch (motivo) {
    case "no-soportado":
      return {
        titulo: "Este navegador no comparte la ubicación",
        texto: `No pudimos pedirle tu ubicación al navegador. ${CIERRE}`,
      };
    case "sin-https":
      return {
        titulo: "La página no es segura",
        texto:
          "Los navegadores solo entregan la ubicación en páginas con https o " +
          `en localhost, y esta se abrió como ${window.location.origin}. ` +
          `Ábrela en localhost o publícala con https. ${CIERRE}`,
      };
    case "denegado":
      return {
        titulo: "El navegador bloqueó la ubicación",
        texto:
          "Esta página tiene denegado el acceso a la ubicación. Puedes " +
          "permitirlo desde el icono que aparece a la izquierda de la " +
          `dirección, y volver a intentarlo. ${CIERRE}`,
      };
    case "no-disponible":
      return {
        titulo: "No pudimos ubicarte",
        texto:
          "El dispositivo no logró determinar dónde estás. Si es un " +
          "computador, revisa que la ubicación esté activada en el sistema " +
          "(en Windows: Configuración → Privacidad y seguridad → Ubicación). " +
          CIERRE,
      };
    case "tiempo-agotado":
      return {
        titulo: "La ubicación tardó demasiado",
        texto:
          "No llegó una respuesta a tiempo. Vuelve a intentarlo, o sal a un " +
          `sitio con mejor señal si estás en el teléfono. ${CIERRE}`,
      };
  }
};

/** Versión corta, para el aviso que queda fijo junto al campo de origen. */
export const resumenDelFallo = (motivo: MotivoFallo) => {
  switch (motivo) {
    case "no-soportado":
      return "Este navegador no comparte tu ubicación.";
    case "sin-https":
      return "La ubicación solo funciona en https o localhost.";
    case "denegado":
      return "Bloqueaste la ubicación para esta página.";
    case "no-disponible":
      return "El dispositivo no pudo determinar dónde estás.";
    case "tiempo-agotado":
      return "La ubicación tardó demasiado en responder.";
  }
};

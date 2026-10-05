import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMap } from "@vis.gl/react-google-maps";

import MapaRutas from "../components/MapaRutas";
import BuscadorLugar, {
  ETIQUETA_MI_UBICACION,
} from "../components/BuscadorLugar";
import Avisos from "../components/Avisos";
import TarjetaPlan from "../components/TarjetaPlan";
import TarjetaPasos from "../components/TarjetaPasos";
import MenuLateral, { type Pagina } from "../components/MenuLateral";
import Dialogo, { type Mensaje } from "../components/Dialogo";

import { CENTRO, enZonaRionegro, mensajeFueraDeZona } from "../lib/zona";
import { horarioDeRed } from "../lib/horario";
import {
  planificarViaje,
  tramoDeInicio,
  type Opcion,
  type Plan,
} from "../lib/planificador";
import {
  direccionDeCoordenadas,
  geocodificar,
  obtenerCaminata,
  type Lugar,
} from "../lib/googleServices";
import { encuadrar, irAlPunto, type Punto } from "../lib/geo";
import {
  explicacionDelFallo,
  pedirUbicacion,
  resumenDelFallo,
  type MotivoFallo,
} from "../lib/ubicacion";

const COLORS = { navy: "#123B94", muted: "#98A4BD" };

const TITULO_PAGINA: Record<Pagina, string> = {
  viaje: "PLANEA TU VIAJE",
  ver: "VER RUTAS EN EL MAPA",
  taxis: "TAXIS COLECTIVOS",
};

type Props = {
  /** Recorridos de bus (solo las líneas del GeoJSON). */
  rutas: any[];
  /** Recorridos de taxi colectivo. */
  taxis: any[];
};

export default function MapScreen({ rutas: routes, taxis: rutasDeTaxi }: Props) {
  const map = useMap();

  const [routeSearch, setRouteSearch] = useState("");
  const [destination, setDestination] = useState("");
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);
  const [rutaDropdownOpen, setRutaDropdownOpen] = useState(false);
  // Ruta que el usuario tocó en el mapa: se muestra su ficha abajo.
  const [rutaTocada, setRutaTocada] = useState<any | null>(null);
  const [userLocation, setUserLocation] = useState<Punto | null>(null);
  const [destinationLocation, setDestinationLocation] = useState<Punto | null>(
    null
  );
  // Arranca vacío a propósito: si el permiso de ubicación no se concede, el
  // campo no puede quedar diciendo "Mi ubicación" como si hubiera un origen.
  const [origin, setOrigin] = useState("");
  const [originLocation, setOriginLocation] = useState<Punto | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [selectedTripRouteId, setSelectedTripRouteId] = useState<string | null>(
    null
  );
  const [rutaElegida, setRutaElegida] = useState<Opcion | null>(null);
  // Distancia (km) y duración (min) reales caminando que devuelve Directions
  const [caminataOrigen, setCaminataOrigen] = useState<number | null>(null);
  const [caminataDestino, setCaminataDestino] = useState<number | null>(null);
  const [minutosOrigen, setMinutosOrigen] = useState<number | null>(null);
  const [minutosDestino, setMinutosDestino] = useState<number | null>(null);
  // Coordenadas del trazado peatonal (siguiendo las calles)
  const [caminoOrigen, setCaminoOrigen] = useState<Punto[]>([]);
  const [caminoDestino, setCaminoDestino] = useState<Punto[]>([]);
  const [caminoTransbordo, setCaminoTransbordo] = useState<Punto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [mensajeCarga, setMensajeCarga] = useState("Calculando tu ruta…");
  const [modalMinimizado, setModalMinimizado] = useState(false);
  // Menú lateral y página activa
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [pagina, setPagina] = useState<Pagina>("viaje");
  // Taxis colectivos: se muestra un solo recorrido a la vez, el que se elija.
  const [taxiSeleccionado, setTaxiSeleccionado] = useState<string | null>(null);
  const [taxiDropdownOpen, setTaxiDropdownOpen] = useState(false);
  const [taxiSearch, setTaxiSearch] = useState("");
  // ¿El punto ya está confirmado (Enter/sugerencia/GPS) para el texto actual?
  const [origenListo, setOrigenListo] = useState(false);
  const [destinoListo, setDestinoListo] = useState(false);
  // Texto de los globos de origen/destino. Va aparte de `origin`/`destination`
  // (que siguen cada tecla del input) y solo se actualiza cuando el punto queda
  // confirmado, para que el globo describa siempre el lugar donde está clavado
  // el pin y no lo que el usuario va escribiendo.
  const [origenEtiqueta, setOrigenEtiqueta] = useState("");
  const [destinoEtiqueta, setDestinoEtiqueta] = useState("");
  // En el celular el buscador se pliega a una línea al encontrar rutas, para
  // dejarle la pantalla al mapa. En escritorio el CSS lo ignora.
  const [buscadorPlegado, setBuscadorPlegado] = useState(false);
  // El navegador ubicó al usuario fuera de Rionegro: se avisa de forma
  // permanente, porque sin un origen dentro del municipio no hay ruta.
  const [ubicacionFueraDeZona, setUbicacionFueraDeZona] = useState(false);
  const [dialogo, setDialogo] = useState<Mensaje | null>(null);
  // Por qué no tenemos la ubicación. Se guarda para explicarlo junto al campo
  // de origen: si el intento del arranque falla en silencio, el usuario se
  // queda mirando un campo vacío sin saber qué pasó.
  const [falloUbicacion, setFalloUbicacion] = useState<MotivoFallo | null>(null);
  const [buscandoUbicacion, setBuscandoUbicacion] = useState(false);

  //-------------------------------------------------- HORARIO DE SERVICIO
  // Reloj propio: el aviso tiene que aparecer y desaparecer solo al cruzar la
  // hora de cierre o de apertura, sin recargar la página.
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const horario = useMemo(() => horarioDeRed(routes), [routes]);

  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const fueraDeServicio =
    horario != null &&
    (minutosAhora < horario.inicio || minutosAhora >= horario.fin);

  //-------------------------------------------------- CONEXIÓN A INTERNET
  // Buscar rutas depende de las APIs de Google. En el navegador no se puede
  // comprobar la salida a internet con un fetch a un dominio ajeno (lo bloquea
  // CORS), así que se usa el estado de conexión que reporta el propio
  // navegador, que es la señal fiable que hay en la plataforma.
  const [hayInternet, setHayInternet] = useState(navigator.onLine);
  useEffect(() => {
    const conectado = () => setHayInternet(true);
    const desconectado = () => setHayInternet(false);
    window.addEventListener("online", conectado);
    window.addEventListener("offline", desconectado);
    return () => {
      window.removeEventListener("online", conectado);
      window.removeEventListener("offline", desconectado);
    };
  }, []);

  //---------------------------------------------------- AVISOS
  // La app solo conoce las rutas de Rionegro y sus alrededores: fuera de esa
  // zona no hay nada que trazar, y hay que decirlo con claridad en vez de
  // devolver una búsqueda vacía.
  const avisarFueraDeZona = useCallback(
    (que: "ubicacion" | "origen" | "destino" | "ambos" = "ubicacion") => {
      setDialogo(mensajeFueraDeZona(que));
    },
    []
  );

  //---------------------------------------------------- UBICACIÓN DEL USUARIO
  // `conDialogo`: el usuario la pidió expresamente, así que el fallo merece un
  // diálogo. En el intento automático del arranque basta con el aviso fijo que
  // queda junto al campo de origen.
  const tomarUbicacion = useCallback(
    async (alTenerla: (punto: Punto) => void, conDialogo: boolean) => {
      setBuscandoUbicacion(true);
      setMensajeCarga("Obteniendo tu ubicación…");
      setCargando(true);
      const res = await pedirUbicacion();
      setCargando(false);
      setBuscandoUbicacion(false);

      if (res.ok) {
        setFalloUbicacion(null);
        alTenerla(res.punto);
        return;
      }

      setFalloUbicacion(res.motivo);
      if (conDialogo) setDialogo(explicacionDelFallo(res.motivo));
    },
    []
  );

  // Coloca la ubicación como origen, o avisa si cae fuera de la zona.
  const ponerUbicacionComoOrigen = useCallback(
    (location: Punto, moverCamara: boolean) => {
      setUserLocation(location);
      // Fuera de Rionegro la ubicación no sirve como origen: se deja el campo
      // vacío para que el usuario escriba una dirección del municipio.
      if (!enZonaRionegro(location)) {
        setUbicacionFueraDeZona(true);
        avisarFueraDeZona("ubicacion");
        return;
      }
      setUbicacionFueraDeZona(false);
      setOrigin(ETIQUETA_MI_UBICACION);
      setOrigenEtiqueta(ETIQUETA_MI_UBICACION);
      setOriginLocation(location);
      setOrigenListo(true);
      if (moverCamara) irAlPunto(map, location);
    },
    [avisarFueraDeZona, map]
  );

  //---------------------------------------------------- UBICACIÓN INICIAL
  // Se pide al abrir, igual que en la app móvil: si el usuario la concede, el
  // origen queda listo sin escribir nada. Si la rechaza, el campo se queda
  // vacío y no se insiste (el rechazo acaba de ocurrir y fue voluntario).
  const yaPedida = useRef(false);
  useEffect(() => {
    if (yaPedida.current) return;
    yaPedida.current = true;
    tomarUbicacion(
      (location) => ponerUbicacionComoOrigen(location, false),
      false
    );
  }, [tomarUbicacion, ponerUbicacionComoOrigen]);

  //---------------------------------------------------- USAR MI UBICACIÓN
  const usarMiUbicacion = () => {
    // Si ya la tenemos, se usa al instante (sin esperar al navegador).
    if (userLocation) {
      if (!enZonaRionegro(userLocation)) {
        setUbicacionFueraDeZona(true);
        avisarFueraDeZona("ubicacion");
        return;
      }
      setOrigin(ETIQUETA_MI_UBICACION);
      setOrigenEtiqueta(ETIQUETA_MI_UBICACION);
      // Objeto nuevo para forzar la actualización aunque sea la misma coordenada.
      setOriginLocation({ ...userLocation });
      setOrigenListo(true);
      irAlPunto(map, userLocation);
      return;
    }
    tomarUbicacion((location) => ponerUbicacionComoOrigen(location, true), true);
  };

  //---------------------------------------------------- ELEGIR UN LUGAR
  const fijarLugar = (
    tipo: "origin" | "destination",
    lugar: Lugar,
    textoVisible?: string
  ) => {
    const etiqueta = textoVisible ?? lugar.direccion;
    if (tipo === "origin") {
      setOriginLocation(lugar.punto);
      setOrigin(etiqueta);
      setOrigenEtiqueta(etiqueta);
      setOrigenListo(true);
    } else {
      setDestinationLocation(lugar.punto);
      setDestination(etiqueta);
      setDestinoEtiqueta(etiqueta);
      setDestinoListo(true);
    }
    irAlPunto(map, lugar.punto);
  };

  // Enter en el campo: se geocodifica el texto tal cual.
  const searchAddress = async (texto: string, tipo: "origin" | "destination") => {
    if (!texto.trim()) return;
    setMensajeCarga("Ubicando el punto…");
    setCargando(true);
    const lugar = await geocodificar(texto);
    setCargando(false);
    if (lugar) fijarLugar(tipo, lugar);
  };

  //---------------------------------------------------- ARRASTRE DE MARCADORES
  const alArrastrar = async (tipo: "origin" | "destination", punto: Punto) => {
    setMensajeCarga("Ubicando el punto…");
    setCargando(true);
    if (tipo === "origin") {
      setOrigenListo(true);
      setOrigenEtiqueta("Ubicando dirección…");
      setOriginLocation(punto);
    } else {
      setDestinoListo(true);
      setDestinoEtiqueta("Ubicando dirección…");
      setDestinationLocation(punto);
    }
    const direccion = await direccionDeCoordenadas(punto);
    setCargando(false);
    const etiqueta = direccion ?? "Punto sobre el mapa";
    if (tipo === "origin") {
      setOrigenEtiqueta(etiqueta);
      if (direccion) setOrigin(direccion);
    } else {
      setDestinoEtiqueta(etiqueta);
      if (direccion) setDestination(direccion);
    }
  };

  //---------------------------------------------------- BUSCAR RUTA
  const buscarRuta = async () => {
    // Necesita texto en ambos campos.
    if (!origin.trim() || !destination.trim()) return;

    setMensajeCarga("Calculando tu ruta…");
    setCargando(true);
    setRutaElegida(null);
    setModalMinimizado(false);
    setCaminataOrigen(null);
    setCaminataDestino(null);
    setMinutosOrigen(null);
    setMinutosDestino(null);
    setCaminoOrigen([]);
    setCaminoDestino([]);
    setCaminoTransbordo([]);

    // Resuelve origen: si no está confirmado (el usuario escribió sin dar
    // Enter), se geocodifica el texto ahora.
    let oLoc = originLocation;
    if (!origenListo) {
      const g = await geocodificar(origin);
      if (g) {
        oLoc = g.punto;
        setOriginLocation(g.punto);
        setOrigin(g.direccion);
        setOrigenEtiqueta(g.direccion);
        setOrigenListo(true);
      } else {
        oLoc = null;
      }
    }

    // Resuelve destino de la misma forma.
    let dLoc = destinationLocation;
    if (!destinoListo) {
      const g = await geocodificar(destination);
      if (g) {
        dLoc = g.punto;
        setDestinationLocation(g.punto);
        setDestination(g.direccion);
        setDestinoEtiqueta(g.direccion);
        setDestinoListo(true);
      } else {
        dLoc = null;
      }
    }

    if (!oLoc || !dLoc) {
      setCargando(false);
      setDialogo({
        titulo: "No encontramos ese lugar",
        texto:
          "No pudimos ubicar el origen o el destino que escribiste. Revisa la " +
          "dirección o elige una de las sugerencias de la lista.",
      });
      return;
    }

    // Aunque el autocompletado restringe los resultados, el usuario puede
    // escribir a mano o traer su ubicación de fuera: se comprueba antes de
    // calcular, para explicar el porqué en vez de devolver "sin ruta".
    const origenFuera = !enZonaRionegro(oLoc);
    const destinoFuera = !enZonaRionegro(dLoc);
    if (origenFuera || destinoFuera) {
      setCargando(false);
      avisarFueraDeZona(
        origenFuera && destinoFuera
          ? "ambos"
          : origenFuera
          ? "origen"
          : "destino"
      );
      return;
    }

    // Cede un frame para que el indicador de carga se pinte antes del cálculo,
    // que es síncrono y pesado.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const nuevoPlan = planificarViaje(routes, oLoc, dLoc);
    setPlan(nuevoPlan);

    if (nuevoPlan.opciones.length > 0) {
      const primera = nuevoPlan.opciones[0];
      if (nuevoPlan.tipo === "transbordo") {
        setSelectedRoutes(
          primera.transbordo
            ? [String(primera.feature.id), String(primera.rutaB.id)]
            : [String(primera.feature.id)]
        );
      } else {
        setSelectedRoutes(nuevoPlan.opciones.map((o) => String(o.feature.id)));
      }
      setSelectedTripRouteId(primera.id);
      setBuscadorPlegado(true);
      // Encuadra la zona origen–destino para explorar las opciones en el mapa.
      encuadrar(map, [oLoc, dLoc]);
    } else {
      setSelectedTripRouteId(null);
    }
    setCargando(false);
  };

  //---------------------------------------------------- AL CAMBIAR ORIGEN/DESTINO
  // Solo se colocan los marcadores; NO se busca ruta (eso lo hace el botón).
  // Se limpia cualquier plan/ruta anterior para que no quede desactualizada.
  useEffect(() => {
    setPlan(null);
    setRutaElegida(null);
    setSelectedTripRouteId(null);
  }, [originLocation, destinationLocation]);

  // Opción "activa" en el mapa: la elegida, o la resaltada mientras se exploran
  // las opciones. Con ella se dibuja SOLO el tramo subida→bajada + la caminata.
  const opcionActiva =
    rutaElegida ??
    plan?.opciones.find((o) => o.id === selectedTripRouteId) ??
    null;

  //---------------------------------------------------- ZOOM AL ARRANQUE
  // Al escoger una ruta la cámara se acerca a donde empieza: la parada
  // (punto verde "Sube").
  const encuadrarArranque = useCallback(
    (op: Opcion) => irAlPunto(map, op.subida, 17),
    [map]
  );

  //---------------------------------------------------- TRAZADO A PIE
  // Traza los tramos a pie (origen→subida, transbordo, bajada→destino) de la
  // opción activa y encuadra ese tramo en el mapa.
  useEffect(() => {
    if (!opcionActiva || !originLocation || !destinationLocation) {
      setCaminoOrigen([]);
      setCaminoDestino([]);
      setCaminoTransbordo([]);
      return;
    }

    const op = opcionActiva;
    let activo = true;
    // Indicador de carga solo cuando es la ruta ya elegida (al explorar las
    // opciones no interrumpimos).
    const conLoader = !!rutaElegida;
    if (conLoader) {
      setMensajeCarga("Trazando el recorrido…");
      setCargando(true);
    }

    const transbordo = op.transbordo
      ? obtenerCaminata(op.transbordo.puntoA, op.transbordo.puntoB)
      : Promise.resolve(null);

    Promise.all([
      obtenerCaminata(originLocation, op.subida),
      obtenerCaminata(op.bajada, destinationLocation),
      transbordo,
    ])
      .then(([ro, rd, rt]) => {
        if (!activo) return;
        // Sin respuesta de Directions se traza la recta origen→parada: peor
        // que el camino real, pero sigue indicando hacia dónde hay que ir.
        setCaminoOrigen(ro ? ro.coords : [originLocation, op.subida]);
        setCaminataOrigen(ro ? ro.distanciaKm : null);
        setMinutosOrigen(ro ? ro.minutos : null);

        setCaminoDestino(rd ? rd.coords : [op.bajada, destinationLocation]);
        setCaminataDestino(rd ? rd.distanciaKm : null);
        setMinutosDestino(rd ? rd.minutos : null);

        setCaminoTransbordo(rt ? rt.coords : []);

        // Ya elegida: interesa el arranque. Mientras se comparan opciones,
        // el viaje entero.
        if (conLoader) {
          encuadrarArranque(op);
          return;
        }

        // Encuadra SOLO el tramo de interés: subida, recorrido en bus,
        // transbordo, bajada y las caminatas (no la ruta completa).
        const puntos: Punto[] = [
          originLocation,
          destinationLocation,
          op.subida,
          op.bajada,
          ...op.tramos.flatMap((t) => t.coordinates),
        ];
        if (op.transbordo) {
          puntos.push(op.transbordo.puntoA, op.transbordo.puntoB);
        }
        if (ro) puntos.push(...ro.coords);
        if (rd) puntos.push(...rd.coords);
        if (rt) puntos.push(...rt.coords);

        encuadrar(map, puntos);
      })
      .finally(() => {
        if (activo && conLoader) setCargando(false);
      });

    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opcionActiva?.id, originLocation, destinationLocation, map]);

  //---------------------------------------------------- ZOOM A UNA RUTA
  const zoomToRoute = (feature: any) => {
    const tramo = tramoDeInicio(feature);
    if (tramo.length < 2) {
      const [lng, lat] = feature.geometry.coordinates[0];
      irAlPunto(map, { latitude: lat, longitude: lng });
      return;
    }
    encuadrar(map, tramo, { top: 100, right: 50, bottom: 100, left: 50 });
  };

  //---------------------------------------------------- LIMPIAR
  // Borra del mapa el plan / la ruta escogida y sus trazados a pie.
  const limpiarViaje = () => {
    setRutaElegida(null);
    setPlan(null);
    setSelectedTripRouteId(null);
    setCaminoOrigen([]);
    setCaminoDestino([]);
    setCaminoTransbordo([]);
  };

  // Reinicio completo de "Planear viaje": además del plan y los trazados, quita
  // los marcadores de Origen/Destino y vacía los buscadores.
  const limpiarPlaneacion = () => {
    limpiarViaje();
    setOrigin("");
    setDestination("");
    setOriginLocation(null);
    setDestinationLocation(null);
    setOrigenEtiqueta("");
    setDestinoEtiqueta("");
    setOrigenListo(false);
    setDestinoListo(false);
    setCaminataOrigen(null);
    setCaminataDestino(null);
    setMinutosOrigen(null);
    setMinutosDestino(null);
    setModalMinimizado(false);
    setCargando(false);
  };

  //---------------------------------------------------- FILTROS
  const filteredRoutes = useMemo(
    () =>
      routes.filter((feature: any) =>
        feature.properties.name
          .toLowerCase()
          .includes(routeSearch.toLowerCase())
      ),
    [routes, routeSearch]
  );

  const taxisFiltrados = useMemo(
    () =>
      rutasDeTaxi.filter((f: any) =>
        f.properties.name.toLowerCase().includes(taxiSearch.toLowerCase())
      ),
    [rutasDeTaxi, taxiSearch]
  );

  const taxiElegido =
    rutasDeTaxi.find((f: any) => f.id === taxiSeleccionado) ?? null;

  // El paradero: donde arranca el trazado. En los taxis colectivos no es un
  // detalle del dibujo, es el único punto donde se puede subir.
  const paraderoDelTaxi: Punto | null = taxiElegido
    ? {
        latitude: taxiElegido.geometry.coordinates[0][1],
        longitude: taxiElegido.geometry.coordinates[0][0],
      }
    : null;

  // Ruta que se está viendo en el mapa (cuando hay exactamente una activa)
  const rutaMostrada =
    selectedRoutes.length === 1
      ? routes.find((r: any) => String(r.id) === selectedRoutes[0])
      : null;

  //---------------------------------------------------- CAMBIO DE PÁGINA
  // Al cambiar de página se limpia lo de la otra: el mapa no debe quedar con
  // trazados de dos secciones distintas encima.
  const irAPagina = (destino: Pagina) => {
    setMenuAbierto(false);
    // Volver a tocar la pestaña activa no debe borrar lo que se esté viendo.
    if (destino === pagina) return;
    setPagina(destino);
    setRutaDropdownOpen(false);
    setTaxiDropdownOpen(false);
    setTaxiSeleccionado(null);
    setTaxiSearch("");
    setRouteSearch("");
    // Las rutas dibujadas se borran SIEMPRE, incluso al entrar a "ver": las que
    // quedan de una búsqueda de viaje no son una selección del usuario.
    setSelectedRoutes([]);
    setRutaTocada(null);
    if (destino !== "viaje") limpiarPlaneacion();
    // El mapa queda encuadrado en la ruta anterior; sin trazados eso se ve como
    // un mapa vacío. Se devuelve la cámara a la vista de ciudad.
    irAlPunto(map, CENTRO, 13);
  };

  return (
    <div className="app">
      {/* CABECERA */}
      <header className="cabecera">
        <button
          type="button"
          className="menu-btn"
          onClick={() => setMenuAbierto(true)}
          aria-label="Abrir menú"
        >
          ☰
        </button>
        <div className="logo-tile">
          <img src="/orientese-mark.png" alt="" />
        </div>
        <div style={{ flex: 1 }}>
          <p className="marca">
            Oriénte<span>se</span>
          </p>
          <p className="lema">{TITULO_PAGINA[pagina]}</p>
        </div>
      </header>

      <div className="cuerpo">
        {/* PANEL DE CONTROLES */}
        <aside className="panel">
          {/* PÁGINA: PLANEAR VIAJE */}
          {pagina === "viaje" &&
            (hayInternet ? (
              <div
                className={`seccion${
                  buscadorPlegado && (plan || rutaElegida) ? " resumida" : ""
                }`}
              >
                {/* Solo se ve en el celular, con el buscador plegado. */}
                <button
                  type="button"
                  className="buscador-resumen"
                  onClick={() => setBuscadorPlegado(false)}
                  aria-label="Editar origen y destino"
                >
                  <span className="buscador-resumen-lugares">
                    <span>🟢 {origenEtiqueta || origin}</span>
                    <span>🔴 {destinoEtiqueta || destination}</span>
                  </span>
                  <span className="buscador-resumen-editar">Editar</span>
                </button>

                <button
                  type="button"
                  className="mi-ubicacion-btn"
                  onClick={usarMiUbicacion}
                  disabled={buscandoUbicacion}
                >
                  📍{" "}
                  {buscandoUbicacion
                    ? "Buscando tu ubicación…"
                    : "Usar mi ubicación"}
                </button>

                {/* Si no se pudo obtener, se dice por qué aquí mismo: el campo
                    de origen vacío no explica nada por sí solo. */}
                {falloUbicacion && !originLocation && (
                  <div className="nota-ubicacion">
                    <span aria-hidden="true">📍</span>
                    <span>
                      {resumenDelFallo(falloUbicacion)} Escribe la dirección
                      desde la que sales, o{" "}
                      <button
                        type="button"
                        className="enlace"
                        onClick={() =>
                          setDialogo(explicacionDelFallo(falloUbicacion))
                        }
                      >
                        mira cómo activarla
                      </button>
                      .
                    </span>
                  </div>
                )}

                <BuscadorLugar
                  valor={origin}
                  onCambioTexto={(t) => {
                    setOrigin(t);
                    setOrigenListo(false);
                  }}
                  placeholder="¿Desde dónde sales?"
                  icono="🟢"
                  conMiUbicacion
                  onElegirMiUbicacion={usarMiUbicacion}
                  onElegirLugar={(lugar, descripcion) =>
                    fijarLugar("origin", lugar, descripcion)
                  }
                  onEnter={(t) => searchAddress(t, "origin")}
                />

                <BuscadorLugar
                  valor={destination}
                  onCambioTexto={(t) => {
                    setDestination(t);
                    setDestinoListo(false);
                  }}
                  placeholder="¿A dónde quieres ir?"
                  icono="🔴"
                  onElegirLugar={(lugar, descripcion) =>
                    fijarLugar("destination", lugar, descripcion)
                  }
                  onEnter={(t) => searchAddress(t, "destination")}
                />

                <button
                  type="button"
                  className="buscar-ruta-btn"
                  disabled={!origin.trim() || !destination.trim()}
                  onClick={buscarRuta}
                >
                  Buscar ruta
                </button>
              </div>
            ) : (
              /* SIN INTERNET: los campos dependen de las APIs de Google, así
                 que se sustituyen por un aviso en vez de dejar que el usuario
                 escriba y no obtenga resultados. */
              <div className="sin-red">
                <div className="sin-red-icono" aria-hidden="true">
                  📡
                </div>
                <h3>Sin conexión a internet</h3>
                <p>
                  La búsqueda de rutas está disponible con internet: se necesita
                  para encontrar las direcciones y calcular el recorrido.
                </p>
                <p>Conéctate y esta pantalla volverá sola.</p>
                <p className="fuerte">
                  Mientras tanto, la pestaña <b>Ver rutas</b> sí está disponible
                  sin internet: los recorridos están guardados en la app.
                </p>
              </div>
            ))}

          {/* PÁGINA: VER UNA RUTA EN EL MAPA */}
          {pagina === "ver" && (
            <div className="seccion">
              <p className="seccion-titulo">Ver una ruta en el mapa</p>

              <button
                type="button"
                className="dropdown-btn"
                onClick={() => setRutaDropdownOpen((v) => !v)}
                aria-expanded={rutaDropdownOpen}
              >
                {rutaMostrada && (
                  <span
                    className="punto-color"
                    style={{
                      background:
                        rutaMostrada.properties.stroke || COLORS.navy,
                    }}
                  />
                )}
                <span
                  className={`dropdown-btn-texto${
                    rutaMostrada ? "" : " vacio"
                  }`}
                >
                  {rutaMostrada
                    ? rutaMostrada.properties.name
                    : "Selecciona una ruta"}
                </span>
                <span className="chevron">{rutaDropdownOpen ? "▲" : "▼"}</span>
              </button>

              {rutaDropdownOpen && (
                <div className="dropdown-lista">
                  <div className="dropdown-buscador">
                    <input
                      type="text"
                      placeholder="Buscar línea por nombre…"
                      value={routeSearch}
                      onChange={(e) => setRouteSearch(e.target.value)}
                      aria-label="Buscar línea por nombre"
                    />
                  </div>

                  <div className="dropdown-items">
                    <button
                      type="button"
                      className="dropdown-item apagado"
                      onClick={() => {
                        limpiarViaje();
                        setSelectedRoutes([]);
                        setRutaDropdownOpen(false);
                      }}
                    >
                      <span className="nombre">Ninguna (ocultar rutas)</span>
                    </button>

                    {filteredRoutes.length === 0 && (
                      <div className="dropdown-item apagado">
                        <span className="nombre">
                          Sin resultados para “{routeSearch}”
                        </span>
                      </div>
                    )}

                    {filteredRoutes.map((feature: any) => {
                      const id = String(feature.id);
                      const activo = selectedRoutes.includes(id);
                      const color = feature.properties.stroke || COLORS.navy;
                      return (
                        <button
                          key={id}
                          type="button"
                          className={`dropdown-item${activo ? " activo" : ""}`}
                          onClick={() => {
                            // Borra la ruta/plan actual y dibuja solo la elegida.
                            limpiarViaje();
                            setSelectedRoutes([id]);
                            zoomToRoute(feature);
                            setRutaDropdownOpen(false);
                          }}
                        >
                          <span
                            className="punto-color"
                            style={{ background: color }}
                          />
                          <span className="nombre">
                            {feature.properties.name}
                          </span>
                          {activo && (
                            <span style={{ color, fontWeight: 900 }}>✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PÁGINA: TAXIS COLECTIVOS */}
          {pagina === "taxis" && (
            <div className="seccion">
              <p className="seccion-titulo">
                Ver un recorrido de taxi colectivo
              </p>

              <button
                type="button"
                className="dropdown-btn"
                onClick={() => setTaxiDropdownOpen((v) => !v)}
                aria-expanded={taxiDropdownOpen}
              >
                {taxiElegido && (
                  <span
                    className="punto-color"
                    style={{
                      background: taxiElegido.properties.stroke || COLORS.navy,
                    }}
                  />
                )}
                <span
                  className={`dropdown-btn-texto${taxiElegido ? "" : " vacio"}`}
                >
                  {taxiElegido
                    ? taxiElegido.properties.name
                    : "Selecciona un recorrido"}
                </span>
                <span className="chevron">{taxiDropdownOpen ? "▲" : "▼"}</span>
              </button>

              {taxiDropdownOpen && (
                <div className="dropdown-lista">
                  <div className="dropdown-buscador">
                    <input
                      type="text"
                      placeholder="Buscar recorrido por nombre…"
                      value={taxiSearch}
                      onChange={(e) => setTaxiSearch(e.target.value)}
                      aria-label="Buscar recorrido por nombre"
                    />
                  </div>

                  <div className="dropdown-items">
                    <button
                      type="button"
                      className="dropdown-item apagado"
                      onClick={() => {
                        setTaxiSeleccionado(null);
                        setTaxiDropdownOpen(false);
                      }}
                    >
                      <span className="nombre">
                        Ninguno (ocultar recorrido)
                      </span>
                    </button>

                    {taxisFiltrados.length === 0 && (
                      <div className="dropdown-item apagado">
                        <span className="nombre">
                          Sin resultados para “{taxiSearch}”
                        </span>
                      </div>
                    )}

                    {taxisFiltrados.map((feature: any) => {
                      const activo = taxiSeleccionado === feature.id;
                      const color = feature.properties.stroke || COLORS.navy;
                      return (
                        <button
                          key={feature.id}
                          type="button"
                          className={`dropdown-item${activo ? " activo" : ""}`}
                          onClick={() => {
                            setTaxiSeleccionado(feature.id);
                            zoomToRoute(feature);
                            setTaxiDropdownOpen(false);
                          }}
                        >
                          <span
                            className="punto-color"
                            style={{ background: color }}
                          />
                          <span className="nombre">
                            {feature.properties.name}
                          </span>
                          <span className="taxi-km">
                            {feature.properties.distancia} km
                          </span>
                          {activo && (
                            <span style={{ color, fontWeight: 900 }}>✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Los taxis colectivos no funcionan como los buses: no recogen
                  pasajeros sobre la marcha. Se dice siempre, no solo cuando hay
                  un recorrido elegido, porque es la regla de toda la sección. */}
              <div className="nota-taxi">
                <span aria-hidden="true">🚕</span>
                <span>
                  <b>Se aborda solo en el paradero.</b> A diferencia de los
                  buses, los taxis colectivos no paran en el camino a recoger
                  gente: hay que tomarlos donde arranca el recorrido, en el punto
                  marcado «Sube aquí».
                </span>
              </div>

              {paraderoDelTaxi && (
                <button
                  type="button"
                  className="btn-secundario"
                  onClick={() => irAlPunto(map, paraderoDelTaxi, 17)}
                >
                  🚕 Ver el paradero en el mapa
                </button>
              )}
            </div>
          )}
        </aside>

        {/* MAPA */}
        <div className="mapa-wrap">
          <MapaRutas
            rutas={routes}
            rutasDibujadas={selectedRoutes}
            rutaResaltadaId={selectedTripRouteId}
            plan={plan}
            opcionActiva={opcionActiva}
            taxiElegido={taxiElegido}
            userLocation={userLocation}
            origenPunto={originLocation}
            destinoPunto={destinationLocation}
            origenEtiqueta={origenEtiqueta}
            destinoEtiqueta={destinoEtiqueta}
            caminoOrigen={caminoOrigen}
            caminoDestino={caminoDestino}
            caminoTransbordo={caminoTransbordo}
            onArrastrarOrigen={(p) => alArrastrar("origin", p)}
            onArrastrarDestino={(p) => alArrastrar("destination", p)}
            onTocarRuta={(feature) => {
              if (plan?.tipo === "directa") {
                setSelectedTripRouteId(String(feature.id));
              }
              setRutaTocada(feature);
            }}
          />

          <Avisos
            horario={horario}
            fueraDeServicio={fueraDeServicio}
            esPaginaTaxis={pagina === "taxis"}
            ubicacionFueraDeZona={ubicacionFueraDeZona}
          />

          {cargando && (
            <div className="loader-overlay">
              <div className="loader-card">
                <div className="spinner" />
                <p className="loader-texto">{mensajeCarga}</p>
              </div>
            </div>
          )}

          {plan && !rutaElegida && (
            <TarjetaPlan
              plan={plan}
              opcionActivaId={selectedTripRouteId}
              minimizado={modalMinimizado}
              onMinimizar={() => setModalMinimizado((v) => !v)}
              onCerrar={() => {
                // Cierra las opciones y limpia el mapa.
                setPlan(null);
                setSelectedRoutes([]);
                setSelectedTripRouteId(null);
              }}
              onVerOpcion={setSelectedTripRouteId}
              onEscoger={(elegida) => {
                // La opción ya es la activa (previsualizada): su tramo y
                // caminata ya están trazados. Solo la confirmamos.
                setSelectedRoutes(
                  elegida.transbordo
                    ? [String(elegida.feature.id), String(elegida.rutaB.id)]
                    : [String(elegida.feature.id)]
                );
                setRutaElegida(elegida);
                setModalMinimizado(false);
                setPlan(null);
                // El efecto de trazado no vuelve a correr (es la misma opción
                // que ya se previsualizaba), así que el zoom al arranque se
                // hace aquí.
                encuadrarArranque(elegida);
              }}
            />
          )}

          {/* FICHA DE LA RUTA QUE SE TOCÓ EN EL MAPA */}
          {!plan && !rutaElegida && rutaTocada && (
            <div className="tarjeta">
              <div className="tarjeta-header">
                <div
                  className="tarjeta-franja"
                  style={{
                    background: rutaTocada.properties.stroke || COLORS.navy,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 className="tarjeta-titulo">
                    {rutaTocada.properties.name}
                  </h2>
                  <p className="tarjeta-sub">
                    Transporte urbano · Oriente
                    {rutaTocada.properties.distancia
                      ? ` · ${rutaTocada.properties.distancia} km`
                      : ""}
                    {rutaTocada.properties.frecuencia
                      ? ` · cada ~${rutaTocada.properties.frecuencia} min`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="tarjeta-btn"
                  onClick={() => setRutaTocada(null)}
                  title="Cerrar"
                >
                  ✕
                </button>
              </div>

              <button
                type="button"
                className="btn-principal"
                onClick={() =>
                  encuadrar(
                    map,
                    rutaTocada.geometry.coordinates.map(
                      ([lng, lat]: number[]) => ({
                        latitude: lat,
                        longitude: lng,
                      })
                    ),
                    { top: 60, right: 60, bottom: 140, left: 60 }
                  )
                }
              >
                Ver recorrido completo →
              </button>
            </div>
          )}

          {rutaElegida && (
            <TarjetaPasos
              ruta={rutaElegida}
              minimizado={modalMinimizado}
              onMinimizar={() => setModalMinimizado((v) => !v)}
              onCerrar={() => {
                // Quita la ruta escogida y su trazado del mapa.
                setRutaElegida(null);
                setSelectedRoutes([]);
                setSelectedTripRouteId(null);
                setCaminoOrigen([]);
                setCaminoDestino([]);
                setCaminoTransbordo([]);
              }}
              caminataOrigen={caminataOrigen}
              caminataDestino={caminataDestino}
              minutosOrigen={minutosOrigen}
              minutosDestino={minutosDestino}
            />
          )}
        </div>
      </div>

      <MenuLateral
        abierto={menuAbierto}
        pagina={pagina}
        onIr={irAPagina}
        onCerrar={() => setMenuAbierto(false)}
      />

      <Dialogo mensaje={dialogo} onCerrar={() => setDialogo(null)} />
    </div>
  );
}

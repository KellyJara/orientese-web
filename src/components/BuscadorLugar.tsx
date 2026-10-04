import { useEffect, useRef, useState } from "react";
import {
  detalleDeLugar,
  sugerenciasDeLugar,
  type Lugar,
  type Sugerencia,
} from "../lib/googleServices";

export const ETIQUETA_MI_UBICACION = "📍 Mi ubicación actual";

type Props = {
  valor: string;
  onCambioTexto: (texto: string) => void;
  placeholder: string;
  icono: string;
  /** Añade la opción "Mi ubicación actual" arriba de las sugerencias. */
  conMiUbicacion?: boolean;
  onElegirLugar: (lugar: Lugar, descripcion: string) => void;
  onElegirMiUbicacion?: () => void;
  /** Enter sin escoger sugerencia: se geocodifica el texto tal cual. */
  onEnter: (texto: string) => void;
};

/**
 * Buscador de lugares con sugerencias de Google Places. Reemplaza a
 * `GooglePlacesAutocomplete` de la versión móvil: mismo comportamiento
 * (300 ms de espera, desde 2 caracteres, resultados restringidos a Rionegro)
 * pero con el SDK de JavaScript y navegación por teclado.
 */
export default function BuscadorLugar({
  valor,
  onCambioTexto,
  placeholder,
  icono,
  conMiUbicacion = false,
  onElegirLugar,
  onElegirMiUbicacion,
  onEnter,
}: Props) {
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [resaltada, setResaltada] = useState(-1);
  const contenedor = useRef<HTMLDivElement | null>(null);
  // El token de sesión agrupa las pulsaciones de teclado con la consulta final
  // de detalles, que es como Google factura el autocompletado.
  const sesion = useRef<google.maps.places.AutocompleteSessionToken | null>(
    null
  );
  // Lo que el usuario acaba de escoger no debe volver a disparar una búsqueda.
  const recienElegido = useRef(false);

  // Espera 300 ms tras la última tecla antes de preguntarle a Google.
  useEffect(() => {
    if (recienElegido.current) {
      recienElegido.current = false;
      return;
    }
    if (valor.trim().length < 2 || valor === ETIQUETA_MI_UBICACION) {
      setSugerencias([]);
      return;
    }
    let vivo = true;
    const id = setTimeout(async () => {
      if (!sesion.current && window.google?.maps?.places) {
        sesion.current = new google.maps.places.AutocompleteSessionToken();
      }
      const res = await sugerenciasDeLugar(valor, sesion.current ?? undefined);
      if (!vivo) return;
      setSugerencias(res);
      setResaltada(-1);
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(id);
    };
  }, [valor]);

  // Un clic fuera cierra la lista, como al tocar fuera en el móvil.
  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const opciones: (Sugerencia | "mi-ubicacion")[] =
    conMiUbicacion && abierto ? ["mi-ubicacion", ...sugerencias] : sugerencias;

  const escoger = async (opcion: Sugerencia | "mi-ubicacion") => {
    setAbierto(false);
    setSugerencias([]);
    recienElegido.current = true;

    if (opcion === "mi-ubicacion") {
      onElegirMiUbicacion?.();
      return;
    }

    onCambioTexto(opcion.texto);
    const lugar = await detalleDeLugar(
      opcion.placeId,
      sesion.current ?? undefined
    );
    // El token se consume con la consulta de detalles: la siguiente búsqueda
    // empieza una sesión nueva.
    sesion.current = null;
    if (lugar) onElegirLugar(lugar, opcion.texto);
  };

  const alTeclear = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAbierto(true);
      setResaltada((i) => Math.min(i + 1, opciones.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setResaltada((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (resaltada >= 0 && opciones[resaltada]) {
        escoger(opciones[resaltada]);
      } else {
        setAbierto(false);
        onEnter(valor);
      }
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  };

  const mostrarLista = abierto && opciones.length > 0;

  return (
    <div className="buscador" ref={contenedor}>
      <span className="buscador-icono" aria-hidden="true">
        {icono}
      </span>
      <input
        type="text"
        value={valor}
        placeholder={placeholder}
        autoComplete="off"
        aria-label={placeholder}
        onChange={(e) => {
          onCambioTexto(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={alTeclear}
      />

      {mostrarLista && (
        <div className="sugerencias" role="listbox">
          {opciones.map((opcion, i) => {
            const esMiUbicacion = opcion === "mi-ubicacion";
            const clave = esMiUbicacion ? "mi-ubicacion" : opcion.placeId;
            const texto = esMiUbicacion ? ETIQUETA_MI_UBICACION : opcion.texto;
            return (
              <button
                key={clave}
                type="button"
                role="option"
                aria-selected={i === resaltada}
                className={`sugerencia${i === resaltada ? " resaltada" : ""}`}
                onMouseEnter={() => setResaltada(i)}
                onClick={() => escoger(opcion)}
              >
                {texto}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

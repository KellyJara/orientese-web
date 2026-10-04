import { useEffect, useState } from "react";
import { useMap } from "@vis.gl/react-google-maps";
import { aLatLng, type Punto } from "../lib/geo";

type Props = {
  path: Punto[];
  color: string;
  ancho: number;
  zIndex?: number;
  /** Línea de puntos, para los tramos que se hacen a pie. */
  punteada?: boolean;
  onClick?: () => void;
};

/**
 * El SDK de Google no trae un componente de React para las polilíneas: se crean
 * sobre el mapa de forma imperativa. Este envoltorio hace ese trabajo y expone
 * la misma interfaz declarativa que usaba `<Polyline>` en la app móvil.
 */
export default function Polilinea({
  path,
  color,
  ancho,
  zIndex = 1,
  punteada = false,
  onClick,
}: Props) {
  const map = useMap();
  const [linea, setLinea] = useState<google.maps.Polyline | null>(null);

  // La línea se crea una vez por mapa y se destruye al desmontar; lo que cambia
  // en cada render son sus opciones, no el objeto.
  useEffect(() => {
    if (!map) return;
    const nueva = new google.maps.Polyline();
    nueva.setMap(map);
    setLinea(nueva);
    return () => {
      nueva.setMap(null);
      setLinea(null);
    };
  }, [map]);

  useEffect(() => {
    if (!linea) return;
    linea.setOptions({
      path: path.map(aLatLng),
      strokeColor: color,
      strokeWeight: punteada ? 0 : ancho,
      strokeOpacity: punteada ? 0 : 1,
      zIndex,
      clickable: !!onClick,
      // Un punteado en Google Maps es una línea invisible con un símbolo
      // repetido encima.
      icons: punteada
        ? [
            {
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: color,
                fillOpacity: 1,
                strokeOpacity: 0,
                scale: ancho / 2,
              },
              offset: "0",
              repeat: "14px",
            },
          ]
        : undefined,
    });
  }, [linea, path, color, ancho, zIndex, punteada, onClick]);

  useEffect(() => {
    if (!linea || !onClick) return;
    const escucha = linea.addListener("click", onClick);
    return () => escucha.remove();
  }, [linea, onClick]);

  return null;
}

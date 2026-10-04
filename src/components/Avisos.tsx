import { aHora } from "../lib/horario";

type Props = {
  horario: { inicio: number; fin: number } | null;
  fueraDeServicio: boolean;
  esPaginaTaxis: boolean;
  ubicacionFueraDeZona: boolean;
};

/** Avisos flotantes sobre el mapa. */
export default function Avisos({
  horario,
  fueraDeServicio,
  esPaginaTaxis,
  ubicacionFueraDeZona,
}: Props) {
  return (
    <div className="avisos">
      {/* FUERA DE HORARIO: se muestra desde el cierre hasta la apertura.
          No aplica a la pestaña de taxis: esos recorridos no traen horario en
          los datos y anunciarlos como cerrados sería inventar. */}
      {horario && fueraDeServicio && !esPaginaTaxis && (
        <div className="aviso alerta">
          <span aria-hidden="true">🌙</span>
          <span>
            <b>Sin servicio a esta hora.</b> Las rutas de bus operan de{" "}
            {aHora(horario.inicio)} a {aHora(horario.fin)}.
          </span>
        </div>
      )}

      {/* FUERA DE LA ZONA: el navegador ubicó al usuario lejos de Rionegro, así
          que ninguna ruta de la app le sirve como punto de partida. */}
      {ubicacionFueraDeZona && (
        <div className="aviso alerta">
          <span aria-hidden="true">📍</span>
          <span>
            <b>Estás fuera de Rionegro.</b> Tu punto de partida debe estar en el
            municipio para encontrar una ruta.
          </span>
        </div>
      )}

      {/* AVISO PERMANENTE: la calle Belchite (Diagonal 50C) quedó
          peatonalizada, así que ninguna ruta (bus o taxi colectivo) la
          recorre. */}
      <div className="aviso">
        <span aria-hidden="true">🚧</span>
        <span>
          <b>Calle Belchite (Diagonal 50C) peatonalizada.</b> Ningún bus ni taxi
          colectivo circula por ella.
        </span>
      </div>
    </div>
  );
}

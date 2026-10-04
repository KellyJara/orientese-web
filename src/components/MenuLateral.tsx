import { useEffect } from "react";

export type Pagina = "viaje" | "ver" | "taxis";

const PAGINAS: { clave: Pagina; icono: string; texto: string }[] = [
  { clave: "viaje", icono: "🧭", texto: "Planear viaje" },
  { clave: "ver", icono: "🗺️", texto: "Ver rutas" },
  { clave: "taxis", icono: "🚕", texto: "Taxis colectivos" },
];

type Props = {
  abierto: boolean;
  pagina: Pagina;
  onIr: (pagina: Pagina) => void;
  onCerrar: () => void;
};

export default function MenuLateral({
  abierto,
  pagina,
  onIr,
  onCerrar,
}: Props) {
  useEffect(() => {
    if (!abierto) return;
    const alSoltar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alSoltar);
    return () => window.removeEventListener("keydown", alSoltar);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div className="drawer-overlay">
      {/* Fondo: al hacer clic fuera, cierra */}
      <div className="drawer-fondo" onClick={onCerrar} role="presentation" />
      <nav className="drawer-panel" aria-label="Secciones">
        <p className="drawer-titulo">Menú</p>
        {PAGINAS.map(({ clave, icono, texto }) => (
          <button
            key={clave}
            type="button"
            className={`drawer-item${pagina === clave ? " activo" : ""}`}
            aria-current={pagina === clave ? "page" : undefined}
            onClick={() => onIr(clave)}
          >
            <span className="drawer-item-icono" aria-hidden="true">
              {icono}
            </span>
            {texto}
          </button>
        ))}
      </nav>
    </div>
  );
}

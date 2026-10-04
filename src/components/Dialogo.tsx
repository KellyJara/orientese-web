import { useEffect } from "react";

export type Mensaje = { titulo: string; texto: string };

type Props = {
  mensaje: Mensaje | null;
  onCerrar: () => void;
};

/**
 * Sustituye a `Alert.alert` de React Native: el navegador tiene `alert()`, pero
 * bloquea la pestaña y no se puede dar estilo, así que los avisos van en un
 * diálogo propio.
 */
export default function Dialogo({ mensaje, onCerrar }: Props) {
  // Escape cierra, como cualquier diálogo del sistema.
  useEffect(() => {
    if (!mensaje) return;
    const alSoltar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alSoltar);
    return () => window.removeEventListener("keydown", alSoltar);
  }, [mensaje, onCerrar]);

  if (!mensaje) return null;

  return (
    <div
      className="dialogo-overlay"
      role="presentation"
      onClick={onCerrar}
    >
      <div
        className="dialogo"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialogo-titulo"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dialogo-titulo">{mensaje.titulo}</h2>
        <p>{mensaje.texto}</p>
        <button type="button" onClick={onCerrar} autoFocus>
          Entendido
        </button>
      </div>
    </div>
  );
}

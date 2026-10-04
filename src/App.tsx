import { useEffect, useState } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import MapScreen from "./screens/MapScreen";
import { cargarDatos, type Datos } from "./lib/datos";
import { FALTA_CLAVE, GOOGLE_API_KEY } from "./config/google";

export default function App() {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [errorDatos, setErrorDatos] = useState(false);

  useEffect(() => {
    let vivo = true;
    cargarDatos()
      .then((d) => vivo && setDatos(d))
      .catch((e) => {
        console.log("Error cargando los recorridos:", e);
        if (vivo) setErrorDatos(true);
      });
    return () => {
      vivo = false;
    };
  }, []);

  // Sin clave el mapa no carga y nada de lo demás tiene sentido: se explica qué
  // falta en vez de dejar una pantalla gris.
  if (FALTA_CLAVE) {
    return (
      <div className="config-error">
        <h1>Falta la clave de Google</h1>
        <p>
          Copia <code>.env.example</code> a <code>.env</code> y pon tu clave en{" "}
          <code>VITE_GOOGLE_API_KEY</code>. En la consola de Google Cloud deben
          estar habilitadas:
        </p>
        <ul>
          <li>Maps JavaScript API</li>
          <li>Places API</li>
          <li>Directions API</li>
          <li>Geocoding API</li>
        </ul>
        <p>Después reinicia el servidor de desarrollo.</p>
      </div>
    );
  }

  if (errorDatos) {
    return (
      <div className="config-error">
        <h1>No pudimos cargar los recorridos</h1>
        <p>
          Los datos de las rutas no se descargaron. Recarga la página; si el
          problema sigue, revisa la conexión.
        </p>
      </div>
    );
  }

  return (
    <APIProvider
      apiKey={GOOGLE_API_KEY}
      libraries={["places", "geocoding", "routes", "marker"]}
      language="es"
      region="CO"
    >
      {datos ? (
        <MapScreen rutas={datos.rutas} taxis={datos.taxis} />
      ) : (
        <div className="cargando-app">
          <div className="spinner" />
          <p className="loader-texto">Cargando los recorridos…</p>
        </div>
      )}
    </APIProvider>
  );
}

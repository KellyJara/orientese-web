// La clave sale del entorno (.env) y no del código: en web queda a la vista en
// el bundle igualmente, así que la protección real son las restricciones por
// referente HTTP que se configuran en Google Cloud.
export const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY ?? "";

// Los marcadores avanzados (los globos de Origen/Destino con la dirección
// dentro) solo se dibujan si el mapa tiene un Map ID.
export const GOOGLE_MAP_ID =
  import.meta.env.VITE_GOOGLE_MAP_ID ?? "DEMO_MAP_ID";

export const FALTA_CLAVE = !GOOGLE_API_KEY;

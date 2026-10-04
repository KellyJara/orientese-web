// Los recorridos ocupan ~2,3 MB. En el móvil van dentro del APK y se leen al
// instante; en web serían 2,3 MB bloqueando la primera pintura, así que se
// cargan como un trozo aparte: la cabecera y el mapa aparecen enseguida y los
// datos entran después. El navegador además puede cachear ese trozo y no
// volver a descargarlo cuando cambie el código de la app.
export type Datos = { rutas: any[]; taxis: any[] };

export const cargarDatos = async (): Promise<Datos> => {
  const [existentes, taxi] = await Promise.all([
    import("../data/RutasExistentes.json"),
    import("../data/RutasTaxi.json"),
  ]);
  return {
    // Solo las líneas: en el GeoJSON también hay puntos sueltos que no son rutas.
    rutas: (existentes.default as any).features.filter(
      (f: any) => f.geometry?.type === "LineString"
    ),
    taxis: (taxi.default as any).features,
  };
};

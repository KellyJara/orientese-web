// "5:00" -> 300. Minutos desde medianoche, para comparar horas sin depender
// de la fecha.
export const aMinutos = (hora: string) => {
  const [h, m] = hora.split(":").map((n) => parseInt(n, 10));
  return h * 60 + (m || 0);
};

// 300 -> "5:00"
export const aHora = (min: number) =>
  `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;

// Ventana de servicio de toda la red. Sale de los datos, no de constantes: si
// mañana una ruta cambia de horario en el GeoJSON, el aviso se ajusta solo. Se
// toma la apertura más temprana y el cierre más tardío, que es cuando hay algún
// bus rodando.
export const horarioDeRed = (rutas: any[]) => {
  const inicios: number[] = [];
  const fines: number[] = [];
  rutas.forEach((f: any) => {
    const { hora_inicio, hora_fin } = f.properties;
    if (hora_inicio && hora_fin) {
      inicios.push(aMinutos(hora_inicio));
      fines.push(aMinutos(hora_fin));
    }
  });
  if (!inicios.length) return null;
  return { inicio: Math.min(...inicios), fin: Math.max(...fines) };
};

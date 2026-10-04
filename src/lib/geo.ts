// Tipo de coordenada que usa toda la app. Se mantiene { latitude, longitude }
// —el mismo de la versión móvil— para que la lógica de planificación sea
// idéntica en las dos; solo se traduce al { lat, lng } de Google en la frontera
// con el mapa.
export type Punto = { latitude: number; longitude: number };

export const aLatLng = (p: Punto): google.maps.LatLngLiteral => ({
  lat: p.latitude,
  lng: p.longitude,
});

export const desdeLatLng = (p: google.maps.LatLngLiteral): Punto => ({
  latitude: p.lat,
  longitude: p.lng,
});

// [lng, lat] de GeoJSON → Punto
export const dePosicion = ([lng, lat]: number[]): Punto => ({
  latitude: lat,
  longitude: lng,
});

// Encuadra una lista de puntos en el mapa dejando margen para las tarjetas
// flotantes que tapan la parte de abajo.
export const encuadrar = (
  map: google.maps.Map | null,
  puntos: Punto[],
  padding: google.maps.Padding = { top: 70, right: 60, bottom: 180, left: 60 },
  /** Tope de acercamiento: sin él, un tramo de 20 m deja el mapa en la calle
      sin nada alrededor con qué orientarse. */
  zoomMaximo?: number
) => {
  if (!map || puntos.length === 0) return;
  const bounds = new google.maps.LatLngBounds();
  puntos.forEach((p) => bounds.extend(aLatLng(p)));
  if (puntos.length === 1) {
    map.panTo(aLatLng(puntos[0]));
    map.setZoom(zoomMaximo ?? 16);
    return;
  }
  map.fitBounds(bounds, padding);
  if (zoomMaximo != null) {
    // fitBounds es asíncrono: el zoom solo se puede corregir cuando ya ajustó.
    google.maps.event.addListenerOnce(map, "idle", () => {
      const z = map.getZoom();
      if (z != null && z > zoomMaximo) map.setZoom(zoomMaximo);
    });
  }
};

export const irAlPunto = (
  map: google.maps.Map | null,
  punto: Punto,
  zoom = 16
) => {
  if (!map) return;
  map.panTo(aLatLng(punto));
  map.setZoom(zoom);
};

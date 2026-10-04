# Oriéntese — versión web

Rutas del transporte público de Rionegro (Antioquia) en el navegador. Es el
mismo producto que la app de React Native de `C:\Orientese`, reescrito para web
con React + Vite y el SDK de JavaScript de Google Maps.

## Antes de arrancar: la clave de Google

> **La clave actual no sirve todavía para web.** Al abrir la app el mapa muestra
> «Se ha producido un error» y la consola dice `ApiTargetBlockedMapError`.
> No es un fallo del código: la clave tiene una **restricción de APIs** que
> permite las que usa la app móvil (Places, Directions, Geocoding) pero no
> **Maps JavaScript API**, que es la que dibuja el mapa en el navegador.

Para dejarla funcionando, en la consola de Google Cloud:

1. **APIs y servicios → Biblioteca**: habilita **Maps JavaScript API** en el
   proyecto (las otras tres ya lo están).
2. **APIs y servicios → Credenciales → tu clave → Restricciones de API**: añade
   *Maps JavaScript API* a la lista de APIs permitidas, junto con Places API,
   Directions API y Geocoding API.
3. **Restricciones de aplicación**: la web necesita restricción por
   **referentes HTTP**, no por app de Android. Añade `http://localhost:5173/*`
   para desarrollo y el dominio donde se publique.

Conviene usar una clave distinta de la de Android: una clave de web queda a la
vista en el código que descarga el navegador, y lo que la protege es la lista de
referentes.

## Puesta en marcha

```bash
npm install
cp .env.example .env    # y pon tu clave en VITE_GOOGLE_API_KEY
npm run dev
```

Se abre en <http://localhost:5173>.

| Comando             | Qué hace                                       |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Servidor de desarrollo con recarga en caliente  |
| `npm run build`     | Comprueba tipos y genera `dist/` para publicar  |
| `npm run preview`   | Sirve `dist/` para probar el resultado del build |
| `npm run typecheck` | Solo la comprobación de tipos                   |

### Variables de entorno

| Variable                | Para qué                                                        |
| ----------------------- | --------------------------------------------------------------- |
| `VITE_GOOGLE_API_KEY`   | Clave de Google. Sin ella la app explica qué falta y no arranca. |
| `VITE_GOOGLE_MAP_ID`    | Map ID, necesario para los marcadores con globo. `DEMO_MAP_ID` sirve en desarrollo; para producción crea uno en Google Cloud → Maps → *Map Management*. |

## Qué hace la app

Tres secciones, desde el menú lateral (☰):

- **Planear viaje** — origen y destino con autocompletado restringido a
  Rionegro. Busca primero rutas directas; si no hay, propone transbordo en el
  centro o caminar hasta una parada y tomar un solo bus. Al escoger una opción
  muestra los pasos y dibuja el tramo en bus más las caminatas reales calle a
  calle.
- **Ver rutas** — cualquiera de las 72 líneas de bus sobre el mapa.
- **Taxis colectivos** — los 14 recorridos, uno a la vez.

Los marcadores de origen y destino se pueden arrastrar: al soltarlos se
resuelve la dirección nueva.

### Zona de cobertura

La app solo conoce Rionegro y sus alrededores: un radio de 15 km alrededor del
Parque de la Libertad, que es hasta donde llegan los recorridos del GeoJSON. Si
la ubicación del usuario, el origen o el destino caen fuera, se explica por qué
no se puede trazar una ruta en vez de devolver una búsqueda vacía. El criterio
vive en [`src/lib/zona.ts`](src/lib/zona.ts).

## Estructura

```
src/
  config/google.ts        Clave y Map ID, leídos del entorno
  lib/
    zona.ts               Zona de influencia de Rionegro y sus avisos
    planificador.ts       Cálculo de rutas (directa / transbordo / cercana)
    googleServices.ts     Geocodificación, autocompletado y caminatas
    horario.ts            Ventana de servicio de la red
    geo.ts                Coordenadas y encuadre del mapa
    datos.ts              Carga diferida de los recorridos
  components/             Mapa, buscador, tarjetas, menú, diálogo
  screens/MapScreen.tsx   Pantalla principal
  data/                   GeoJSON de buses y taxis colectivos
```

## Diferencias con la app móvil

El producto es el mismo; cambia lo que la plataforma obliga a cambiar.

| Móvil                                   | Web                                                        |
| --------------------------------------- | ---------------------------------------------------------- |
| APIs REST de Google por `fetch`          | SDK de JavaScript: el navegador bloquea esas REST por CORS |
| `Alert.alert`                            | Diálogo propio (`Dialogo.tsx`)                             |
| `@react-native-community/geolocation`    | `navigator.geolocation`, con reintento sin precisión alta   |
| Comprobación de red contra un endpoint   | `navigator.onLine` y sus eventos                            |
| Decodifica la polilínea de Directions    | El SDK ya devuelve el trazado en `overview_path`            |
| Pantalla de móvil, todo apilado          | Panel lateral junto al mapa; se apila por debajo de 980 px  |
| Los recorridos van dentro del APK        | Se cargan en un trozo aparte para no retrasar la primera pintura |

Dos detalles de comportamiento:

- En el móvil los buscadores se ocultan mientras se muestran las opciones, para
  dejar el mapa grande. En web el panel está al lado del mapa y no le quita
  sitio, así que se quedan visibles y se puede corregir el destino sin cerrar
  nada.
- El botón «Ver recorrido completo» de la ficha de una ruta no hacía nada en el
  móvil; aquí encuadra la ruta entera.

## Si no aparece tu ubicación

La app pide la ubicación al abrir y rellena el origen con «📍 Mi ubicación
actual». Cuando no lo consigue lo dice junto al campo de origen, con la causa
concreta. Las tres habituales:

- **«La ubicación solo funciona en https o localhost»** — los navegadores no la
  entregan en páginas inseguras. Abre <http://localhost:5173> y no la IP de la
  red local; para probar desde el teléfono hace falta https.
- **«Bloqueaste la ubicación para esta página»** — se permite desde el icono a
  la izquierda de la barra de direcciones, y luego «Usar mi ubicación».
- **«El dispositivo no pudo determinar dónde estás»** — pasa en computadores sin
  GPS. Revisa Configuración → Privacidad y seguridad → Ubicación en Windows. La
  app reintenta sin precisión alta, que es lo que suele destrabarlo.

El detalle técnico de cada fallo (código y mensaje del navegador) queda en la
consola. La lógica está en [`src/lib/ubicacion.ts`](src/lib/ubicacion.ts).

## Notas

- El autocompletado usa los servicios `AutocompleteService` / `PlacesService`,
  que son los que corresponden a la *Places API* que ya usa la app móvil. Si
  algún día se migra a *Places API (New)*, hay que cambiar
  `src/lib/googleServices.ts` y habilitar esa API.
- Los recorridos ocupan 2,3 MB (742 KB comprimidos) y se descargan una sola
  vez: el navegador los cachea aparte del código de la app.

import * as Location from 'expo-location';

/**
 * Última ubicación conocida, compartida entre pantallas.
 *
 * Antes cada mapa (BookingScreen, CreateTripGoogleMaps, PointPickerScreen) pedía el GPS por su
 * cuenta al abrirse, aunque otra pantalla ya lo hubiera pedido segundos antes. En un celular con
 * GPS lento, esa espera se repetía cada vez que se entraba a un mapa nuevo.
 *
 * `precargarUbicacion()` se llama una vez, apenas abre Home, para tener el dato listo antes de
 * que haga falta. Las pantallas de mapa llaman a `obtenerUbicacion()`: si el caché está fresco,
 * vuelve al toque; si no, pide el GPS de verdad (y dos pantallas pidiéndolo al mismo tiempo
 * comparten la misma promesa en vez de disparar dos fetches).
 */

const FRESCURA_MS = 2 * 60 * 1000; // más de esto, se pide de nuevo — puede haberse movido

let cache = null; // { coords: {latitude, longitude}, at: number }
let enCurso = null; // promesa compartida mientras hay un pedido de GPS en vuelo

const pedirAlSistema = async () => {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;
  const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  cache = { coords, at: Date.now() };
  return coords;
};

/**
 * Dispara el pedido de GPS sin que nadie tenga que esperar la respuesta. Pensada para
 * llamarse una sola vez, al abrir Home, así el caché ya está tibio cuando el usuario
 * entra a un mapa.
 */
export const precargarUbicacion = () => {
  obtenerUbicacion().catch(() => {});
};

/**
 * Coordenadas actuales, del caché si está fresco o pidiéndolas si no.
 * @returns {Promise<{latitude:number, longitude:number}|null>} null si no hay permiso.
 */
export const obtenerUbicacion = async () => {
  if (cache && Date.now() - cache.at < FRESCURA_MS) return cache.coords;
  if (enCurso) return enCurso;
  enCurso = pedirAlSistema().finally(() => { enCurso = null; });
  return enCurso;
};

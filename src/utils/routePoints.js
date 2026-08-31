/**
 * La ruta del viaje como una sola secuencia numerada: origen 1, paradas en el medio,
 * destino el número más alto.
 *
 * Vive acá porque la arman DOS pantallas —el detalle del viaje y el mapa— y tienen que
 * numerar igual: si se contradicen, el "3" del mapa no es el "3" de la lista de direcciones.
 *
 * Muestra TODAS las paradas, aunque caigan cerca del origen o del destino. Antes se
 * descartaban las que quedaban a menos de 150m de una punta del viaje (dos marcadores
 * pegados en el mapa), pero cada usuario carga la dirección que quiere: ocultarla —aunque
 * sea por unos metros de un punto vecino— es no cumplir lo que se le prometió que iba a
 * pasar con su dirección.
 */

/** Metros entre dos puntos (haversine). Infinity si a alguno le faltan coordenadas. */
const metersBetween = (a, b) => {
  if (a?.latitude == null || a?.longitude == null || b?.latitude == null || b?.longitude == null) {
    return Infinity;
  }
  const R = 6371000;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

/** Polyline codificada de Google -> lista de puntos. */
const decodePolyline = (encoded) => {
  if (!encoded) return [];
  const pts = [];
  let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    pts.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return pts;
};


/**
 * Ordena las paradas por el CAMINO, no por `order`.
 *
 * `order` es el orden en que se pagaron las reservas: con dos pasajeros de la misma ciudad
 * quedaba origen → recogida A → bajada A (a 900km) → recogida B (de vuelta en el origen) →
 * bajada B. Una ruta imposible, y es lo que ve tanto el pasajero en el detalle como el
 * conductor cuando maneja.
 *
 * Vecino más cercano: desde el origen, la próxima parada es la que está más cerca en línea
 * recta; desde ahí, la siguiente más cerca; así hasta terminarlas. Antes se ordenaba
 * proyectando cada parada sobre la línea recta origen→destino, y eso confundía "está atrás
 * del origen" con "está al costado": una parada de la MISMA ciudad de salida y otra a 60km en
 * una ciudad fuera del camino proyectaban casi al mismo punto, y por una diferencia mínima el
 * conductor terminaba mandado al desvío antes que a levantar al pasajero de la vuelta de la
 * esquina. No se usa el trazado guardado del viaje: ese se calculó antes de que existiera
 * ninguna reserva, así que no pasa por los puntos de recogida ni de bajada.
 *
 * Las paradas sin coordenadas no se pueden ubicar en el camino: quedan al final, en su orden
 * original.
 */
/**
 * @param {Object} trip
 * @returns {Array<{location, isEnd, kind, passenger}>} en orden, listo para numerar por índice
 */
/** Las paradas del viaje en el orden del camino. Exportada para el mapa del conductor. */
const ordenarStops = (trip) => {
  const conCoords = [];
  const sinCoords = [];
  (trip?.intermediateStops || []).forEach((s) => {
    (s?.coordinates?.latitude == null || s?.coordinates?.longitude == null ? sinCoords : conCoords).push(s);
  });
  sinCoords.sort((a, b) => (a?.order || 0) - (b?.order || 0));

  const restantes = [...conCoords];
  const ordenadas = [];
  let desde = trip?.origin?.coordinates;
  while (restantes.length) {
    let iMasCerca = 0;
    let distMasCerca = Infinity;
    restantes.forEach((s, i) => {
      const d = metersBetween(desde, s.coordinates);
      if (d < distMasCerca) { distMasCerca = d; iMasCerca = i; }
    });
    const [elegida] = restantes.splice(iMasCerca, 1);
    ordenadas.push(elegida);
    desde = elegida.coordinates;
  }

  return [...ordenadas, ...sinCoords];
};

/**
 * Cuándo una parada no es un punto aparte sino LA MISMA punta del viaje.
 *
 * 15 metros: es el margen de redondeo de unas coordenadas copiadas, no "cerca". Una parada a
 * media cuadra sigue siendo su propio punto y se muestra como tal — ese filtro por cercanía
 * (150m) se sacó a propósito, ver el comentario de arriba.
 */
const MISMO_PUNTO_M = 15;

/**
 * Dos direcciones que son "la misma" aunque las coordenadas no coincidan por unos metros.
 * Pasa cuando el pasajero pidió el mismo recorrido que el conductor: la recogida se crea en
 * su origen —misma calle y número que la salida del viaje— pero geocodificada por otro lado,
 * así que cae a 30-40m y el filtro por distancia no la fusiona. El texto sí coincide.
 */
const normalizarDireccion = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFD')
    // saca los signos diacríticos combinantes (U+0300–U+036F) sin escribirlos literales acá
    .split('').filter((c) => { const n = c.charCodeAt(0); return n < 0x0300 || n > 0x036f; }).join('')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const mismaDireccion = (a, b) => {
  const na = normalizarDireccion(a);
  const nb = normalizarDireccion(b);
  return !!na && na === nb;
};

const buildRoutePoints = (trip) => {
  const origen = trip?.origin;
  const destino = trip?.destination;

  // Antes se ocultaba cualquier parada a menos de 150m del origen o destino, para no
  // mostrar dos marcadores pegados. Pero cada usuario carga la dirección que quiere, y
  // esconderla —aunque caiga cerca de otra— es prometerle algo (que su punto se iba a
  // ver) y no cumplirlo. Se muestran todas, sin filtrar por distancia.
  const stops = ordenarStops(trip);

  /**
   * El viaje que nace de una solicitud SIEMPRE trae una parada de recogida en el origen del
   * pasajero y una de bajada en su destino (tripRequestController). Cuando el conductor dijo
   * que hacía el mismo recorrido, esas dos son el mismo punto que las puntas del viaje, y la
   * dirección aparecía repetida: "Mariano Moreno 1071" como origen y otra vez como recogida.
   *
   * Se fusiona en vez de descartar: el punto no se duplica, pero el "acá sube Juan" no se
   * pierde — pasa a la punta, que es donde efectivamente sube. Descartar la parada a secas
   * dejaba al conductor sin saber quién subía ahí.
   */
  const fusionadas = new Set();
  const fusionarEnPunta = (punta) => {
    const encima = stops.find(
      (s) => !fusionadas.has(s) && (
        metersBetween(punta?.coordinates, s?.coordinates) <= MISMO_PUNTO_M
        // o la misma calle y número aunque geocodifique unos metros aparte (mismo recorrido).
        || mismaDireccion(punta?.address, s?.address)
      ),
    );
    if (encima) fusionadas.add(encima);
    return encima;
  };
  const enOrigen = fusionarEnPunta(origen);
  const enDestino = fusionarEnPunta(destino);

  return [
    {
      location: origen,
      label: 'Origen',
      isEnd: true,
      kind: 'origin',
      // De la parada fusionada sólo se hereda de quién es: el kind sigue siendo la punta.
      passenger: enOrigen?.passenger,
      kindFusionado: enOrigen?.kind,
    },
    ...stops
      .filter((stop) => !fusionadas.has(stop))
      .map((stop) => ({
        location: stop,
        label: '',
        isEnd: false,
        kind: stop?.kind || 'stop',
        passenger: stop?.passenger,
      })),
    {
      location: destino,
      label: 'Destino',
      isEnd: true,
      kind: 'destination',
      passenger: enDestino?.passenger,
      kindFusionado: enDestino?.kind,
    },
  ];
};

/** "Recogida" / "Bajada" para las paradas que nacieron de la reserva de un pasajero. */
const kindLabel = (kind) => (kind === 'pickup' ? 'Recogida' : kind === 'dropoff' ? 'Bajada' : '');

/** "A recoger a Ana" / "A dejar a Ana". Vacío si la parada no es de nadie. */
const quienLabel = (kind, passenger) =>
  passenger?.firstName
    ? `${kind === 'dropoff' ? 'A dejar a' : 'A recoger a'} ${passenger.firstName}`
    : '';

/**
 * Los puntos de una ruta de Directions, siguiendo las calles de verdad.
 *
 * Se arma con el polyline de cada STEP, no con `overview_polyline`. El overview es la
 * geometría que Google simplifica PARA MOSTRAR: en un viaje de 435 km son unos 245 puntos,
 * casi 2 km por punto, y con eso la línea corta las curvas y las esquinas y se ve al lado de
 * la calle en vez de encima. Los steps traen el detalle real.
 *
 * El overview queda de respaldo: una línea simplificada es mejor que ninguna.
 *
 * ponytail: son varios miles de puntos en un viaje largo. Si algún día se nota lento al
 * dibujar, el lugar para simplificar es acá y con un algoritmo que respete la forma
 * (Douglas-Peucker), no tirando uno de cada N, que fue justo lo que sacó la línea de la calle.
 */
const puntosDeRuta = (ruta) => {
  if (!ruta) return [];

  const pasos = [];
  ruta.legs?.forEach((leg) => leg.steps?.forEach((step) => {
    const puntos = decodePolyline(step.polyline?.points);
    // El primer punto de cada step repite el último del anterior.
    if (pasos.length && puntos.length) puntos.shift();
    pasos.push(...puntos);
  }));
  if (pasos.length > 1) return pasos;

  return decodePolyline(ruta.overview_polyline?.points);
};

/**
 * ¿Estos dos puntos son "el mismo lugar"? Misma regla que usa buildRoutePoints para fusionar
 * la recogida/bajada del pasajero con las puntas del viaje. Exportada porque el mapa del
 * conductor arma su propia lista (necesita las paradas como destinos de navegación) y tiene
 * que mostrar el MISMO recorrido, sin direcciones repetidas.
 */
const mismoLugar = (a, b) =>
  metersBetween(a?.coordinates, b?.coordinates) <= MISMO_PUNTO_M
  || mismaDireccion(a?.address, b?.address);

module.exports = { buildRoutePoints, ordenarStops, puntosDeRuta, metersBetween, mismoLugar, kindLabel, quienLabel, decodePolyline };

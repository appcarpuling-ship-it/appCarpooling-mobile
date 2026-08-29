/**
 * La ruta del viaje como una sola secuencia numerada: origen 1, paradas en el medio,
 * destino el número más alto.
 *
 * Vive acá porque la arman DOS pantallas —el detalle del viaje y el mapa— y tienen que
 * numerar igual: si se contradicen, el "3" del mapa no es el "3" de la lista de direcciones.
 *
 * Descarta las paradas que caen encima del origen o del destino. Pasa de verdad: el punto de
 * recogida que pide el pasajero suele SER la dirección de salida del viaje, y al confirmar el
 * pago se guarda igual como parada. En el mapa quedaban dos marcadores en el mismo lugar y el
 * de la parada tapaba al del origen, así que el número 1 no se veía; en la lista salía la
 * misma dirección dos veces.
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

// 150m: un marcador ocupa bastante más que eso en pantalla salvo con mucho zoom, y a esa
// distancia el conductor no da una vuelta extra — es la misma esquina.
const MISMO_PUNTO_M = 150;

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

const buildRoutePoints = (trip) => {
  const origen = trip?.origin;
  const destino = trip?.destination;

  const stops = ordenarStops(trip)
    .filter((s) => {
      const c = s?.coordinates;
      if (c?.latitude == null) return true; // sin coordenadas no se puede comparar: se muestra
      return (
        metersBetween(c, origen?.coordinates) >= MISMO_PUNTO_M &&
        metersBetween(c, destino?.coordinates) >= MISMO_PUNTO_M
      );
    });

  return [
    { location: origen, label: 'Origen', isEnd: true, kind: 'origin' },
    ...stops.map((stop) => ({
      location: stop,
      label: '',
      isEnd: false,
      kind: stop?.kind || 'stop',
      passenger: stop?.passenger,
    })),
    { location: destino, label: 'Destino', isEnd: true, kind: 'destination' },
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

module.exports = { buildRoutePoints, ordenarStops, puntosDeRuta, metersBetween, kindLabel, quienLabel, decodePolyline, MISMO_PUNTO_M };

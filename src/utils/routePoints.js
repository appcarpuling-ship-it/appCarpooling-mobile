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

/** Índice del punto del trazado más cercano: sirve como "qué tan avanzado" está una parada. */
const posicionEnTrazado = (trazado, coord) => {
  let mejorDist = Infinity;
  let mejorIdx = Number.MAX_SAFE_INTEGER;
  for (let i = 0; i < trazado.length; i++) {
    const d = metersBetween(trazado[i], coord);
    if (d < mejorDist) { mejorDist = d; mejorIdx = i; }
  }
  return mejorIdx;
};

/**
 * Sin trazado: cuánto avanzó la parada sobre el eje origen→destino. No es la ruta real, pero
 * ordena bien lo que importa —primero todo lo de la ciudad de salida, después lo del camino,
 * al final lo de la ciudad de llegada— que es justo lo que se rompía.
 */
const avanceSobreElEje = (origen, destino, punto) => {
  const dx = (destino?.longitude ?? 0) - (origen?.longitude ?? 0);
  const dy = (destino?.latitude ?? 0) - (origen?.latitude ?? 0);
  const largo2 = dx * dx + dy * dy;
  if (!largo2) return 0;
  const px = (punto?.longitude ?? 0) - (origen?.longitude ?? 0);
  const py = (punto?.latitude ?? 0) - (origen?.latitude ?? 0);
  return (px * dx + py * dy) / largo2;
};

/**
 * Ordena las paradas por el CAMINO, no por `order`.
 *
 * `order` es el orden en que se pagaron las reservas: con dos pasajeros de la misma ciudad
 * quedaba origen → recogida A → bajada A (a 900km) → recogida B (de vuelta en el origen) →
 * bajada B. Una ruta imposible, y es lo que ve tanto el pasajero en el detalle como el
 * conductor cuando maneja.
 *
 * Se usa el trazado guardado del viaje si existe (exacto) y si no la proyección sobre el eje
 * origen→destino. Las paradas sin coordenadas quedan al final, en su orden original.
 */
const comparadorDeRuta = (trip) => {
  const trazado = decodePolyline(trip?.routePolyline);
  const origen = trip?.origin?.coordinates;
  const destino = trip?.destination?.coordinates;

  const avance = (stop) => {
    const c = stop?.coordinates;
    if (c?.latitude == null || c?.longitude == null) return Number.MAX_SAFE_INTEGER;
    return trazado.length > 1 ? posicionEnTrazado(trazado, c) : avanceSobreElEje(origen, destino, c);
  };

  return (a, b) => {
    const da = avance(a);
    const db = avance(b);
    if (da !== db) return da - db;
    return (a?.order || 0) - (b?.order || 0); // empate: se respeta el orden original
  };
};

/**
 * @param {Object} trip
 * @returns {Array<{location, isEnd, kind, passenger}>} en orden, listo para numerar por índice
 */
/** Las paradas del viaje en el orden del camino. Exportada para el mapa del conductor. */
const ordenarStops = (trip) => [...(trip?.intermediateStops || [])].sort(comparadorDeRuta(trip));

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

module.exports = { buildRoutePoints, ordenarStops, metersBetween, kindLabel, quienLabel, decodePolyline, MISMO_PUNTO_M };

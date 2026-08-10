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

/**
 * @param {Object} trip
 * @returns {Array<{location, isEnd, kind, passenger}>} en orden, listo para numerar por índice
 */
const buildRoutePoints = (trip) => {
  const origen = trip?.origin;
  const destino = trip?.destination;

  const stops = [...(trip?.intermediateStops || [])]
    .sort((a, b) => (a?.order || 0) - (b?.order || 0))
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

module.exports = { buildRoutePoints, metersBetween, kindLabel, quienLabel, MISMO_PUNTO_M };

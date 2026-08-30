/**
 * El recorrido completo del viaje, como lo va a hacer el conductor: sus puntas afuera y el
 * tramo del pasajero en el medio. Los puntos del conductor son opcionales —si no declaró
 * recorrido propio hace el mismo tramo—, y en ese caso se muestran sólo los dos del pasajero.
 *
 * Vive acá porque lo usan DOS pantallas: el pasajero mirando la postulación de un conductor
 * (ApplicationDetailScreen) y el conductor mirando su propia postulación ya enviada
 * (TripRequestDetailScreen). Antes sólo existía en la primera.
 */

// Dirección (línea principal) + ciudad/provincia (línea chica), cuando no son lo mismo.
// Antes era sólo `address || city`: las puntas del conductor tienen una dirección de calle
// sin ciudad al lado, y quedaban sin poder saber en qué ciudad caían.
const dir = (p) => {
  const principal = p?.address || p?.city || '';
  const ciudad = [p?.city, p?.province].filter(Boolean).join(', ');
  return { texto: principal, ciudad: ciudad && ciudad !== principal ? ciudad : '' };
};

const armarRecorrido = (app, tramo) => {
  if (!tramo?.origin || !tramo?.destination) return [];
  // Las paradas que puso el pasajero al publicar la solicitud van entre sus dos puntas.
  // Antes se ignoraban y su viaje se mostraba como si fuera directo.
  const paradas = (tramo.intermediateStops || [])
    .map((stop, i) => ({ etiqueta: `Parada ${i + 1}`, ...dir(stop) }));
  return [
    app.driverOrigin && { etiqueta: 'Sale desde', ...dir(app.driverOrigin), delConductor: true },
    // Paradas del recorrido del conductor: van antes de que suba el pasajero sólo como
    // orden de lectura; en el mapa la posición real la resuelve la geografía.
    ...(app.driverStops || []).map((p) => ({ etiqueta: 'Pasa por', ...dir(p), delConductor: true })),
    { etiqueta: 'Te subís en', ...dir(tramo.origin) },
    ...paradas,
    { etiqueta: 'Te deja en', ...dir(tramo.destination) },
    app.driverDestination && { etiqueta: 'Sigue hasta', ...dir(app.driverDestination), delConductor: true },
  ].filter((p) => p && p.texto);
};

/**
 * Qué contestó el conductor cuando se postuló: mismo tramo, o recorrido propio.
 *
 * Sin esto, el que hace el mismo tramo se veía EXACTAMENTE igual que si no hubiéramos
 * preguntado nada: dos puntos y listo. No se podía distinguir "este conductor hace justo
 * el tramo pedido" de "no sabemos por dónde va", que es la diferencia que la pregunta vino a
 * responder.
 */
const recorridoElegido = (app) =>
  app.driverOrigin || app.driverDestination || (app.driverStops || []).length > 0
    ? { texto: 'Viene de más lejos o sigue más allá', icono: 'git-branch-outline' }
    : { texto: 'Hace tu mismo tramo', icono: 'swap-horizontal-outline' };

/**
 * Mismo recorrido que `armarRecorrido`, pero con la forma de `trip` que espera TripMapScreen:
 * origen/destino son las puntas más lejanas (las del conductor, si declaró recorrido propio) y
 * el tramo del pasajero —y las paradas que él haya puesto— quedan como paradas intermedias.
 */
const armarTripParaMapa = (app, tramo, driver, vehicle) => {
  if (!tramo?.origin || !tramo?.destination) return null;
  const intermediateStops = [];
  if (app.driverOrigin) intermediateStops.push({ ...tramo.origin, kind: 'pickup', order: 0 });
  // Las paradas propias del pasajero también son puntos del recorrido: sin ellas el mapa
  // trazaba derecho entre sus dos puntas y se salteaba el desvío que él mismo pidió.
  (tramo.intermediateStops || []).forEach((stop, i) => {
    intermediateStops.push({ ...stop, kind: 'stop', order: 1 + i });
  });
  if (app.driverDestination) {
    intermediateStops.push({ ...tramo.destination, kind: 'dropoff', order: 1 + (tramo.intermediateStops || []).length });
  }
  // Las paradas propias del conductor. Sin `passenger`: son escalas de su recorrido.
  (app.driverStops || []).forEach((stop, i) => {
    intermediateStops.push({ ...stop, kind: 'stop', order: 100 + i });
  });
  return {
    origin: app.driverOrigin || tramo.origin,
    destination: app.driverDestination || tramo.destination,
    intermediateStops,
    driver,
    vehicle,
  };
};

module.exports = { armarRecorrido, recorridoElegido, armarTripParaMapa };

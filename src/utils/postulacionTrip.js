/**
 * El recorrido completo del viaje, como lo va a hacer el conductor: sus puntas afuera y el
 * tramo del pasajero en el medio. Los puntos del conductor son opcionales —si no declaró
 * recorrido propio hace el mismo tramo—, y en ese caso se muestran sólo los dos del pasajero.
 *
 * Vive acá porque lo usan DOS pantallas: el pasajero mirando la postulación de un conductor
 * (ApplicationDetailScreen) y el conductor mirando su propia postulación ya enviada
 * (TripRequestDetailScreen). Antes sólo existía en la primera.
 */

const { metersBetween } = require('./routePoints');

// Dirección (línea principal) + ciudad/provincia (línea chica), cuando no son lo mismo.
// Antes era sólo `address || city`: las puntas del conductor tienen una dirección de calle
// sin ciudad al lado, y quedaban sin poder saber en qué ciudad caían.
const dir = (p) => {
  const principal = p?.address || p?.city || '';
  const ciudad = [p?.city, p?.province].filter(Boolean).join(', ');
  return { texto: principal, ciudad: ciudad && ciudad !== principal ? ciudad : '' };
};

/**
 * El recorrido como una sola lista ordenada POR EL CAMINO, no por tipo de punto.
 *
 * Antes se apilaban primero todas las paradas del conductor, después el tramo del pasajero y
 * sus paradas, en ese orden fijo. Quedaba un recorrido imposible: "Sale desde Concordia → Pasa
 * por Santa Fe → Te subís en Concordia" (ida a Santa Fe y vuelta). El mapa lo reordenaba solo
 * (buildRoutePoints/ordenarStops), pero la lista no.
 *
 * Se ordena con vecino más cercano desde la primera punta del conductor, igual que ordenarStops
 * en routePoints. Las puntas ("Sale desde" / "Sigue hasta") quedan fijas en los extremos; todo
 * lo del medio —dónde sube el pasajero, sus paradas, las escalas del conductor— se intercala
 * por geografía. Las "Parada N" se renumeran según el orden final.
 */
const armarRecorrido = (app, tramo) => {
  if (!tramo?.origin || !tramo?.destination) return [];

  const medio = [
    ...(app.driverStops || []).map((p) => ({ tipo: 'driverStop', punto: p })),
    { tipo: 'pickup', punto: tramo.origin },
    ...((tramo.intermediateStops || []).map((p) => ({ tipo: 'pasajeroStop', punto: p }))),
    { tipo: 'dropoff', punto: tramo.destination },
  ];

  const restantes = [...medio];
  const ordenado = [];
  let desde = app.driverOrigin?.coordinates || tramo.origin?.coordinates;
  while (restantes.length) {
    let iMin = 0;
    let dMin = Infinity;
    restantes.forEach((m, i) => {
      const d = metersBetween(desde, m.punto?.coordinates);
      if (d < dMin) { dMin = d; iMin = i; }
    });
    const [elegido] = restantes.splice(iMin, 1);
    ordenado.push(elegido);
    desde = elegido.punto?.coordinates || desde;
  }

  let nParada = 0;
  const filasMedio = ordenado.map((m) => {
    if (m.tipo === 'pickup') return { etiqueta: 'Te subís en', ...dir(m.punto) };
    if (m.tipo === 'dropoff') return { etiqueta: 'Te deja en', ...dir(m.punto) };
    if (m.tipo === 'driverStop') return { etiqueta: 'Pasa por', ...dir(m.punto), delConductor: true };
    nParada += 1;
    return { etiqueta: `Parada ${nParada}`, ...dir(m.punto) };
  });

  return [
    app.driverOrigin && { etiqueta: 'Sale desde', ...dir(app.driverOrigin), delConductor: true },
    ...filasMedio,
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

/**
 * Qué ofreció el conductor por asiento: un precio, o gastos compartidos.
 *
 * Una sola fuente de verdad para las tres pantallas que lo muestran (la lista de
 * postulaciones, el detalle de una postulación y el conductor ya aprobado). La decisión estaba
 * copiada en cada una y no decían lo mismo: la lista contemplaba `sinPrecioFijo` pero el
 * detalle sólo mostraba algo si había precio > 0, así que una postulación con gastos
 * compartidos aparecía en la lista y desaparecía al abrirla.
 *
 * `null` cuando la postulación es vieja y no declaró ninguna de las dos cosas: ahí no hay nada
 * que decir, y es distinto de decir "$0".
 */
const ofertaDelConductor = (app) => {
  if (Number(app?.driverPrice) > 0) {
    return {
      esPrecio: true,
      etiqueta: 'Su precio por asiento',
      texto: `$${Number(app.driverPrice).toLocaleString('es-AR')}`,
      detalle: 'por asiento',
    };
  }
  if (app?.sinPrecioFijo) {
    return {
      esPrecio: false,
      etiqueta: 'Su propuesta',
      texto: 'Gastos compartidos',
      detalle: 'Arreglás los gastos del viaje directo con el conductor',
    };
  }
  return null;
};

module.exports = { armarRecorrido, recorridoElegido, armarTripParaMapa, ofertaDelConductor };

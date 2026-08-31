/**
 * Check de la ruta numerada. Correr: node src/utils/routePoints.test.js
 */
const assert = require('assert');
const { buildRoutePoints, kindLabel, quienLabel } = require('./routePoints');

const origen = { address: '1 de Mayo 447', coordinates: { latitude: -31.3930, longitude: -58.0209 } };
const destino = { address: 'Retiro', coordinates: { latitude: -34.5915, longitude: -58.3745 } };

// El caso real que rompió el mapa: el punto de recogida del pasajero ES la dirección de
// salida (4 metros). Dos marcadores en el mismo lugar y el de arriba tapaba el número 1.
const conParadaEnElOrigen = buildRoutePoints({
  origin: origen,
  destination: destino,
  intermediateStops: [
    { address: '1 de Mayo 447', order: 1, kind: 'pickup', coordinates: { latitude: -31.39303, longitude: -58.02093 } },
  ],
});
assert.strictEqual(conParadaEnElOrigen.length, 2, 'la parada encimada no se muestra');
assert.strictEqual(conParadaEnElOrigen[0].kind, 'origin');
assert.strictEqual(conParadaEnElOrigen[1].kind, 'destination');

// Y una parada de verdad sí entra, en el medio.
const conParadaReal = buildRoutePoints({
  origin: origen,
  destination: destino,
  intermediateStops: [
    { address: 'Gualeguaychú', order: 1, kind: 'dropoff', coordinates: { latitude: -33.0100, longitude: -58.5100 } },
  ],
});
assert.strictEqual(conParadaReal.length, 3);
assert.strictEqual(conParadaReal[1].kind, 'dropoff');

// Lo mismo contra el destino.
const enElDestino = buildRoutePoints({
  origin: origen,
  destination: destino,
  intermediateStops: [{ address: 'Retiro', order: 1, coordinates: { latitude: -34.5916, longitude: -58.3746 } }],
});
assert.strictEqual(enElDestino.length, 2);

// Orden: se respeta `order`, no el orden del array.
const ordenadas = buildRoutePoints({
  origin: origen,
  destination: destino,
  intermediateStops: [
    { address: 'B', order: 2, coordinates: { latitude: -32.5, longitude: -58.4 } },
    { address: 'A', order: 1, coordinates: { latitude: -32.0, longitude: -58.3 } },
  ],
});
assert.deepStrictEqual(ordenadas.slice(1, 3).map((p) => p.location.address), ['A', 'B']);

// Una parada sin coordenadas no se puede comparar: se muestra igual, no se descarta en
// silencio. Perder una parada del recorrido es peor que mostrar una de más.
const sinCoords = buildRoutePoints({
  origin: origen,
  destination: destino,
  intermediateStops: [{ address: 'Parada vieja', order: 1 }],
});
assert.strictEqual(sinCoords.length, 3);

// Un viaje a medio cargar no puede romper la pantalla.
assert.strictEqual(buildRoutePoints({}).length, 2);
assert.strictEqual(buildRoutePoints(undefined).length, 2);

// Etiquetas
assert.strictEqual(kindLabel('pickup'), 'Recogida');
assert.strictEqual(kindLabel('dropoff'), 'Bajada');
assert.strictEqual(kindLabel('stop'), '');
assert.strictEqual(quienLabel('dropoff', { firstName: 'Ana' }), 'A dejar a Ana');
assert.strictEqual(quienLabel('pickup', { firstName: 'Ana' }), 'A recoger a Ana');
assert.strictEqual(quienLabel('pickup', null), '');

// El caso que reportó el usuario: dos reservas del mismo viaje Concordia -> Buenos Aires.
// Por orden de pago quedaba Concordia, CABA, Concordia, CABA — el conductor volvía 900km
// para atrás a buscar al segundo pasajero. Sin trazado guardado, ordena por el eje.
const concordia = { latitude: -31.3930, longitude: -58.0209 };
const caba = { latitude: -34.6037, longitude: -58.3821 };

const dosReservas = buildRoutePoints({
  origin: { address: 'Esteban Echeverría 1180', coordinates: concordia },
  destination: { address: 'Av. Santa Fe', coordinates: caba },
  intermediateStops: [
    { address: 'Hipólito Yrigoyen 512', order: 1, kind: 'pickup', coordinates: { latitude: -31.3900, longitude: -58.0180 } },
    { address: 'Ramón Freire', order: 2, kind: 'dropoff', coordinates: { latitude: -34.5600, longitude: -58.4600 } },
    { address: 'Liniers 268', order: 3, kind: 'pickup', coordinates: { latitude: -31.3880, longitude: -58.0150 } },
    { address: 'Acuña de Figueroa', order: 4, kind: 'dropoff', coordinates: { latitude: -34.6000, longitude: -58.4200 } },
  ],
});

// Lo que importa: las dos recogidas de Concordia van JUNTAS y antes que las dos bajadas de
// Buenos Aires. Nunca se vuelve 900km para atrás. El orden entre las dos recogidas entre sí
// no se fija: están a 400m una de otra y a esa escala es indistinto.
const kinds = dosReservas.map((p) => p.kind);
assert.deepStrictEqual(kinds, ['origin', 'pickup', 'pickup', 'dropoff', 'dropoff', 'destination'],
  `quedó: ${dosReservas.map((p) => p.location.address).join(' | ')}`);

const direcciones = dosReservas.map((p) => p.location.address);
assert.strictEqual(direcciones[0], 'Esteban Echeverría 1180');
assert.strictEqual(direcciones[5], 'Av. Santa Fe');
assert.deepStrictEqual(direcciones.slice(1, 3).sort(), ['Hipólito Yrigoyen 512', 'Liniers 268']);
assert.deepStrictEqual(direcciones.slice(3, 5).sort(), ['Acuña de Figueroa', 'Ramón Freire']);

// Una parada sin coordenadas no puede colarse en el medio ni romper el orden: va al final,
// antes del destino, porque no hay con qué ubicarla.
const conHuerfana = buildRoutePoints({
  origin: { address: 'A', coordinates: concordia },
  destination: { address: 'Z', coordinates: caba },
  intermediateStops: [
    { address: 'sin coords', order: 1 },
    { address: 'media', order: 2, coordinates: { latitude: -33.0, longitude: -58.5 } },
  ],
});
assert.deepStrictEqual(conHuerfana.map((p) => p.location.address), ['A', 'media', 'sin coords', 'Z']);

// El caso "hago tu mismo recorrido": el viaje nace de una solicitud, y tripRequestController
// agrega SIEMPRE la recogida y la bajada del pasajero. Sin recorrido propio del conductor, esas
// dos son el mismo punto que las puntas del viaje y la dirección salía repetida.
const mismoRecorrido = buildRoutePoints({
  origin: { address: 'Mariano Moreno 1071', coordinates: concordia },
  destination: { address: 'Av. Santa Fe 900', coordinates: caba },
  intermediateStops: [
    { address: 'Mariano Moreno 1071', kind: 'pickup', order: 1, coordinates: concordia, passenger: { firstName: 'Benjamín' } },
    { address: 'Av. Santa Fe 900', kind: 'dropoff', order: 2, coordinates: caba, passenger: { firstName: 'Benjamín' } },
  ],
});
assert.deepStrictEqual(
  mismoRecorrido.map((p) => p.location.address),
  ['Mariano Moreno 1071', 'Av. Santa Fe 900'],
  `no debería repetir direcciones: ${mismoRecorrido.map((p) => p.location.address).join(' | ')}`
);
// Fusionar no puede perder de quién es la parada: el conductor tiene que seguir sabiendo
// quién sube y quién baja en cada punta.
assert.strictEqual(mismoRecorrido[0].passenger?.firstName, 'Benjamín');
assert.strictEqual(mismoRecorrido[0].kindFusionado, 'pickup');
assert.strictEqual(mismoRecorrido[1].passenger?.firstName, 'Benjamín');
assert.strictEqual(mismoRecorrido[1].kindFusionado, 'dropoff');

// Pero una parada que el usuario cargó a media cuadra NO se fusiona: es su dirección, y
// ocultarla es el bug que el filtro de 150m causaba antes.
const aMediaCuadra = buildRoutePoints({
  origin: { address: 'Mariano Moreno 1071', coordinates: concordia },
  destination: { address: 'Av. Santa Fe 900', coordinates: caba },
  intermediateStops: [
    // ~110 m al norte
    { address: 'Mariano Moreno 1150', kind: 'pickup', order: 1, coordinates: { latitude: concordia.latitude + 0.001, longitude: concordia.longitude } },
  ],
});
assert.deepStrictEqual(
  aMediaCuadra.map((p) => p.location.address),
  ['Mariano Moreno 1071', 'Mariano Moreno 1150', 'Av. Santa Fe 900']
);

// Mismo recorrido pero la recogida geocodificó ~40 m aparte de la salida (pasa seguido): el
// filtro por distancia (15 m) no la fusiona, pero la calle y número son idénticos.
const mismoRecorridoGeoDrift = buildRoutePoints({
  origin: { address: 'Damián P. Garat 1061', coordinates: concordia },
  destination: { address: 'Mendoza, Capital, Mendoza', coordinates: caba },
  intermediateStops: [
    {
      address: 'Damián P. Garat 1061', kind: 'pickup', order: 1,
      coordinates: { latitude: concordia.latitude + 0.00035, longitude: concordia.longitude },
      passenger: { firstName: 'Benjamín' },
    },
    {
      address: 'Mendoza, Capital, Mendoza', kind: 'dropoff', order: 2,
      coordinates: { latitude: caba.latitude - 0.00035, longitude: caba.longitude },
      passenger: { firstName: 'Benjamín' },
    },
  ],
});
assert.deepStrictEqual(
  mismoRecorridoGeoDrift.map((p) => p.location.address),
  ['Damián P. Garat 1061', 'Mendoza, Capital, Mendoza'],
  `misma dirección + drift de geocoding no debería repetir: ${mismoRecorridoGeoDrift.map((p) => p.location.address).join(' | ')}`
);
assert.strictEqual(mismoRecorridoGeoDrift[0].kindFusionado, 'pickup');
assert.strictEqual(mismoRecorridoGeoDrift[1].kindFusionado, 'dropoff');

console.log('✅ routePoints: todos los checks pasaron');

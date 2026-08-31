/**
 * Check del orden del recorrido de una postulación.
 * Correr con: node src/utils/postulacionTrip.test.js
 *
 * El caso que importa: el conductor sale de Concordia, tiene una parada en Santa Fe y va a
 * Mendoza; el pasajero sube y baja en el medio. La lista antes salía en orden fijo (todas las
 * paradas del conductor primero) y quedaba "Concordia → Santa Fe → Concordia", una ida y vuelta
 * imposible.
 */
const assert = require('assert');
const { armarRecorrido } = require('./postulacionTrip');

const C = (lat, lng) => ({ latitude: lat, longitude: lng });
// Coordenadas aproximadas reales
const concordia = C(-31.39, -58.02);
const santaFe   = C(-31.63, -60.70);
const cordoba   = C(-31.42, -64.18);
const mendoza   = C(-32.89, -68.84);

const app = {
  driverOrigin:      { address: 'Concejal Veiga 3024', city: 'Concordia', province: 'Entre Ríos', coordinates: concordia },
  driverDestination: { address: 'Eva Duarte 1726', city: 'Las Heras', province: 'Mendoza', coordinates: C(-32.85, -68.83) },
  driverStops: [
    { address: 'Ntra Sra de la Paz 236', city: 'Villa Gob. Gálvez', province: 'Santa Fe', coordinates: santaFe },
  ],
};
const tramo = {
  origin:      { address: 'Bolivia 729', city: 'Concordia', province: 'Entre Ríos', coordinates: C(-31.40, -58.03) },
  destination: { address: 'Mendoza Capital', city: 'Mendoza', province: 'Mendoza', coordinates: mendoza },
  intermediateStops: [
    { address: 'Colón 828', city: 'Concordia', province: 'Entre Ríos', coordinates: C(-31.395, -58.025) },
    { address: '1 de Mayo 2011', city: 'Godoy Cruz', province: 'Mendoza', coordinates: C(-32.92, -68.85) },
  ],
};

const filas = armarRecorrido(app, tramo);
const ciudades = filas.map((f) => f.ciudad || f.texto);

// Primera y última son las puntas del conductor, siempre.
assert.strictEqual(filas[0].etiqueta, 'Sale desde');
assert.strictEqual(filas[filas.length - 1].etiqueta, 'Sigue hasta');

// El orden geográfico: todo lo de Concordia junto, después Santa Fe, después Mendoza.
// NUNCA se vuelve a Concordia después de haber salido hacia Santa Fe.
const iSantaFe = filas.findIndex((f) => (f.ciudad || '').includes('Santa Fe'));
const ultimaConcordia = filas.map((f) => (f.ciudad || '').includes('Concordia')).lastIndexOf(true);
assert.ok(iSantaFe > ultimaConcordia,
  `Santa Fe (${iSantaFe}) tiene que ir DESPUÉS de la última de Concordia (${ultimaConcordia}). Quedó: ${ciudades.join(' → ')}`);

// Las paradas del pasajero renumeradas en orden.
const nums = filas.filter((f) => f.etiqueta.startsWith('Parada')).map((f) => f.etiqueta);
assert.deepStrictEqual(nums, nums.slice().sort(), `las Parada N tienen que quedar en orden: ${nums}`);

// Sin recorrido propio del conductor: sólo las dos puntas del pasajero.
const simple = armarRecorrido({}, { origin: tramo.origin, destination: tramo.destination });
assert.deepStrictEqual(simple.map((f) => f.etiqueta), ['Te subís en', 'Te deja en']);

console.log('✅ postulacionTrip: recorrido ordenado por el camino');

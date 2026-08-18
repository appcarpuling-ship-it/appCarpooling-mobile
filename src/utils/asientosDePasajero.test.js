/**
 * Check de cuántos asientos ocupa un pasajero.
 * Correr: node src/utils/asientosDePasajero.test.js
 *
 * Lo que cubre: `passengers` tiene una entrada POR ASIENTO, y sus entradas pueden venir
 * pobladas o como id suelto según el endpoint. Comparar las dos formas con === da siempre
 * false, y el resultado sería "no le cobres nada" sin que nada avise.
 */
const assert = require('assert');
const { asientosDePasajero } = require('./asientosDePasajero');

const ANA = '64f000000000000000000001';
const LUIS = '64f000000000000000000002';

// Una entrada por asiento: Ana reservó 3, Luis 1.
const viaje = { passengers: [ANA, ANA, ANA, LUIS] };

assert.strictEqual(asientosDePasajero(viaje, ANA), 3);
assert.strictEqual(asientosDePasajero(viaje, LUIS), 1);

// Poblado: el pasajero llega como objeto y las entradas como id suelto.
assert.strictEqual(asientosDePasajero(viaje, { _id: ANA, firstName: 'Ana' }), 3);

// Y al revés: las entradas pobladas y el pasajero como id.
const viajePoblado = { passengers: [{ _id: ANA }, { _id: ANA }, { _id: LUIS }] };
assert.strictEqual(asientosDePasajero(viajePoblado, ANA), 2);
assert.strictEqual(asientosDePasajero(viajePoblado, { _id: LUIS }), 1);

// Piso de 1: si está en el viaje pero no figura en la lista, igual ocupa un asiento. Devolver
// 0 haría que el conductor no le cobre nada, que es peor que cobrarle de más por un asiento.
assert.strictEqual(asientosDePasajero(viaje, '64f000000000000000000009'), 1);
assert.strictEqual(asientosDePasajero({ passengers: [] }, ANA), 1);
assert.strictEqual(asientosDePasajero({}, ANA), 1);
assert.strictEqual(asientosDePasajero(undefined, ANA), 1);

// Sin pasajero no se puede contar nada: 1, nunca 0 ni NaN.
assert.strictEqual(asientosDePasajero(viaje, undefined), 1);
assert.strictEqual(asientosDePasajero(viaje, null), 1);
assert.strictEqual(asientosDePasajero(viaje, ''), 1);

// Entradas basura en la lista no cuentan como coincidencia.
assert.strictEqual(asientosDePasajero({ passengers: [null, undefined, ANA] }, ANA), 1);

console.log('✅ asientosDePasajero: todos los checks pasaron');

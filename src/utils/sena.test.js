/**
 * Espejo del test del backend: la regla de la seña tiene que dar lo mismo de los dos lados.
 * Correr con: node src/utils/sena.test.js
 */
const assert = require('assert');
const { montoSena, senaLegible } = require('./sena');

assert.strictEqual(montoSena(10000, 1), 5000);
assert.strictEqual(montoSena(10000, 3), 15000, 'la mitad del total, no de un asiento');
assert.strictEqual(montoSena(1500), 750, 'sin asientos asume uno');
assert.strictEqual(montoSena(1501, 1), 751, 'redondea');

// Gastos compartidos manda driverPrice en 0: no hay seña posible.
assert.strictEqual(montoSena(0, 2), 0);
assert.strictEqual(montoSena(null, 2), 0);
assert.strictEqual(montoSena(NaN, 2), 0, 'un NaN no se propaga a la pantalla');
assert.strictEqual(montoSena(10000, 0), 0);

// senaLegible devuelve '' y no '$0': la pantalla lo usa para decidir si muestra la fila.
assert.strictEqual(senaLegible(0), '');
assert.strictEqual(senaLegible(10000, 1), '$5.000');

console.log('✅ sena: todos los checks pasaron');

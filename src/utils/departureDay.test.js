/**
 * Check del día de calendario que se manda al crear una solicitud de viaje.
 * Correr: node src/utils/departureDay.test.js
 *
 * El bug que cubre: en UTC-3, una solicitud para hoy a las 22:00 se guardaba como las
 * 01:00 UTC de mañana, y tanto la pantalla (que formatea con timeZone UTC) como los
 * filtros del backend la trataban como del día siguiente.
 */
const assert = require('assert');

// Misma expresión que usa TripRequestDetailsScreen.handleSubmit.
const departureDayISO = (date) =>
  new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())).toISOString();

// Un Date local: el picker devuelve exactamente esto, con la hora del dispositivo.
const local = (y, m, d, hh, mm) => new Date(y, m - 1, d, hh, mm, 0, 0);

// El caso reportado: domingo 9 a la noche no puede convertirse en lunes 10.
assert.strictEqual(departureDayISO(local(2026, 8, 9, 22, 0)), '2026-08-09T00:00:00.000Z');

// Ni siquiera el último minuto del día, que es donde el desfase de UTC-3 pega más fuerte.
assert.strictEqual(departureDayISO(local(2026, 8, 9, 23, 59)), '2026-08-09T00:00:00.000Z');

// La primera hora tampoco puede caer en el día anterior (el bug simétrico, en UTC+X).
assert.strictEqual(departureDayISO(local(2026, 8, 9, 0, 1)), '2026-08-09T00:00:00.000Z');

// La hora del día no cambia nada: la lleva departureTime, no este campo.
const mismoDia = [0, 6, 12, 18, 23].map((h) => departureDayISO(local(2026, 8, 9, h, 30)));
assert.strictEqual(new Set(mismoDia).size, 1);

// Siempre medianoche exacta: los filtros del backend comparan contra el inicio del día.
assert.ok(departureDayISO(local(2026, 12, 31, 21, 45)).endsWith('T00:00:00.000Z'));

// Fin de año, que es donde un off-by-one cambia también el año.
assert.strictEqual(departureDayISO(local(2026, 12, 31, 22, 0)), '2026-12-31T00:00:00.000Z');

console.log('departureDay: OK');

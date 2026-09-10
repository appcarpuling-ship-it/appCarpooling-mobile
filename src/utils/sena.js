/**
 * La seña es SIEMPRE la mitad de lo que ese pasajero va a pagar.
 *
 * Espejo de `backend/src/utils/sena.js` — acá hace falta para la vista previa mientras el
 * conductor publica ("Seña: $7.500") y para mostrarla en el detalle. El server la vuelve a
 * derivar por su cuenta y es el que manda; esto nunca se envía como dato.
 * Si cambia la regla, cambian los dos.
 *
 * CommonJS como el resto de utils/ (routePoints, postulacionTrip): las pantallas lo importan
 * con `import {}` —babel hace la interop— y los tests lo corren con `node` plano, que no
 * puede requerir un módulo con `export`.
 */

/**
 * @param {number} precioPorAsiento lo que cobra el conductor por asiento (`driverPrice`)
 * @param {number} [asientos=1]     cuántos asientos toma el pasajero
 * @returns {number} monto de la seña, entero. 0 si no hay precio (gastos compartidos).
 */
const montoSena = (precioPorAsiento, asientos = 1) => {
  const precio = Number(precioPorAsiento);
  const n = Number(asientos);
  if (!Number.isFinite(precio) || precio <= 0) return 0;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round((precio * n) / 2);
};

/** `$7.500`, o '' si no hay seña que mostrar. */
const senaLegible = (precioPorAsiento, asientos = 1) => {
  const m = montoSena(precioPorAsiento, asientos);
  return m > 0 ? `$${m.toLocaleString('es-AR')}` : '';
};

module.exports = { montoSena, senaLegible };

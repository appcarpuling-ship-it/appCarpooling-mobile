/**
 * Cuántos asientos ocupa UN pasajero en un viaje.
 *
 * `trip.passengers` guarda una entrada POR ASIENTO, no por pasajero único: alguien que reservó
 * 3 asientos aparece 3 veces. Es la convención de todo el proyecto y romperla ya causó bugs de
 * conteo y de notificaciones duplicadas, así que la cuenta vive acá una sola vez.
 *
 * Se compara como string porque las entradas pueden venir pobladas (`{_id, firstName, …}`) o
 * como ObjectId suelto según el endpoint, y `===` entre esas dos formas siempre da false —
 * fallando en silencio hacia "0 asientos" en vez de romper ruidosamente.
 */

const mismoId = (a, b) => {
  const ida = String(a?._id || a || '');
  const idb = String(b?._id || b || '');
  return !!ida && ida === idb;
};

/**
 * @param {Object} trip - el viaje, con su array `passengers`
 * @param {Object|String} pasajero - el pasajero (poblado o su id)
 * @returns {Number} asientos que ocupa; 1 como piso, porque un pasajero que está en el viaje
 *          ocupa al menos un asiento y devolver 0 haría que no se le cobre nada.
 */
const asientosDePasajero = (trip, pasajero) => {
  const id = String(pasajero?._id || pasajero || '');
  if (!id) return 1;
  const n = (trip?.passengers || []).filter((p) => mismoId(p, id)).length;
  return n > 0 ? n : 1;
};

module.exports = { asientosDePasajero };

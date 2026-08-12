/**
 * Utilidades para mostrar disponibilidad de asientos/cupos en viajes.
 * Usadas en HomeScreen, SearchResults, AllTrips, TripDetail, etc.
 */

/**
 * Devuelve los asientos restantes reales de un viaje.
 * Usa `remainingSeats` del backend si existe, sino calcula availableSeats - occupiedSeats.
 */
export function tripRemainingSeats(trip) {
  if (!trip) return 0;
  // Preferir el virtual del backend (incluye pendingSeatHolds)
  if (trip.remainingSeats != null && !Number.isNaN(Number(trip.remainingSeats))) {
    return Math.max(0, Number(trip.remainingSeats));
  }
  const cap = Number(trip.availableSeats ?? 0);
  const occ = Number(trip.occupiedSeats ?? trip.passengers?.length ?? 0);
  const holds = Number(trip.pendingSeatHolds ?? 0);
  return Math.max(0, cap - occ - holds);
}

/**
 * Asientos a MOSTRAR. Muestra lo mismo que el guard: una reserva pendiente ya
 * baja el número visible (si no, reservás y el viaje sigue diciendo "2/2 libres").
 */
export const tripDisplaySeats = tripRemainingSeats;

/**
 * Devuelve la capacidad total del vehículo para el viaje.
 */
export function tripSeatCapacity(trip) {
  if (trip?.tripCapacity != null) return Math.max(0, Number(trip.tripCapacity));
  return Math.max(0, Number(trip?.availableSeats ?? 0));
}

/**
 * El texto de asientos que va en pantalla.
 *
 * Un viaje nacido de una solicitud no tiene disponibilidad que mostrar: nace cerrado entre el
 * pasajero que lo pidió y el conductor que se postuló, no aparece en los listados públicos y
 * nadie más puede reservarlo. Decir "0/2 libres" o "Completo" sugiere que en algún momento
 * hubo lugar y que ahora se llenó, y ninguna de las dos cosas pasó. Se dice cuántos asientos
 * son y listo.
 *
 * Para un viaje publicado por un conductor sí importa la disponibilidad, y ahí va el x/y.
 */
export function tripSeatsLabel(trip) {
  if (!trip) return '';

  if (trip.fromTripRequest) {
    const n = Number(trip.availableSeats ?? trip.passengers?.length ?? 0);
    return `${n} asiento${n !== 1 ? 's' : ''}`;
  }

  const libres = tripDisplaySeats(trip);
  const cap = tripSeatCapacity(trip);
  return `${libres}/${cap} libres`;
}

/**
 * Devuelve una etiqueta corta del vehículo: "Toyota Corolla" o "".
 */
export function vehicleShortLabel(vehicle) {
  if (!vehicle) return '';
  return [vehicle.brand, vehicle.model].filter(Boolean).join(' ').trim();
}

/**
 * Genera una línea de texto descriptiva de disponibilidad.
 *
 * Ejemplos:
 *   Disponible → "3 de 4 plazas libres en el vehículo · Toyota Corolla"
 *   Completo   → "Completo (4 plazas) · Toyota Corolla"
 */
export function formatTripAvailabilityLine(trip) {
  if (!trip) return '';

  const rem = tripRemainingSeats(trip);
  const cap = tripSeatCapacity(trip);
  const veh = vehicleShortLabel(trip.vehicle);
  const vehSuffix = veh ? ` · ${veh}` : '';

  if (rem === 0) {
    return cap > 0
      ? `Completo (${cap} plaza${cap !== 1 ? 's' : ''})${vehSuffix}`
      : `Sin plazas libres${vehSuffix}`;
  }

  return `${rem} de ${cap} plaza${cap !== 1 ? 's' : ''} libres en el vehículo${vehSuffix}`;
}

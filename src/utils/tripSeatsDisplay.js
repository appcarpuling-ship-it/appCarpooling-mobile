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
 * Devuelve la capacidad total del vehículo para el viaje.
 */
export function tripSeatCapacity(trip) {
  return Math.max(0, Number(trip?.availableSeats ?? 0));
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
 *   Carpooling → "3 de 4 plazas libres en el vehículo · Toyota Corolla"
 *   Courier    → "2 cupos disponibles · Volkswagen Caddy"
 *   Completo   → "Completo (4 plazas) · Toyota Corolla"
 */
export function formatTripAvailabilityLine(trip) {
  if (!trip) return '';

  const rem = tripRemainingSeats(trip);
  const cap = tripSeatCapacity(trip);
  const veh = vehicleShortLabel(trip.vehicle);
  const vehSuffix = veh ? ` · ${veh}` : '';

  if (trip.serviceType === 'courier') {
    if (rem === 0) return `Sin cupos libres${vehSuffix}`;
    if (rem === 1) return `1 cupo disponible${vehSuffix}`;
    return `${rem} cupos disponibles${vehSuffix}`;
  }

  if (rem === 0) {
    return cap > 0
      ? `Completo (${cap} plaza${cap !== 1 ? 's' : ''})${vehSuffix}`
      : `Sin plazas libres${vehSuffix}`;
  }

  return `${rem} de ${cap} plaza${cap !== 1 ? 's' : ''} libres en el vehículo${vehSuffix}`;
}

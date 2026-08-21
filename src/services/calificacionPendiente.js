import { navigationRef } from '../navigation/rootNavigation';
import { get_withauth } from '../services/apiService';
import { ENDPOINTS } from '../config/api';

/**
 * Empujar la pantalla de calificación pendiente.
 *
 * Se usa desde dos lados y por eso vive acá:
 *  - `PendingReviewGate`, al abrir la app o al volver del background (el que se fue sin
 *    calificar).
 *  - El mapa del viaje, cuando el conductor lo completa y el pasajero está mirando: ahí
 *    hay que sacarlo del mapa de un viaje terminado y llevarlo a calificar en el momento,
 *    que es cuando se acuerda de cómo estuvo.
 *
 * Tener la misma navegación escrita en dos lugares es cómo terminan divergiendo: uno manda
 * parámetros que el otro no, y la pantalla se rompe sólo por uno de los dos caminos.
 */

// Módulo y no por componente: los dos llamadores tienen que compartir el mismo "ya empujé",
// si no el gate reabre la pantalla encima de la que abrió el mapa.
let yaEmpujado = false;

/** Al cerrar sesión, para que el próximo usuario arranque limpio. */
export function reiniciarCalificacionPendiente() {
  yaEmpujado = false;
}

/**
 * @param {Object} [opts]
 * @param {boolean} [opts.forzar] Ignora el "ya empujé". Lo usa el mapa: que el viaje se
 *   complete es un evento nuevo, no la misma sesión de siempre.
 * @param {number} [opts.reintentos] El backend crea la calificación pendiente al completar
 *   el viaje. Si se pregunta demasiado rápido puede no estar todavía.
 * @returns {Promise<boolean>} true si se empujó la pantalla
 */
export async function empujarCalificacionPendiente({ forzar = false, reintentos = 0 } = {}) {
  if (yaEmpujado && !forzar) return false;

  for (let intento = 0; intento <= reintentos; intento++) {
    try {
      const res = await get_withauth(ENDPOINTS.PENDING_REVIEWS);
      const viaje = res?.data?.[0];

      if (viaje?.driver && navigationRef.isReady()) {
        yaEmpujado = true;
        navigationRef.navigate('CarpoolingsTab', {
          screen: 'CreateReviewFromTrip',
          initial: false,
          params: { trip: viaje, reviewedUser: viaje.driver, reviewType: 'driver' },
        });
        return true;
      }
    } catch {
      /* sin red o sin sesión: no se molesta al usuario */
    }
    if (intento < reintentos) await new Promise((r) => setTimeout(r, 1500));
  }

  return false;
}

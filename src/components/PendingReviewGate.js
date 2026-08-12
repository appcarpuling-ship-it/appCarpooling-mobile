import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { navigationRef } from '../navigation/rootNavigation';
import { get_withauth } from '../services/apiService';
import { ENDPOINTS } from '../config/api';
import { useAuth } from '../context/AuthContext';

/**
 * Calificar es obligatorio: si el pasajero cerró la app sin puntuar al conductor, al volver a
 * abrirla se le presenta la pantalla de calificación.
 *
 * No renderiza nada; sólo empuja la navegación. Va acá y no dentro de una pantalla porque
 * tiene que correr sin importar en qué parte de la app quedó el usuario.
 *
 * ponytail: pendiente por viaje, uno por vez. Si alguien acumula tres viajes sin calificar,
 * al enviar el primero la pantalla se cierra y el siguiente aparece en la próxima apertura,
 * no encadenado. Encadenarlos es peor: tres pantallas seguidas al abrir la app espantan.
 */
export default function PendingReviewGate() {
  const { isAuthenticated } = useAuth();
  // Una sola vez por sesión: sin esto, volver del background reabriría la pantalla encima
  // de sí misma.
  const yaEmpujado = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) { yaEmpujado.current = false; return undefined; }

    let cancelado = false;

    const revisar = async () => {
      if (yaEmpujado.current) return;
      try {
        const res = await get_withauth(ENDPOINTS.PENDING_REVIEWS);
        const viaje = res?.data?.[0];
        if (cancelado || !viaje?.driver) return;
        if (!navigationRef.isReady()) return;

        yaEmpujado.current = true;
        navigationRef.navigate('CarpoolingsTab', {
          screen: 'CreateReviewFromTrip',
          initial: false,
          params: { trip: viaje, reviewedUser: viaje.driver, reviewType: 'driver' },
        });
      } catch {
        /* sin red o sin sesión: no se molesta al usuario */
      }
    };

    // Un respiro para que el navegador termine de montar antes de empujar nada.
    const t = setTimeout(revisar, 1200);
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') revisar();
    });

    return () => { cancelado = true; clearTimeout(t); sub.remove(); };
  }, [isAuthenticated]);

  return null;
}

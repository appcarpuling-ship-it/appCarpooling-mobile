import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import {
  empujarCalificacionPendiente,
  reiniciarCalificacionPendiente,
} from '../services/calificacionPendiente';

/**
 * Calificar es obligatorio: si el pasajero cerró la app sin puntuar al conductor, al volver a
 * abrirla se le presenta la pantalla de calificación.
 *
 * No renderiza nada; sólo empuja la navegación. Va acá y no dentro de una pantalla porque
 * tiene que correr sin importar en qué parte de la app quedó el usuario.
 *
 * La navegación en sí vive en services/calificacionPendiente, compartida con el mapa del
 * viaje: cuando el conductor completa mientras el pasajero está mirando, se lo lleva a
 * calificar en el momento en vez de esperar a la próxima apertura.
 *
 * ponytail: pendiente por viaje, uno por vez. Si alguien acumula tres viajes sin calificar,
 * al enviar el primero la pantalla se cierra y el siguiente aparece en la próxima apertura,
 * no encadenado. Encadenarlos es peor: tres pantallas seguidas al abrir la app espantan.
 */
export default function PendingReviewGate() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) {
      reiniciarCalificacionPendiente();
      return undefined;
    }

    // Un respiro para que el navegador termine de montar antes de empujar nada.
    const t = setTimeout(() => empujarCalificacionPendiente(), 1200);
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') empujarCalificacionPendiente();
    });

    return () => { clearTimeout(t); sub.remove(); };
  }, [isAuthenticated]);

  return null;
}

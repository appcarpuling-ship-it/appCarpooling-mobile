import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, tunnelExtraHeaders } from '../config/api';

/**
 * Seguimiento de la ubicación del conductor con la app en SEGUNDO PLANO.
 *
 * Por qué no alcanza con el socket: cuando el conductor minimiza la app, iOS la suspende y
 * corta la conexión, y Android la mata apenas hay presión de memoria. El pasajero se
 * quedaba mirando la última posición de antes de minimizar, sin forma de saberlo.
 *
 * Esta tarea corre en un contexto de JS APARTE del de la app: no ve el estado de React, ni
 * los contextos, ni el socket. Todo lo que necesita —a qué viaje reportar y con qué token—
 * lo lee de AsyncStorage, y reporta por HTTP al endpoint POST /api/trips/:id/location, que
 * del otro lado retransmite por socket a los pasajeros (que sí están en primer plano).
 *
 * Se arranca al iniciar el viaje y se corta al completarlo. Nunca queda corriendo sola: es
 * la diferencia entre una app que cuida la batería y una que la gente desinstala.
 */

export const TAREA_UBICACION = 'carpuling-ubicacion-viaje';
const CLAVE_VIAJE = 'ubicacionBackground:tripId';

/** Mismo criterio que el seguimiento en primer plano, para que el trazado no cambie de ritmo. */
const DISTANCIA_M = 25;
const INTERVALO_MS = 8000;

TaskManager.defineTask(TAREA_UBICACION, async ({ data, error }) => {
  if (error) {
    console.warn('[ubicacionBackground] error de la tarea:', error.message);
    return;
  }
  const ubicacion = data?.locations?.[data.locations.length - 1];
  if (!ubicacion?.coords) return;

  try {
    const [tripId, token] = await Promise.all([
      AsyncStorage.getItem(CLAVE_VIAJE),
      AsyncStorage.getItem('token'),
    ]);
    // Sin viaje o sin sesión no hay nada que reportar, y además significa que la tarea
    // quedó viva de más: se corta sola.
    if (!tripId || !token) {
      await detenerSeguimiento();
      return;
    }

    const { latitude, longitude, heading } = ubicacion.coords;
    const res = await fetch(`${API_CONFIG.BASE_URL}/trips/${tripId}/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...tunnelExtraHeaders(),
      },
      body: JSON.stringify({ latitude, longitude, heading }),
    });

    // 404 = el viaje ya no está en curso (se completó mientras la tarea seguía viva).
    // Cortarla acá evita quedar reportando a un viaje terminado hasta que el SO la mate.
    if (res.status === 404) await detenerSeguimiento();
  } catch (e) {
    // Sin señal o servidor caído: se ignora. La próxima posición vuelve a intentar, y el
    // seguimiento en primer plano cubre el hueco apenas el conductor vuelva a la app.
    console.warn('[ubicacionBackground] no se pudo reportar:', e?.message);
  }
});

/**
 * Pide el permiso de ubicación en segundo plano.
 * Es un permiso APARTE del de primer plano y hay que pedirlo después: iOS no muestra la
 * opción "Siempre" si nunca se otorgó el "Mientras se usa".
 *
 * @returns {Promise<boolean>}
 */
export async function pedirPermisoBackground() {
  const { status: enUso } = await Location.requestForegroundPermissionsAsync();
  if (enUso !== 'granted') return false;
  const { status } = await Location.requestBackgroundPermissionsAsync();
  return status === 'granted';
}

/** ¿Está corriendo ahora mismo? */
export async function seguimientoActivo() {
  try {
    return await Location.hasStartedLocationUpdatesAsync(TAREA_UBICACION);
  } catch {
    return false;
  }
}

/**
 * Arranca el seguimiento para un viaje. Idempotente: si ya estaba corriendo para el mismo
 * viaje no hace nada.
 *
 * @param {string} tripId
 * @returns {Promise<boolean>} false si el permiso no está dado
 */
export async function iniciarSeguimiento(tripId) {
  if (!tripId) return false;

  const permitido = await pedirPermisoBackground();
  if (!permitido) return false;

  const anterior = await AsyncStorage.getItem(CLAVE_VIAJE);
  if (anterior === String(tripId) && (await seguimientoActivo())) return true;

  await AsyncStorage.setItem(CLAVE_VIAJE, String(tripId));

  await Location.startLocationUpdatesAsync(TAREA_UBICACION, {
    accuracy: Location.Accuracy.Balanced,
    distanceInterval: DISTANCIA_M,
    timeInterval: INTERVALO_MS,
    // Android exige mostrar una notificación permanente mientras se sigue la ubicación en
    // segundo plano. No es opcional: sin esto el sistema mata el servicio. Se aprovecha para
    // que el conductor vea que está activo y no sea una sorpresa.
    foregroundService: {
      notificationTitle: 'Viaje en curso',
      notificationBody: 'Tus pasajeros están viendo dónde estás.',
      notificationColor: '#000000',
    },
    // iOS: sin esto el sistema muestra la barra azul de "ubicación en uso" de forma
    // intermitente y puede pausar las actualizaciones al detectar que no hay movimiento.
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    activityType: Location.ActivityType.AutomotiveNavigation,
  });

  return true;
}

/** Corta el seguimiento y se olvida del viaje. Seguro de llamar aunque no esté corriendo. */
export async function detenerSeguimiento() {
  try {
    if (await seguimientoActivo()) {
      await Location.stopLocationUpdatesAsync(TAREA_UBICACION);
    }
  } catch (e) {
    console.warn('[ubicacionBackground] no se pudo detener:', e?.message);
  }
  await AsyncStorage.removeItem(CLAVE_VIAJE).catch(() => {});
}

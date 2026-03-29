import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Punto central para invalidar sesión (token expirado / 401) sin depender de React.
 * AuthProvider registra el mismo flujo que logout (push, socket, storage, estado).
 */
let onSessionInvalid = null;
let handling = false;

export function registerSessionInvalidHandler(handler) {
  onSessionInvalid = typeof handler === 'function' ? handler : null;
}

export async function notifySessionInvalid() {
  if (handling) return;
  handling = true;
  try {
    if (onSessionInvalid) {
      await onSessionInvalid();
    } else {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
  } finally {
    handling = false;
  }
}

/**
 * Errores de socket que indican JWT inválido o usuario inexistente en el servidor.
 */
export function isSocketAuthFailure(message) {
  if (!message || typeof message !== 'string') return false;
  const m = message.toLowerCase();
  return (
    m.includes('user not found') ||
    m.includes('usuario no encontrado') ||
    m.includes('unauthorized') ||
    m.includes('no autorizado') ||
    m.includes('invalid token') ||
    m.includes('token inválido') ||
    m.includes('jwt')
  );
}

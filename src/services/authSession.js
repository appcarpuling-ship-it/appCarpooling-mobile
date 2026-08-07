import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Punto central para invalidar sesión (token expirado / 401) sin depender de React.
 * AuthProvider registra el mismo flujo que logout (push, socket, storage, estado).
 */
let onSessionInvalid = null;
let handling = false;
let onAccountDisabled = null;

export function registerSessionInvalidHandler(handler) {
  onSessionInvalid = typeof handler === 'function' ? handler : null;
}

/**
 * Cuenta bloqueada por un admin. Va aparte de la sesión inválida porque el
 * usuario no tiene nada que reintentar: volver a entrar da el mismo 401. El
 * backend lo distingue con `code: 'ACCOUNT_DISABLED'` y manda el correo de
 * soporte en la misma respuesta, porque sin sesión no puede pedirlo aparte.
 */
export function registerAccountDisabledHandler(handler) {
  onAccountDisabled = typeof handler === 'function' ? handler : null;
}

export async function notifyAccountDisabled(info) {
  if (handling) return;
  handling = true;
  try {
    if (onAccountDisabled) await onAccountDisabled(info);
    else await notifySessionInvalidInternal();
  } finally {
    handling = false;
  }
}

async function notifySessionInvalidInternal() {
  if (onSessionInvalid) await onSessionInvalid();
  else {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
  }
}

export async function notifySessionInvalid() {
  if (handling) return;
  handling = true;
  try {
    await notifySessionInvalidInternal();
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

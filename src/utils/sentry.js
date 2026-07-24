import * as Sentry from '@sentry/react-native';

// DSN pendiente: el usuario todavía no creó el proyecto en sentry.io. Con DSN
// vacío el SDK queda inicializado pero no manda nada (comportamiento propio
// de Sentry, no hace falta un flag "enabled" a mano).
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

export function initSentry() {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.2,
    // Captura errores no manejados/crashes nativos además de los reportados
    // a mano con reportError.
    enableAutoSessionTracking: true,
  });
}

/**
 * Reporta un error ya capturado en un catch a Sentry, con contexto de qué
 * pantalla/acción lo generó. Usar en los catch de creación, edición, listado
 * y detalle en vez de (o además de) console.error.
 */
export function reportError(error, context) {
  if (context) {
    Sentry.captureException(error, { extra: context });
  } else {
    Sentry.captureException(error);
  }
}

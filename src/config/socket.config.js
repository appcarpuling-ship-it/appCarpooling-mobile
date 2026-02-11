/**
 * Configuración de WebSocket
 *
 * Usa la misma fuente que api.js para consistencia.
 * La URL del socket es la base de la API sin /api
 */

import { API_CONFIG } from './api';

// Remover '/api' del final para obtener la URL base del socket
const SOCKET_URL = API_CONFIG.BASE_URL.replace(/\/api\/?$/, '') || 'https://appcarpuling.cloud';

export const SOCKET_CONFIG = {
  URL: SOCKET_URL,

  OPTIONS: {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    timeout: 10000
  }
};

// Función helper para obtener la URL correcta
export const getSocketURL = () => {
  return SOCKET_CONFIG.URL;
};

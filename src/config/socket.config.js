/**
 * Configuración de WebSocket
 *
 * IMPORTANTE: Lee la URL desde .env o constants de Expo
 */

import Constants from 'expo-constants';

// Obtener URL base de la configuración
const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL || 
                     process.env.API_BASE_URL || 
                     'http://192.168.1.6:5000/api';

// Remover '/api' del final para obtener la URL base del socket
const SOCKET_URL = API_BASE_URL.replace('/api', '');

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

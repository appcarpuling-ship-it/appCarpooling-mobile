import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api';
import { sanitizeImageUrl } from '../utils/imageUtils';
import { notifySessionInvalid } from './authSession';

const NATIVE_APP_VERSION =
  Constants.expoConfig?.version ??
  Constants.manifest?.version ??
  '1.0.0';

const getNativeClientHeaders = (includeJsonContentType = false) => {
  const h = {
    'X-Client-OS': Platform.OS === 'ios' ? 'ios' : 'android',
    'X-App-Version': NATIVE_APP_VERSION,
  };
  if (includeJsonContentType) {
    h['Content-Type'] = 'application/json';
  }
  return h;
};

// Crear instancia de axios
const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'X-Platform': 'mobile',
    'X-Client-Platform': 'mobile',
  },
});

// Interceptor para agregar token a las peticiones
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['X-Client-OS'] = Platform.OS === 'ios' ? 'ios' : 'android';
    config.headers['X-App-Version'] = NATIVE_APP_VERSION;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar respuestas
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const isPublicAuth =
        url.includes('/auth/login') ||
        url.includes('/auth/register') ||
        url.includes('/auth/verify-email') ||
        url.includes('/auth/resend-code') ||
        url.includes('/auth/forgot-password') ||
        url.includes('/auth/reset-password');
      if (!isPublicAuth) {
        await notifySessionInvalid();
      }
    }
    return Promise.reject(error);
  }
);

/**
 * GET request con autenticaci?n
 * @param {string} endpoint - Endpoint de la API
 * @param {object} params - Par?metros de consulta
 * @returns {Promise} - Promesa con la respuesta
 */
export const get_withauth = async (endpoint, params = {}) => {
  try {
    const response = await api.get(endpoint, { params });
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

/**
 * POST request con autenticaci?n
 * @param {string} endpoint - Endpoint de la API
 * @param {object} formData - Datos a enviar
 * @returns {Promise} - Promesa con la respuesta
 */
export const post_withauth = async (endpoint, formData = {}) => {
  try {
    const response = await api.post(endpoint, formData);
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

/**
 * PUT request con autenticaci?n
 * @param {string} endpoint - Endpoint de la API
 * @param {object} formData - Datos a enviar
 * @returns {Promise} - Promesa con la respuesta
 */
export const put_withauth = async (endpoint, formData = {}) => {
  try {
    const response = await api.put(endpoint, formData);
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

/**
 * DELETE request con autenticaci?n
 * @param {string} endpoint - Endpoint de la API
 * @returns {Promise} - Promesa con la respuesta
 */
export const delete_withauth = async (endpoint, data) => {
  try {
    const config = data != null && typeof data === 'object' && Object.keys(data).length > 0
      ? { data }
      : {};
    const response = await api.delete(endpoint, config);
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

/**
 * GET request sin autenticaci?n
 * @param {string} endpoint - Endpoint de la API
 * @param {object} params - Par?metros de consulta
 * @returns {Promise} - Promesa con la respuesta
 */
export const get_public = async (endpoint, params = {}) => {
  try {
    const response = await axios.get(`${API_CONFIG.BASE_URL}${endpoint}`, {
      params,
      headers: getNativeClientHeaders(false),
    });
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

/**
 * POST request sin autenticaci?n
 * @param {string} endpoint - Endpoint de la API
 * @param {object} formData - Datos a enviar
 * @returns {Promise} - Promesa con la respuesta
 */
export const post_public = async (endpoint, formData = {}) => {
  try {
    const isFormData =
      typeof FormData !== 'undefined' && formData instanceof FormData;
    const response = await axios.post(
      `${API_CONFIG.BASE_URL}${endpoint}`,
      formData,
      {
        headers: getNativeClientHeaders(!isFormData),
      }
    );
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

/**
 * POST request con autenticaci?n y FormData (para archivos)
 * @param {string} endpoint - Endpoint de la API
 * @param {FormData} formData - FormData con archivos
 * @returns {Promise} - Promesa con la respuesta
 */
export const post_withauth_formdata = async (endpoint, formData) => {
  try {
    const response = await api.post(endpoint, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

/**
 * PUT request con autenticaci?n y FormData (para archivos)
 * @param {string} endpoint - Endpoint de la API
 * @param {FormData} formData - FormData con archivos
 * @returns {Promise} - Promesa con la respuesta
 */
export const put_withauth_formdata = async (endpoint, formData) => {
  try {
    const response = await api.put(endpoint, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

/**
 * Maneja los errores de las peticiones
 * @param {object} error - Error de axios
 * @returns {Error} - Error formateado con informaci?n completa
 */
const handleError = (error) => {
  if (error.response) {
    // El servidor respondi? con un c?digo de estado fuera del rango 2xx
    const message = error.response.data?.message || 'Error en el servidor';
    const enhancedError = new Error(message);
    // Preservar toda la informaci?n del error del backend
    enhancedError.response = {
      ...error.response,
      data: {
        ...error.response.data,
        statusMP: error.response.data?.statusMP,
        statusDetail: error.response.data?.statusDetail,
      }
    };
    return enhancedError;
  } else if (error.request) {
    // La petici?n fue hecha pero no se recibi? respuesta
    return new Error('No se pudo conectar con el servidor. Verifica tu conexión a internet.');
  } else {
    // Algo pas? al configurar la petici?n
    return new Error(error.message || 'Error desconocido');
  }
};

/**
 * Construye una URI segura para im?genes desde la API
 * @param {string} imagePath - Ruta de la imagen desde el servidor
 * @returns {string|null} - URI completa o null si es inv?lida
 */
export const buildImageUri = (imagePath) => {
  // Si no hay ruta, retorna null
  if (!imagePath || typeof imagePath !== 'string') {
    return null;
  }

  // Limpia espacios en blanco
  const cleanPath = imagePath.trim();

  // Si la ruta est? vac?a despu?s de limpiar, retorna null
  if (!cleanPath) {
    return null;
  }

  // URL absoluta: rutas heredadas pueden apuntar a servicios placeholder caídos
  if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
    return sanitizeImageUrl(cleanPath) || cleanPath;
  }

  // Construye la URI base sin '/api'
  const baseUrl = API_CONFIG.BASE_URL.replace('/api', '');

  // Asegura que el path empiece con /
  const path = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;

  return `${baseUrl}${path}`;
};

export default api;

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG } from '../config/api';

// Crear instancia de axios
const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'X-Platform': 'mobile', // Identificar que las peticiones vienen de la app móvil
    'X-Client-Platform': 'mobile', // Header alternativo
  },
});

// Interceptor para agregar token a las peticiones
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
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
      // Token expirado o inválido
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

/**
 * GET request con autenticación
 * @param {string} endpoint - Endpoint de la API
 * @param {object} params - Parámetros de consulta
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
 * POST request con autenticación
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
 * PUT request con autenticación
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
 * DELETE request con autenticación
 * @param {string} endpoint - Endpoint de la API
 * @returns {Promise} - Promesa con la respuesta
 */
export const delete_withauth = async (endpoint) => {
  try {
    const response = await api.delete(endpoint);
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

/**
 * GET request sin autenticación
 * @param {string} endpoint - Endpoint de la API
 * @param {object} params - Parámetros de consulta
 * @returns {Promise} - Promesa con la respuesta
 */
export const get_public = async (endpoint, params = {}) => {
  try {
    const response = await axios.get(`${API_CONFIG.BASE_URL}${endpoint}`, { params });
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

/**
 * POST request sin autenticación
 * @param {string} endpoint - Endpoint de la API
 * @param {object} formData - Datos a enviar
 * @returns {Promise} - Promesa con la respuesta
 */
export const post_public = async (endpoint, formData = {}) => {
  try {
    const response = await axios.post(`${API_CONFIG.BASE_URL}${endpoint}`, formData);
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

/**
 * POST request con autenticación y FormData (para archivos)
 * @param {string} endpoint - Endpoint de la API
 * @param {FormData} formData - FormData con archivos
 * @returns {Promise} - Promesa con la respuesta
 */
export const post_withauth_formdata = async (endpoint, formData) => {
  try {
    const token = await AsyncStorage.getItem('token');
    const config = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    };
    const response = await axios.post(`${API_CONFIG.BASE_URL}${endpoint}`, formData, config);
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

/**
 * PUT request con autenticación y FormData (para archivos)
 * @param {string} endpoint - Endpoint de la API
 * @param {FormData} formData - FormData con archivos
 * @returns {Promise} - Promesa con la respuesta
 */
export const put_withauth_formdata = async (endpoint, formData) => {
  try {
    const token = await AsyncStorage.getItem('token');
    const config = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      },
    };
    const response = await axios.put(`${API_CONFIG.BASE_URL}${endpoint}`, formData, config);
    return response.data;
  } catch (error) {
    throw handleError(error);
  }
};

/**
 * Maneja los errores de las peticiones
 * @param {object} error - Error de axios
 * @returns {Error} - Error formateado con información completa
 */
const handleError = (error) => {
  if (error.response) {
    // El servidor respondió con un código de estado fuera del rango 2xx
    const message = error.response.data?.message || 'Error en el servidor';
    const enhancedError = new Error(message);
    // Preservar toda la información del error del backend
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
    // La petición fue hecha pero no se recibió respuesta
    return new Error('No se pudo conectar con el servidor. Verifica tu conexión a internet.');
  } else {
    // Algo pasó al configurar la petición
    return new Error(error.message || 'Error desconocido');
  }
};

/**
 * Construye una URI segura para imágenes desde la API
 * @param {string} imagePath - Ruta de la imagen desde el servidor
 * @returns {string|null} - URI completa o null si es inválida
 */
export const buildImageUri = (imagePath) => {
  // Si no hay ruta, retorna null
  if (!imagePath || typeof imagePath !== 'string') {
    return null;
  }

  // Limpia espacios en blanco
  const cleanPath = imagePath.trim();

  // Si la ruta está vacía después de limpiar, retorna null
  if (!cleanPath) {
    return null;
  }

  // Si ya es una URL completa (empieza con http), retórnaIa tal cual
  if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
    return cleanPath;
  }

  // Construye la URI base sin '/api'
  const baseUrl = API_CONFIG.BASE_URL.replace('/api', '');

  // Asegura que el path empiece con /
  const path = cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;

  return `${baseUrl}${path}`;
};

export default api;

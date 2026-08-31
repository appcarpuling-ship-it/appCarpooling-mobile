import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, tunnelExtraHeaders } from '../config/api';
import { sanitizeImageUrl } from '../utils/imageUtils';
import { notifySessionInvalid, notifyAccountDisabled } from './authSession';
import { reportError } from '../utils/sentry';

/**
 * UN mensaje para todo lo que falla del lado de la red, y no dice nada de cómo está hecha la
 * app por dentro.
 *
 * Antes había un texto por entorno: el de producción decía "No se pudo conectar el
 * servidor(producción)" —el usuario no sabe ni tiene por qué saber qué es "producción"— y los
 * de desarrollo llegaban a imprimir el dominio de ngrok y los comandos de la terminal en un
 * cartel de la app. Cualquiera de esos textos es un mapa de la infraestructura para quien no
 * debería tenerlo.
 *
 * Tampoco distingue entre "no hay internet", "tardó demasiado" y "el envío falló": para quien
 * está mirando la pantalla las tres son lo mismo —no pasó nada y hay que reintentar—, y cada
 * variante de más es una pista de qué falló adentro. El detalle real va a Sentry, y la pista
 * para desarrollar a la consola.
 */
const ERROR_GENERICO = 'Ocurrió algo y no pudimos completar la acción. Probá de nuevo en un momento.';

const NATIVE_APP_VERSION =
  Constants.expoConfig?.version ??
  Constants.manifest?.version ??
  '1.0.0';

const getNativeClientHeaders = (includeJsonContentType = false) => {
  const h = {
    'X-Client-OS': Platform.OS === 'ios' ? 'ios' : 'android',
    'X-App-Version': NATIVE_APP_VERSION,
    /** ngrok-free: mismo criterio que la instancia `api` para no recibir HTML de aviso. */
    ...tunnelExtraHeaders(),
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
    ...tunnelExtraHeaders(),
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
    Object.assign(config.headers, tunnelExtraHeaders());
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
      // Cuenta bloqueada por un admin: no es sesión vencida, no hay nada que
      // reintentar. Se maneja aparte para poder mostrarle al usuario por qué no
      // puede entrar, incluso en los endpoints públicos de auth.
      if (error.response?.data?.code === 'ACCOUNT_DISABLED') {
        await notifyAccountDisabled(error.response.data);
        return Promise.reject(error);
      }

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

export const patch_withauth = async (endpoint, formData = {}) => {
  try {
    const response = await api.patch(endpoint, formData);
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
      timeout: API_CONFIG.TIMEOUT,
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
    const timeout = isFormData ? Math.max(API_CONFIG.TIMEOUT || 10000, 120000) : API_CONFIG.TIMEOUT;
    const response = await axios.post(
      `${API_CONFIG.BASE_URL}${endpoint}`,
      formData,
      {
        timeout,
        headers: {
          ...getNativeClientHeaders(!isFormData),
          'X-Platform': 'mobile',
          'X-Client-Platform': 'mobile',
        },
      },
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
/**
 * Multipart con `fetch` y no con axios, a proposito.
 *
 * Ninguna subida de archivos desde Android llego nunca al backend (verificado
 * contra el access log: los unicos POST /api/vehicles y PUT /api/auth/profile
 * que existen son de iOS). Fallaba con "Network Error" a los ~200ms, sin que el
 * request apareciera en nginx, mientras las llamadas JSON al mismo host andaban
 * perfecto y con los mismos headers. La unica diferencia era el cuerpo pasando
 * por el adaptador XHR de axios, que sobre el FormData de React Native hace
 * transformaciones que el modulo nativo de Android termina rechazando.
 *
 * `fetch` le entrega el FormData directo al modulo nativo, sin capa intermedia,
 * que es ademas el camino que documenta Expo para subir archivos.
 *
 * NO poner 'Content-Type' a mano: lo tiene que armar la plataforma para que
 * incluya el boundary del multipart.
 */
const sendMultipart = async (method, endpoint, formData) => {
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;
  const token = await AsyncStorage.getItem('token');

  // fetch no tiene timeout propio; el de subida es el mismo que usaba axios.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(API_CONFIG.TIMEOUT || 15000, 120000));

  try {
    const response = await fetch(url, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...getNativeClientHeaders(false),
        'X-Platform': 'mobile',
        'X-Client-Platform': 'mobile',
        ...tunnelExtraHeaders(),
      },
      body: formData,
      signal: controller.signal,
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Forma de error igual a la de axios para que handleError y las pantallas
      // que leen error.response.data sigan funcionando igual.
      const error = new Error(body?.message || ERROR_GENERICO);
      error.response = { status: response.status, data: body };
      throw handleError(error);
    }

    return body;
  } catch (error) {
    if (error.response) throw error; // ya paso por handleError arriba
    reportError(error, { helper: 'sendMultipart', method, endpoint });
    if (error.name === 'AbortError') {
      throw new Error(ERROR_GENERICO);
    }
    // Sin pegarle `error.message`: el error crudo de una petición fallida puede traer el
    // host o la ruta entera. El detalle ya se fue a Sentry en el reportError de arriba.
    throw new Error(ERROR_GENERICO);
  } finally {
    clearTimeout(timer);
  }
};

export const post_withauth_formdata = (endpoint, formData) =>
  sendMultipart('POST', endpoint, formData);

export const put_withauth_formdata = (endpoint, formData) =>
  sendMultipart('PUT', endpoint, formData);

/** Igual que sendMultipart pero sin token (registro: todavía no hay sesión). */
const sendMultipartPublic = async (endpoint, formData) => {
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(API_CONFIG.TIMEOUT || 15000, 120000));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...getNativeClientHeaders(false),
        'X-Platform': 'mobile',
        'X-Client-Platform': 'mobile',
        ...tunnelExtraHeaders(),
      },
      body: formData,
      signal: controller.signal,
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(body?.message || ERROR_GENERICO);
      error.response = { status: response.status, data: body };
      throw handleError(error);
    }

    return body;
  } catch (error) {
    if (error.response) throw error;
    reportError(error, { helper: 'sendMultipartPublic', endpoint });
    if (error.name === 'AbortError') {
      throw new Error(ERROR_GENERICO);
    }
    // Mismo motivo que arriba: el mensaje crudo puede traer la URL del backend.
    throw new Error(ERROR_GENERICO);
  } finally {
    clearTimeout(timer);
  }
};

export const post_public_formdata = (endpoint, formData) =>
  sendMultipartPublic(endpoint, formData);

/**
 * Maneja los errores de las peticiones
 * @param {object} error - Error de axios
 * @returns {Error} - Error formateado con informaci?n completa
 */

/** La pista para desarrollar, en la consola: la URL sola ya dice si es el túnel, la red
 *  local o producción, así que no hace falta ramificar por entorno. */
const avisarEnConsolaSiEsDev = (baseUrl) => {
  if (__DEV__) console.warn('[api] no se alcanzó %s', baseUrl);
};

// Choke point único: toda llamada get/post/put/patch/delete _withauth y
// _public pasa por acá. Reportar acá cubre creación/edición/listado/detalle
// de toda la app sin instrumentar cada catch de pantalla por separado.
const handleError = (error) => {
  const baseUrl = API_CONFIG.BASE_URL;

  reportError(error, {
    url: error.config?.url,
    method: error.config?.method,
    status: error.response?.status,
    responseMessage: error.response?.data?.message,
  });

  if (error.response) {
    // El servidor respondi? con un c?digo de estado fuera del rango 2xx
    const message = error.response.data?.message || ERROR_GENERICO;
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
    if (error.code === 'ECONNABORTED') {
      avisarEnConsolaSiEsDev(baseUrl);
      return new Error(ERROR_GENERICO);
    }
    avisarEnConsolaSiEsDev(baseUrl);
    return new Error(ERROR_GENERICO);
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

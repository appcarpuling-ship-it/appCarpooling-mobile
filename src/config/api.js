import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PRODUCTION_DEFAULT = process.env.EXPO_PUBLIC_API_BASE_URL;

function resolveApiBaseUrl() {
  const fromExtra = Constants.expoConfig?.extra?.API_BASE_URL;
  const fromEnv =
    process.env.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL;

  // Expo Web / react-native-web: el navegador corre en la PC → localhost en dev.
  // EXPO_PUBLIC_API_BASE_URL suele ser la IP LAN para el celular; no usarla en web dev.
  if (Platform.OS === 'web' && __DEV__) {
    return (
      process.env.EXPO_PUBLIC_API_BASE_URL_WEB ||
      'http://localhost:5000/api'
    );
  }

  // Native dev: Metro inyecta EXPO_PUBLIC_* en cada bundle; manifest (extra) puede quedar viejo tras cambiar solo .env.
  if (__DEV__) {
    if (fromEnv && fromExtra && String(fromEnv).trim() !== String(fromExtra).trim()) {
      console.warn(
        '[API_CONFIG] extra ≠ env (.env tiene prioridad): env →',
        String(fromEnv).trim(),
        '| manifest extra →',
        String(fromExtra).trim()
      );
    }
    return (fromEnv && String(fromEnv).trim()) || fromExtra || PRODUCTION_DEFAULT;
  }

  return fromExtra || fromEnv || PRODUCTION_DEFAULT;
}

const API_BASE_URL = resolveApiBaseUrl();

const isNgrokTunnel = /ngrok-free\.dev|\.ngrok\.io/i.test(API_BASE_URL);
const isLanDev = /\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(API_BASE_URL);

if (__DEV__) {
  console.log(
    '[API_CONFIG] platform=%s BASE_URL → %s',
    Platform.OS,
    API_BASE_URL
  );
  if (API_BASE_URL.includes('appcarpooling.onrender.com')) {
    console.warn(
      '[API_CONFIG] Estás en dev pero la API apunta a producción. ' +
        'Para túnel local: EXPO_PUBLIC_API_BASE_URL en mobile/.env y `npx expo start -c`. ' +
        'Para APK: `eas build --profile ngrok`.'
    );
  }
}

// Configuración de la API (ngrok/LAN suelen ser más lentos que producción)
export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  TIMEOUT: isNgrokTunnel ? 45000 : isLanDev ? 30000 : 15000,
};

/** ngrok Free a veces devuelve HTML de aviso; esta cabecera evita ese HTML en llamadas HTTP. */
export function tunnelExtraHeaders() {
  if (typeof API_CONFIG.BASE_URL !== 'string') return {};
  if (!/ngrok-free\.dev|\.ngrok\.io/i.test(API_CONFIG.BASE_URL)) return {};
  return { 'ngrok-skip-browser-warning': 'true' };
}

// Endpoints de la API
export const ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  GOOGLE_AUTH: '/auth/google',
  APPLE_AUTH: '/auth/apple',
  REGISTER: '/auth/register',
  VERIFY_EMAIL: '/auth/verify-email',
  RESEND_VERIFICATION: '/auth/resend-code',
  GET_ME: '/auth/me',
  UPDATE_PROFILE: '/auth/profile',
  UPLOAD_DNI: '/auth/documents/dni',
  FORGOT_PASSWORD: '/auth/forgot-password',
  RESET_PASSWORD: '/auth/reset-password',

  // Users
  GET_USER: (id) => `/users/${id}`,
  GET_USER_VEHICLES: (id) => `/users/${id}/vehicles`,
  REPORT_USER: (id) => `/users/${id}/report`,
  BLOCK_USER: (id) => `/users/${id}/block`,
  UNBLOCK_USER: (id) => `/users/${id}/block`,
  GET_BLOCKED_USERS: '/users/blocked',
  UPDATE_USER: (id) => `/users/${id}`,
  FREQUENT_ADDRESSES: '/users/frequent-addresses',

  // Maps (proxy backend — evita exponer la API key de Google en el cliente)
  MAPS_AUTOCOMPLETE: '/maps/autocomplete',
  MAPS_PLACE_DETAILS: '/maps/place-details',
  MAPS_DIRECTIONS: '/maps/directions',
  MAPS_GEOCODE: '/maps/geocode',

  // Trips
  GET_TRIPS: '/trips',
  SEARCH_TRIPS: '/trips/search',
  GET_TRIP: (id) => `/trips/${id}`,
  CREATE_TRIP: '/trips',
  MY_TRIPS_DRIVER: '/trips/my-trips/driver',
  MY_TRIPS_PASSENGER: '/trips/my-trips/passenger',
  UPDATE_TRIP: (id) => `/trips/${id}`,
  CANCEL_TRIP: (id) => `/trips/${id}/cancel`,
  START_TRIP: (id) => `/trips/${id}/start`,
  COMPLETE_TRIP: (id) => `/trips/${id}/complete`,
  DELETE_TRIP: (id) => `/trips/${id}`,

  // Bookings
  GET_BOOKINGS: '/bookings',
  CREATE_BOOKING: '/bookings',
  GET_BOOKING: (id) => `/bookings/${id}`,
  MY_BOOKINGS: '/bookings/my-bookings',
  CANCEL_BOOKING: (id) => `/bookings/${id}/cancel`,
  ACCEPT_BOOKING: (id) => `/bookings/${id}/accept`,
  REJECT_BOOKING: (id) => `/bookings/${id}/reject`,

  // Reviews
  CREATE_REVIEW: '/reviews',
  GET_USER_REVIEWS: (id) => `/reviews/user/${id}`,

  // Notifications
  GET_NOTIFICATIONS: '/notifications',
  MARK_AS_READ: (id) => `/notifications/${id}/read`,
  MARK_ALL_AS_READ: '/notifications/mark-all-read',
  DELETE_NOTIFICATION: (id) => `/notifications/${id}`,
  CLEAR_READ_NOTIFICATIONS: '/notifications/clear-read',

  // Vehicles
  GET_VEHICLES: '/vehicles',
  CREATE_VEHICLE: '/vehicles',
  UPDATE_VEHICLE: (id) => `/vehicles/${id}`,
  DELETE_VEHICLE: (id) => `/vehicles/${id}`,
  MY_VEHICLES: '/vehicles/my-vehicles',

  // Payments
  CREATE_PAYMENT: '/payments',
  GET_PAYMENT: (id) => `/payments/${id}`,
  MY_PAYMENTS: '/payments/my-payments',

  // Seat Reservations
  SEAT_RESERVATIONS: '/seat-reservations',
  MY_SEAT_RESERVATIONS: '/seat-reservations/my-reservations',
  MARK_RESERVATION_PAID: (id) => `/seat-reservations/${id}/mark-paid`,
  LIMITE_EXTRA_CONDUCTOR: '/parametros/limite-extra-conductor',

  // Banners
  GET_BANNER_SECTIONS: '/banners/sections',
  GET_BANNERS_BY_SECTION: (sectionTitle) => `/banners/section/${encodeURIComponent(sectionTitle)}`,
  REGISTER_BANNER_VIEW: (id) => `/banners/${id}/register-view`,
  REGISTER_BANNER_CLICK: (id) => `/banners/${id}/register-click`,

  NEWS_UNREAD: '/news/unread',
  NEWS_ACK_READ: (id) => `/news/${id}/ack-read`,

  // Bot assistant
  BOT_MESSAGE: '/bot/message',

  // Trip Requests (solicitudes de viaje de pasajeros)
  TRIP_REQUESTS: '/trip-requests',
  MY_TRIP_REQUESTS: '/trip-requests/my',
  MY_TRIP_REQUEST_APPLICATIONS: '/trip-requests/my-applications',
  GET_TRIP_REQUEST: (id) => `/trip-requests/${id}`,
  APPLY_TO_TRIP_REQUEST: (id) => `/trip-requests/${id}/apply`,
  ACCEPT_TRIP_REQUEST_APPLICATION: (id, appId) => `/trip-requests/${id}/accept/${appId}`,
  CANCEL_TRIP_REQUEST: (id) => `/trip-requests/${id}`,
  CANCEL_TRIP_REQUEST_APPLICATION: (id) => `/trip-requests/${id}/apply`,
};

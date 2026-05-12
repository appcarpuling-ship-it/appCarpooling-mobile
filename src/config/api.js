import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PRODUCTION_DEFAULT = 'https://appcarpuling.cloud/api';

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

  return fromExtra || fromEnv || PRODUCTION_DEFAULT;
}

const API_BASE_URL = resolveApiBaseUrl();

if (__DEV__) {
  console.log(
    '[API_CONFIG] platform=%s BASE_URL → %s',
    Platform.OS,
    API_BASE_URL
  );
}

// Configuración de la API
export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  TIMEOUT: 10000,
};

// Endpoints de la API
export const ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
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
  UPDATE_USER: (id) => `/users/${id}`,

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

  // Banners
  GET_BANNERS_BY_PACKAGE: (packageId) => `/banners/package/${packageId}`,
  REGISTER_BANNER_VIEW: (id) => `/banners/${id}/register-view`,
  REGISTER_BANNER_CLICK: (id) => `/banners/${id}/register-click`,

  NEWS_UNREAD: '/news/unread',
  NEWS_ACK_READ: (id) => `/news/${id}/ack-read`,
};

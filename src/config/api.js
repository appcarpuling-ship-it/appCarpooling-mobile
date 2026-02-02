import Constants from 'expo-constants';

// Leer configuración desde .env o usar valores por defecto
// Para producción: https://appcarpuling.cloud/api
// Para desarrollo local: http://TU_IP:5000/api (ej: http://192.168.1.6:5000/api)
// Para Android Emulator: http://10.0.2.2:5000/api
const API_BASE_URL = Constants.expoConfig?.extra?.API_BASE_URL ||
  process.env.API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'https://appcarpuling.cloud/api';

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
  FORGOT_PASSWORD: '/auth/forgot-password',

  // Users
  GET_USER: (id) => `/users/${id}`,
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
};

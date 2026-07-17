import { get_withauth } from './apiService';
import { ENDPOINTS } from '../config/api';

/**
 * Wrapper de Places/Directions/Geocoding vía el backend: la API key de Google
 * vive solo en el servidor, nunca en el bundle del cliente.
 */
export const searchPlaces = (input) =>
  get_withauth(ENDPOINTS.MAPS_AUTOCOMPLETE, { input });

export const getPlaceDetails = (placeId, fields) =>
  get_withauth(ENDPOINTS.MAPS_PLACE_DETAILS, { placeId, ...(fields && { fields }) });

export const getDirections = (origin, destination, waypoints) =>
  get_withauth(ENDPOINTS.MAPS_DIRECTIONS, { origin, destination, ...(waypoints && { waypoints }) });

export const reverseGeocode = (lat, lng) =>
  get_withauth(ENDPOINTS.MAPS_GEOCODE, { lat, lng });

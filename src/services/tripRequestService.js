import { ENDPOINTS } from '../config/api';
import { get_withauth, post_withauth, put_withauth, delete_withauth } from './apiService';

export const createTripRequest = (data) =>
  post_withauth(ENDPOINTS.TRIP_REQUESTS, data);

export const getOpenTripRequests = (filters = {}) =>
  get_withauth(ENDPOINTS.TRIP_REQUESTS, filters);

export const getMyTripRequests = (params = {}) =>
  get_withauth(ENDPOINTS.MY_TRIP_REQUESTS, params);

export const getMyApplications = (params = {}) =>
  get_withauth(ENDPOINTS.MY_TRIP_REQUEST_APPLICATIONS, params);

/**
 * @param {object} [recorrido] El tramo propio del conductor: `{ driverOrigin, driverDestination }`.
 *   Opcional — sin él el viaje se arma con el tramo del pasajero. No cambia el precio: el
 *   pasajero paga siempre desde donde sube hasta donde baja.
 */
// driverPrice: lo que este conductor cobra por asiento. Es su oferta y el pasajero la compara
// contra las otras postulaciones. No toca el precio de la conexión, que lo calcula el server.
export const applyToTripRequest = (requestId, vehicleId, recorrido = {}, driverPrice = 0) =>
  post_withauth(ENDPOINTS.APPLY_TO_TRIP_REQUEST(requestId), { vehicleId, driverPrice, ...recorrido });

export const acceptTripRequestApplication = (requestId, applicationId) =>
  put_withauth(ENDPOINTS.ACCEPT_TRIP_REQUEST_APPLICATION(requestId, applicationId), {});

export const cancelTripRequest = (requestId) =>
  delete_withauth(ENDPOINTS.CANCEL_TRIP_REQUEST(requestId));

export const cancelTripRequestApplication = (requestId) =>
  delete_withauth(ENDPOINTS.CANCEL_TRIP_REQUEST_APPLICATION(requestId));

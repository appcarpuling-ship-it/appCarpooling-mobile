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
/**
 * @param {object} [oferta] `{ driverPrice, sinPrecioFijo, aceptaEfectivo }`. driverPrice es
 *   lo que este conductor cobra por asiento — su oferta, contra la que el pasajero compara
 *   las demás postulaciones. No toca el precio de la conexión, que lo calcula el server.
 *   sinPrecioFijo y aceptaEfectivo son las mismas dos opciones que al publicar un viaje
 *   normal (TripDetails.js): la primera cambia el cobro (fuerza driverPrice a 0 del lado
 *   del server), la segunda es sólo informativa.
 */
export const applyToTripRequest = (requestId, vehicleId, recorrido = {}, oferta = {}) =>
  post_withauth(ENDPOINTS.APPLY_TO_TRIP_REQUEST(requestId), {
    vehicleId,
    driverPrice: oferta.driverPrice || 0,
    sinPrecioFijo: oferta.sinPrecioFijo === true,
    aceptaEfectivo: oferta.aceptaEfectivo === true,
    ...recorrido
  });

export const acceptTripRequestApplication = (requestId, applicationId) =>
  put_withauth(ENDPOINTS.ACCEPT_TRIP_REQUEST_APPLICATION(requestId, applicationId), {});

export const cancelTripRequest = (requestId) =>
  delete_withauth(ENDPOINTS.CANCEL_TRIP_REQUEST(requestId));

export const cancelTripRequestApplication = (requestId) =>
  delete_withauth(ENDPOINTS.CANCEL_TRIP_REQUEST_APPLICATION(requestId));

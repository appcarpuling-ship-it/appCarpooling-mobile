import { ENDPOINTS } from '../config/api';
import { get_withauth, post_withauth, put_withauth, delete_withauth } from './apiService';

export const createTripRequest = (data) =>
  post_withauth(ENDPOINTS.TRIP_REQUESTS, data);

export const getOpenTripRequests = (filters = {}) =>
  get_withauth(ENDPOINTS.TRIP_REQUESTS, filters);

export const getMyTripRequests = () =>
  get_withauth(ENDPOINTS.MY_TRIP_REQUESTS);

export const getMyApplications = () =>
  get_withauth(ENDPOINTS.MY_TRIP_REQUEST_APPLICATIONS);

export const applyToTripRequest = (requestId, vehicleId) =>
  post_withauth(ENDPOINTS.APPLY_TO_TRIP_REQUEST(requestId), { vehicleId });

export const acceptTripRequestApplication = (requestId, applicationId) =>
  put_withauth(ENDPOINTS.ACCEPT_TRIP_REQUEST_APPLICATION(requestId, applicationId), {});

export const cancelTripRequest = (requestId) =>
  delete_withauth(ENDPOINTS.CANCEL_TRIP_REQUEST(requestId));

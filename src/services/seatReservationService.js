import { ENDPOINTS } from '../config/api';
import { post_withauth, get_withauth, delete_withauth, put_withauth } from './apiService';

/**
 * Servicio para operaciones de reserva de asientos con precio dinámico
 * Basado en distancia del viaje
 * 
 * IMPORTANTE: Los pagos se procesan automáticamente vía webhook de MercadoPago.
 * El usuario paga en MercadoPago Checkout Pro (redirect) y el webhook procesa el pago.
 */

/**
 * Calcular precio dinámico de una reserva antes de crearla.
 *
 * Los dos puntos van en la consulta porque el server les cobra el desvío: la recogida desde
 * el origen y la dejada hasta el destino. Si no se mandan, la pantalla muestra un precio y el
 * server guarda otro más caro al crear la solicitud.
 *
 * @param {string} tripId - ID del viaje
 * @param {number} seatsBooked - Número de asientos a reservar
 * @param {Object} [puntos] - { pickupLocation, dropoffLocation }
 * @returns {Promise<Object>} - Objeto con cálculo de precio y desglose
 */
export const calculateReservationPrice = async (tripId, seatsBooked = 1, puntos = {}) => {
  try {
    const params = new URLSearchParams({ seatsBooked: String(seatsBooked) });
    const agregar = (prefijo, punto) => {
      if (punto?.coordinates?.latitude == null || punto?.coordinates?.longitude == null) return;
      params.set(`${prefijo}Lat`, String(punto.coordinates.latitude));
      params.set(`${prefijo}Lng`, String(punto.coordinates.longitude));
      if (punto.address) params.set(`${prefijo}Address`, punto.address);
      if (punto.city) params.set(`${prefijo}City`, punto.city);
    };
    agregar('pickup', puntos.pickupLocation);
    agregar('dropoff', puntos.dropoffLocation);

    const response = await get_withauth(
      `${ENDPOINTS.SEAT_RESERVATIONS}/calculate-price/${tripId}?${params.toString()}`
    );
    return response;
  } catch (error) {
    console.error('Error calculando precio de reserva:', error);
    throw error;
  }
};

/**
 * Crear una nueva solicitud de reserva de asiento (SOLO SOLICITUD, sin pago inmediato)
 * El flujo es: Solicitar -> Conductor Aprueba -> Usuario Paga
 * @param {Object} data - Datos de la reserva
 * @param {string} data.tripId - ID del viaje
 * @param {number} data.seatsBooked - Número de asientos
 * @param {string} data.message - Mensaje opcional al conductor
 * @returns {Promise<Object>} - Objeto con datos de la reserva creada (estado: pending_approval)
 */
export const createSeatReservation = async (data) => {
  try {
    const body = {
      tripId: data.tripId,
      seatsBooked: data.seatsBooked,
      message: data.message || ''
    };
    if (data.pickupLocation?.address) {
      body.pickupLocation = data.pickupLocation;
    }
    if (data.dropoffLocation?.address) {
      body.dropoffLocation = data.dropoffLocation;
    }
    const response = await post_withauth(ENDPOINTS.SEAT_RESERVATIONS, body);
    return response;
  } catch (error) {
    console.error('Error creando reserva de asiento:', error);
    throw error;
  }
};

/**
 * Obtener mis reservas de asiento
 * @param {Object} options - Opciones de búsqueda
 * @param {string} options.status - Estado de la reserva (pending_approval, pending_payment, reserved, rejected)
 * @param {number} options.page - Página actual
 * @param {number} options.limit - Número de elementos por página
 * @returns {Promise<Object>} - Lista de reservas del usuario
 */
export const getMyReservations = async (options = {}) => {
  try {
    let url = `${ENDPOINTS.SEAT_RESERVATIONS}/my-reservations`;

    // Agregar parámetros de query
    const params = new URLSearchParams();
    if (options.status) params.append('status', options.status);
    if (options.page) params.append('page', options.page.toString());
    if (options.limit) params.append('limit', options.limit.toString());

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const response = await get_withauth(url);
    return response;
  } catch (error) {
    console.error('Error obteniendo reservas:', error);
    throw error;
  }
};

/**
 * Obtener reservas pendientes de pago (que van a expirar)
 * @returns {Promise<Object>} - Reservas con pago pendiente
 */
export const getPendingPaymentReservations = async () => {
  try {
    const response = await get_withauth(`${ENDPOINTS.SEAT_RESERVATIONS}/pending-payment`);
    return response;
  } catch (error) {
    console.error('Error obteniendo reservas pendientes:', error);
    throw error;
  }
};

/**
 * Obtener configuración del sistema de reservas
 * @returns {Promise<Object>} - Configuración actual
 */
export const getReservationConfig = async () => {
  try {
    const response = await get_withauth(`${ENDPOINTS.SEAT_RESERVATIONS}/config`);
    return response;
  } catch (error) {
    console.error('Error obteniendo configuración de reservas:', error);
    throw error;
  }
};

/**
 * Cancelar reserva de asiento (solo si está pendiente de pago o aprobación)
 * @param {string} reservationId - ID de la reserva (seatReservation._id)
 * @param {string} reason - Motivo de cancelación (opcional)
 * @returns {Promise<Object>} - Confirmación de cancelación
 */
export const cancelSeatReservation = async (reservationId, reason = '') => {
  try {
    const response = await delete_withauth(
      `${ENDPOINTS.SEAT_RESERVATIONS}/${reservationId}`,
      { reason }
    );
    return response;
  } catch (error) {
    console.error('Error cancelando reserva:', error);
    throw error;
  }
};

/**
 * Aprobar o rechazar una solicitud de reserva (solo conductor)
 * @param {string} reservationId - ID de la reserva (seatReservation._id)
 * @param {string} action - 'approve' o 'reject'
 * @param {string} reason - Razón opcional para rechazar
 * @returns {Promise<Object>} - Resultado de la acción. Si aprueba, incluye paymentUrl para Checkout Pro
 */
export const approveOrRejectReservation = async (reservationId, action, reason = '') => {
  try {
    const response = await put_withauth(
      `${ENDPOINTS.SEAT_RESERVATIONS}/${reservationId}/approve`,
      {
        action,
        reason
      }
    );
    return response;
  } catch (error) {
    console.error('Error aprobando/rechazando reserva:', error);
    throw error;
  }
};

/**
 * Obtener reservas pendientes de aprobación (solo conductor)
 * @returns {Promise<Object>} - Lista de reservas pendientes de aprobación
 */
export const getPendingApprovalReservations = async () => {
  try {
    const response = await get_withauth(`${ENDPOINTS.SEAT_RESERVATIONS}/pending-approval`);
    return response;
  } catch (error) {
    console.error('Error obteniendo reservas pendientes de aprobación:', error);
    throw error;
  }
};

/**
 * Confirmar pago desde callback (Rebill redirige tras el pago)
 * Asegura que el backend procese el pago aunque el webhook tarde
 * @param {string} externalReference - ID del PaymentIntent
 * @param {string} status - 'approved' | 'rejected'
 * @returns {Promise<Object>}
 */
/**
 * @param {string} paymentId  Lo necesita el pago del SALDO del conductor: el backend lo usa
 *                            para re-verificar contra la pasarela antes de acreditar. Las
 *                            reservas lo resuelven por su propia referencia y no lo mandan.
 */
export const confirmFromCallback = async (externalReference, status, paymentId) => {
  try {
    const response = await post_withauth(
      `${ENDPOINTS.SEAT_RESERVATIONS}/confirm-from-callback`,
      { external_reference: externalReference, status, payment_id: paymentId }
    );
    return response;
  } catch (error) {
    console.warn('confirmFromCallback:', error?.response?.data?.message || error.message);
    throw error;
  }
};

/**
 * Endpoint de diagnóstico para verificar el estado de una reserva
 * @param {string} reservationId - ID de la reserva
 * @returns {Promise<Object>} - Información de diagnóstico de la reserva
 */
export const debugReservation = async (reservationId) => {
  try {
    const response = await get_withauth(`${ENDPOINTS.SEAT_RESERVATIONS}/${reservationId}/debug`);
    return response;
  } catch (error) {
    console.error('Error en diagnóstico de reserva:', error);
    throw error;
  }
};

/**
 * @deprecated Este endpoint ya no está disponible. Los pagos solo se procesan automáticamente vía webhook de MercadoPago.
 * El usuario paga en MercadoPago Checkout Pro (redirect) y el webhook procesa el pago automáticamente.
 */
export const confirmReservationPayment = async (reservationId, paymentInfo) => {
  throw new Error('Este endpoint ya no está disponible. Los pagos solo se procesan automáticamente vía webhook de MercadoPago.');
};

/**
 * @deprecated Ya no se usa Payment Brick. Se usa Checkout Pro con redirect.
 */
export const confirmPaymentIntentPayment = async (intentId, formData) => {
  throw new Error('Este método ya no está disponible. Se usa MercadoPago Checkout Pro con redirect.');
};

/**
 * @deprecated Ya no se crean pagos separados. El pago se crea cuando el conductor aprueba la reserva.
 */
export const createSeatReservationPayment = async (seatReservationId, paymentMethod) => {
  throw new Error('Este método ya no está disponible. El pago se crea automáticamente cuando el conductor aprueba la reserva.');
};

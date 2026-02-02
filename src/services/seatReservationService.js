import { ENDPOINTS } from '../config/api';
import { post_withauth, get_withauth } from './apiService';

/**
 * Servicio para operaciones de reserva de asientos con precio dinámico
 * Basado en distancia del viaje
 */

/**
 * Calcular precio dinámico de una reserva antes de crearla
 * @param {string} tripId - ID del viaje
 * @param {number} seatsBooked - Número de asientos a reservar
 * @returns {Promise<Object>} - Objeto con cálculo de precio y desglose
 */
export const calculateReservationPrice = async (tripId, seatsBooked = 1) => {
  try {
    const response = await get_withauth(
      `${ENDPOINTS.SEAT_RESERVATIONS}/calculate-price/${tripId}?seatsBooked=${seatsBooked}`
    );
    return response;
  } catch (error) {
    console.error('Error calculando precio de reserva:', error);
    throw error;
  }
};

/**
 * Crear una nueva reserva de asiento
 * @param {Object} data - Datos de la reserva
 * @param {string} data.tripId - ID del viaje
 * @param {number} data.seatsBooked - Número de asientos
 * @param {string} data.message - Mensaje opcional al conductor
 * @param {string} data.paymentMethod - Método de pago: 'qr' | 'checkout_pro'
 * @returns {Promise<Object>} - Objeto con datos de reserva y opciones de pago
 */
export const createSeatReservation = async (data) => {
  try {
    const response = await post_withauth(
      ENDPOINTS.SEAT_RESERVATIONS,
      {
        tripId: data.tripId,
        seatsBooked: data.seatsBooked,
        message: data.message || '',
        paymentMethod: data.paymentMethod || 'qr'
      }
    );
    return response;
  } catch (error) {
    console.error('Error creando reserva de asiento:', error);
    throw error;
  }
};

/**
 * Confirmar pago de una reserva de asiento
 * @param {string} reservationId - ID de la reserva
 * @param {Object} paymentData - Datos del pago de Mercado Pago
 * @returns {Promise<Object>} - Datos de la reserva confirmada
 */
export const confirmReservationPayment = async (reservationId, paymentData) => {
  try {
    const response = await post_withauth(
      `${ENDPOINTS.SEAT_RESERVATIONS}/${reservationId}/confirm-payment`,
      paymentData
    );
    return response;
  } catch (error) {
    console.error('Error confirmando pago de reserva:', error);
    throw error;
  }
};

/**
 * Obtener mis reservas de asiento
 * @param {Object} options - Opciones de búsqueda
 * @returns {Promise<Object>} - Lista de reservas del usuario
 */
export const getMyReservations = async (options = {}) => {
  try {
    let url = `${ENDPOINTS.SEAT_RESERVATIONS}/my-reservations`;

    // Agregar parámetros de query
    const params = new URLSearchParams();
    if (options.status) params.append('status', options.status);
    if (options.page) params.append('page', options.page);
    if (options.limit) params.append('limit', options.limit);

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
 * Obtener reservas pendientes de pago
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
// En seatReservationService.js

/**
 * Confirmar el pago de una reserva usando Payment Brick
 * @param {string} intentId - ID del PaymentIntent (no del seatReservation)
 * @param {object} formData - Datos del formulario del Payment Brick
 * @returns {Promise<object>} - Respuesta con los datos de la reserva confirmada
 */
export const confirmPaymentIntentPayment = async (intentId, formData) => {
  try {
    console.log('🔄 [Service] Confirmando pago del PaymentIntent:', intentId);
    console.log('🔄 [Service] Form data:', formData);

    // Endpoint correcto según el backend: /api/seat-reservations/payment-intent/:intentId/confirm-payment
    const response = await post_withauth(
      `${ENDPOINTS.SEAT_RESERVATIONS}/payment-intent/${intentId}/confirm-payment`,
      { formData } // El backend espera recibir { formData: {...} }
    );

    console.log('✅ [Service] Pago confirmado:', response);
    return response;
  } catch (error) {
    console.error('❌ [Service] Error confirmando pago:', error);
    console.error('❌ [Service] Error completo:', {
      message: error?.message,
      response: error?.response?.data,
      statusMP: error?.response?.data?.statusMP,
      statusDetail: error?.response?.data?.statusDetail,
    });
    // Asegurar que el error tenga toda la información del backend
    if (error.response?.data) {
      error.response.data = {
        ...error.response.data,
        statusMP: error.response.data.statusMP,
        statusDetail: error.response.data.statusDetail,
      };
    }
    throw error;
  }
};

/**
 * Cancelar una reserva de asiento (solo si está pendiente de pago)
 * @param {string} reservationId - ID de la reserva
 * @returns {Promise<Object>} - Confirmación de cancelación
 */
export const cancelSeatReservation = async (reservationId) => {
  try {
    const response = await post_withauth(
      `${ENDPOINTS.SEAT_RESERVATIONS}/${reservationId}/cancel`,
      {}
    );
    return response;
  } catch (error) {
    console.error('Error cancelando reserva:', error);
    throw error;
  }
};

/**
 * Crear pago para reserva de asiento con método específico
 * @param {string} seatReservationId - ID de la reserva de asiento
 * @param {string} paymentMethod - 'qr' o 'checkout_pro'
 * @returns {Promise<Object>} - Datos del pago creado
 */
export const createSeatReservationPayment = async (seatReservationId, paymentMethod) => {
  try {
    const response = await post_withauth(
      `${ENDPOINTS.CREATE_PAYMENT}/seat-reservation`,
      {
        seatReservationId,
        paymentMethod
      }
    );
    return response;
  } catch (error) {
    console.error('Error creando pago para reserva:', error);
    throw error;
  }
};
